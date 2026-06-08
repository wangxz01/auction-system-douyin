package controllers

import (
	"net/http"
	"strings"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

type createEventReq struct {
	EventType string `json:"event_type"`
	Metadata  string `json:"metadata"`
}

// CreateAuctionEvent 接收用户在直播间的行为埋点。
// 仅校验长度上限和竞拍是否存在，不做业务语义校验，方便前端按需扩展事件类型。
func CreateAuctionEvent(c *gin.Context) {
	auctionID, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	userID, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	var req createEventReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}
	req.EventType = strings.TrimSpace(req.EventType)
	if req.EventType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_type 必填"})
		return
	}
	if len(req.EventType) > 64 || len(req.Metadata) > 2000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_type 或 metadata 过长"})
		return
	}

	var auction models.Auction
	if err := config.DB.Select("id").First(&auction, auctionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}

	userAgent := c.Request.UserAgent()
	if len(userAgent) > 255 {
		userAgent = userAgent[:255]
	}
	event := models.UserEvent{
		AuctionID: auctionID,
		UserID:    userID,
		EventType: req.EventType,
		Metadata:  strings.TrimSpace(req.Metadata),
		UserAgent: userAgent,
	}
	if err := config.DB.Create(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": event})
}
