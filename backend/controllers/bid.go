package controllers

import (
	"math"
	"net/http"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

type topBidView struct {
	UserID uint    `json:"user_id"`
	Amount float64 `json:"amount"`
}

type placeBidReq struct {
	Amount float64 `json:"amount"`
}

const (
	autoExtendThreshold = 30 * time.Second
	floatEpsilon        = 0.001
)

func PlaceBid(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var req placeBidReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}
	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	var a models.Auction
	if err := config.DB.First(&a, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}

	if a.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "竞拍当前不可出价: " + a.Status})
		return
	}
	now := time.Now()
	if a.EndsAt == nil || !now.Before(*a.EndsAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "竞拍已结束"})
		return
	}

	// 加价幅度校验：amount = current_price + n * price_step (n >= 1)
	delta := req.Amount - a.CurrentPrice
	if delta <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "出价必须高于当前价"})
		return
	}
	steps := delta / a.PriceStep
	if math.Abs(steps-math.Round(steps)) > floatEpsilon || int(math.Round(steps)) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "出价必须为当前价加 price_step 的整数倍"})
		return
	}

	if a.CeilingPrice != nil && req.Amount > *a.CeilingPrice+floatEpsilon {
		c.JSON(http.StatusBadRequest, gin.H{"error": "出价不能超过封顶价"})
		return
	}

	// 写入 bids
	bid := models.Bid{AuctionID: a.ID, UserID: uid, Amount: req.Amount}
	if err := config.DB.Create(&bid).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 更新 auction
	a.CurrentPrice = req.Amount
	winnerID := uid
	a.WinnerID = &winnerID

	// 自动延时：距结束不足 30s 则延长 30s
	if a.EndsAt != nil && a.EndsAt.Sub(now) < autoExtendThreshold {
		newEnds := now.Add(autoExtendThreshold)
		a.EndsAt = &newEnds
	}

	// 封顶价命中：结束并生成订单
	hitCeiling := a.CeilingPrice != nil && math.Abs(req.Amount-*a.CeilingPrice) < floatEpsilon
	if hitCeiling {
		a.Status = "finished"
	}

	if err := config.DB.Save(&a).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 广播 new_bid：包含最新 top5 排行
	ws.H.Broadcast(a.ID, gin.H{
		"type":          "new_bid",
		"auction_id":    a.ID,
		"current_price": a.CurrentPrice,
		"winner_id":     a.WinnerID,
		"ends_at":       a.EndsAt,
		"top_bids":      fetchTopBids(a.ID, 5),
	})

	if hitCeiling {
		orderErr := createOrder(a.ID, uid, req.Amount)
		// 无论订单是否成功（可能与定时器并发重复），都广播 finished
		ws.H.Broadcast(a.ID, gin.H{
			"type":        "auction_finished",
			"auction_id":  a.ID,
			"final_price": a.CurrentPrice,
			"winner_id":   a.WinnerID,
		})
		if orderErr != nil {
			c.JSON(http.StatusOK, gin.H{"data": gin.H{
				"message":       "出价成功（已触达封顶价，但订单创建异常）",
				"current_price": a.CurrentPrice,
				"ends_at":       a.EndsAt,
				"finished":      true,
				"order_error":   orderErr.Error(),
			}})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"message":       "出价成功",
		"current_price": a.CurrentPrice,
		"ends_at":       a.EndsAt,
		"finished":      hitCeiling,
	}})
}

func fetchTopBids(auctionID uint, limit int) []topBidView {
	var bids []models.Bid
	config.DB.
		Where("auction_id = ?", auctionID).
		Order("amount DESC").
		Limit(limit).
		Find(&bids)
	out := make([]topBidView, len(bids))
	for i, b := range bids {
		out[i] = topBidView{UserID: b.UserID, Amount: b.Amount}
	}
	return out
}

func GetBids(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var bids []models.Bid
	if err := config.DB.
		Where("auction_id = ?", id).
		Order("amount DESC").
		Limit(10).
		Find(&bids).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bids})
}
