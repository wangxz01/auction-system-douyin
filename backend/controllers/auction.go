package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

type createAuctionReq struct {
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	ImageURL          string   `json:"image_url"`
	StreamURL         string   `json:"stream_url"`
	StartPrice        float64  `json:"start_price"`
	StartPriceCents   *int64   `json:"start_price_cents"`
	PriceStep         float64  `json:"price_step"`
	PriceStepCents    *int64   `json:"price_step_cents"`
	CeilingPrice      *float64 `json:"ceiling_price"`
	CeilingPriceCents *int64   `json:"ceiling_price_cents"`
	DurationSeconds   int      `json:"duration_seconds"`
}

func CreateAuction(c *gin.Context) {
	sellerID, ok := canCreateAuction(c)
	if !ok {
		return
	}
	var req createAuctionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.StreamURL = strings.TrimSpace(req.StreamURL)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title 必填"})
		return
	}
	if len([]rune(req.Title)) > 80 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title 不能超过 80 个字符"})
		return
	}
	if len(req.ImageURL) > 512 || len(req.StreamURL) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "图片或直播 URL 过长"})
		return
	}

	startPriceCents := int64(0)
	if req.StartPriceCents != nil {
		startPriceCents = *req.StartPriceCents
	} else {
		startPriceCents = floatToCents(req.StartPrice)
	}
	priceStepCents := int64(0)
	if req.PriceStepCents != nil {
		priceStepCents = *req.PriceStepCents
	} else {
		priceStepCents = floatToCents(req.PriceStep)
	}
	ceilingPriceCents := optionalCentsOrLegacy(req.CeilingPriceCents, req.CeilingPrice)

	if startPriceCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_price 必须大于 0"})
		return
	}
	if priceStepCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "price_step 必须大于 0"})
		return
	}
	if req.DurationSeconds <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "duration_seconds 必须大于 0"})
		return
	}
	if ceilingPriceCents != nil && *ceilingPriceCents <= startPriceCents {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ceiling_price 必须大于 start_price"})
		return
	}

	a := models.Auction{
		SellerUserID:      sellerID,
		Title:             req.Title,
		Description:       req.Description,
		ImageURL:          req.ImageURL,
		StreamURL:         req.StreamURL,
		StartPrice:        centsToFloat(startPriceCents),
		StartPriceCents:   startPriceCents,
		PriceStep:         centsToFloat(priceStepCents),
		PriceStepCents:    priceStepCents,
		CeilingPrice:      legacyFloatPointer(ceilingPriceCents),
		CeilingPriceCents: ceilingPriceCents,
		CurrentPrice:      centsToFloat(startPriceCents),
		CurrentPriceCents: startPriceCents,
		DurationSeconds:   req.DurationSeconds,
		Status:            "pending",
	}
	if err := config.DB.Create(&a).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": a})
}

func GetAuctions(c *gin.Context) {
	var auctions []models.Auction
	if err := config.DB.Order("created_at DESC").Find(&auctions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": auctions})
}

func GetAuction(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var a models.Auction
	if err := config.DB.First(&a, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": a})
}

func StartAuction(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var a models.Auction
	if err := config.DB.First(&a, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}
	if a.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能开始: " + a.Status})
		return
	}
	if !canManageAuction(c, a) {
		return
	}
	now := time.Now()
	ends := now.Add(time.Duration(a.DurationSeconds) * time.Second)
	a.Status = "active"
	a.StartedAt = &now
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ws.H.Broadcast(a.ID, gin.H{
		"type":       "auction_started",
		"auction_id": a.ID,
		"ends_at":    a.EndsAt,
	})
	c.JSON(http.StatusOK, gin.H{"data": a})
}

func CancelAuction(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var a models.Auction
	if err := config.DB.First(&a, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}
	if a.Status != "pending" && a.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "当前状态不能取消: " + a.Status})
		return
	}
	if !canManageAuction(c, a) {
		return
	}
	a.Status = "cancelled"
	if err := config.DB.Save(&a).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ws.H.Broadcast(a.ID, gin.H{
		"type":       "auction_cancelled",
		"auction_id": a.ID,
	})
	c.JSON(http.StatusOK, gin.H{"data": a})
}

func legacyFloatPointer(cents *int64) *float64 {
	if cents == nil {
		return nil
	}
	v := centsToFloat(*cents)
	return &v
}

func parseID(s string) (uint, error) {
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(n), nil
}
