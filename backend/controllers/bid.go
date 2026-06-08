package controllers

import (
	"errors"
	"net/http"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type topBidView struct {
	UserID      uint    `json:"user_id"`
	Amount      float64 `json:"amount"`
	AmountCents int64   `json:"amount_cents"`
}

type placeBidReq struct {
	Amount      *float64 `json:"amount"`
	AmountCents *int64   `json:"amount_cents"`
}

const (
	autoExtendThreshold = 30 * time.Second
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
	var hitCeiling bool
	var response gin.H
	var status = http.StatusOK
	handled := errors.New("handled")

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&a, id).Error; err != nil {
			status = http.StatusNotFound
			response = gin.H{"error": "竞拍不存在"}
			return handled
		}

		if a.Status != "active" {
			status = http.StatusBadRequest
			response = gin.H{"error": "竞拍当前不可出价: " + a.Status}
			return handled
		}
		now := time.Now()
		if a.EndsAt == nil || !now.Before(*a.EndsAt) {
			status = http.StatusBadRequest
			response = gin.H{"error": "竞拍已结束"}
			return handled
		}

		amountCents := int64(0)
		if req.AmountCents != nil {
			amountCents = *req.AmountCents
		} else if req.Amount != nil {
			amountCents = floatToCents(*req.Amount)
		}
		currentCents := centsOrLegacy(a.CurrentPriceCents, a.CurrentPrice)
		stepCents := centsOrLegacy(a.PriceStepCents, a.PriceStep)
		ceilingCents := optionalCentsOrLegacy(a.CeilingPriceCents, a.CeilingPrice)

		if amountCents <= 0 {
			status = http.StatusBadRequest
			response = gin.H{"error": "出价金额必须大于 0"}
			return handled
		}
		delta := amountCents - currentCents
		if delta <= 0 {
			status = http.StatusBadRequest
			response = gin.H{"error": "出价必须高于当前价"}
			return handled
		}
		if stepCents <= 0 || delta%stepCents != 0 {
			status = http.StatusBadRequest
			response = gin.H{"error": "出价必须为当前价加 price_step 的整数倍"}
			return handled
		}
		if ceilingCents != nil && amountCents > *ceilingCents {
			status = http.StatusBadRequest
			response = gin.H{"error": "出价不能超过封顶价"}
			return handled
		}

		bid := models.Bid{
			AuctionID:   a.ID,
			UserID:      uid,
			Amount:      centsToFloat(amountCents),
			AmountCents: amountCents,
		}
		if err := tx.Create(&bid).Error; err != nil {
			return err
		}

		a.CurrentPrice = centsToFloat(amountCents)
		a.CurrentPriceCents = amountCents
		a.StartPriceCents = centsOrLegacy(a.StartPriceCents, a.StartPrice)
		a.PriceStepCents = stepCents
		a.CeilingPriceCents = ceilingCents
		winnerID := uid
		a.WinnerID = &winnerID

		extendSeconds := a.AutoExtendSeconds
		if extendSeconds <= 0 {
			extendSeconds = int(autoExtendThreshold / time.Second)
		}
		extendDuration := time.Duration(extendSeconds) * time.Second
		if a.EndsAt != nil && a.EndsAt.Sub(now) < extendDuration {
			newEnds := now.Add(extendDuration)
			a.EndsAt = &newEnds
		}

		hitCeiling = ceilingCents != nil && amountCents == *ceilingCents
		if hitCeiling {
			a.Status = "finished"
		}

		if err := tx.Save(&a).Error; err != nil {
			return err
		}
		if hitCeiling {
			if err := models.CreateOrderForAuctionCents(tx, a.ID, uid, amountCents); err != nil {
				return err
			}
		}

		response = gin.H{"data": gin.H{
			"message":             "出价成功",
			"current_price":       a.CurrentPrice,
			"current_price_cents": a.CurrentPriceCents,
			"ends_at":             a.EndsAt,
			"finished":            hitCeiling,
		}}
		return nil
	})
	if txErr != nil {
		if errors.Is(txErr, handled) {
			c.JSON(status, response)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": txErr.Error()})
		return
	}

	ws.H.Broadcast(a.ID, gin.H{
		"type":                "new_bid",
		"auction_id":          a.ID,
		"current_price":       a.CurrentPrice,
		"current_price_cents": a.CurrentPriceCents,
		"winner_id":           a.WinnerID,
		"ends_at":             a.EndsAt,
		"top_bids":            fetchTopBids(a.ID, 5),
	})

	if hitCeiling {
		ws.H.Broadcast(a.ID, gin.H{
			"type":              "auction_finished",
			"auction_id":        a.ID,
			"final_price":       a.CurrentPrice,
			"final_price_cents": a.CurrentPriceCents,
			"winner_id":         a.WinnerID,
		})
	}

	c.JSON(http.StatusOK, response)
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
		out[i] = topBidView{
			UserID:      b.UserID,
			Amount:      b.Amount,
			AmountCents: centsOrLegacy(b.AmountCents, b.Amount),
		}
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
