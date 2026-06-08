package controllers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
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
	ClientBidID string   `json:"client_bid_id"`
}

const (
	autoExtendThreshold = 30 * time.Second
	bidRateLimitWindow  = 700 * time.Millisecond
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
	clientBidID := strings.TrimSpace(req.ClientBidID)
	if clientBidID == "" {
		clientBidID = strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	}
	if len(clientBidID) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "client_bid_id 不能超过 64 个字符"})
		return
	}

	lockValue := fmt.Sprintf("%d:%s:%d", uid, clientBidID, time.Now().UnixNano())
	releaseLock, locked := config.WithAuctionBidLock(context.Background(), id, lockValue, 3*time.Second)
	if !locked {
		c.JSON(http.StatusConflict, gin.H{"error": "出价处理中，请稍后重试"})
		return
	}
	defer releaseLock()

	var a models.Auction
	var hitCeiling bool
	var autoExtended bool
	var duplicateBid bool
	var participantCount int64
	var response gin.H
	var status = http.StatusOK
	handled := errors.New("handled")

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&a, id).Error; err != nil {
			status = http.StatusNotFound
			response = gin.H{"error": "竞拍不存在"}
			return handled
		}

		if clientBidID != "" {
			var existing models.Bid
			err := tx.Where("auction_id = ? AND user_id = ? AND client_bid_id = ?", a.ID, uid, clientBidID).
				First(&existing).Error
			if err == nil {
				duplicateBid = true
				participantCount = countParticipantsTx(tx, a.ID)
				response = gin.H{"data": gin.H{
					"message":             "重复出价已忽略",
					"duplicate":           true,
					"current_price":       a.CurrentPrice,
					"current_price_cents": a.CurrentPriceCents,
					"ends_at":             a.EndsAt,
					"finished":            a.Status == "finished",
					"participant_count":   participantCount,
					"server_time":         time.Now().UTC().Format(time.RFC3339Nano),
				}}
				return nil
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
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
		if rateLimited, err := isBidRateLimited(tx, a.ID, uid, now); err != nil {
			return err
		} else if rateLimited {
			status = http.StatusTooManyRequests
			response = gin.H{"error": "出价太频繁，请稍后再试"}
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

		var storedClientBidID *string
		if clientBidID != "" {
			storedClientBidID = &clientBidID
		}
		bid := models.Bid{
			AuctionID:   a.ID,
			UserID:      uid,
			Amount:      centsToFloat(amountCents),
			AmountCents: amountCents,
			ClientBidID: storedClientBidID,
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
			autoExtended = true
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
		participantCount = countParticipantsTx(tx, a.ID)

		response = gin.H{"data": gin.H{
			"message":             "出价成功",
			"current_price":       a.CurrentPrice,
			"current_price_cents": a.CurrentPriceCents,
			"ends_at":             a.EndsAt,
			"finished":            hitCeiling,
			"auto_extended":       autoExtended,
			"participant_count":   participantCount,
			"server_time":         time.Now().UTC().Format(time.RFC3339Nano),
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

	if !duplicateBid {
		invalidateAuctionCache(a.ID)
		ws.H.Broadcast(a.ID, gin.H{
			"type":                "new_bid",
			"auction_id":          a.ID,
			"current_price":       a.CurrentPrice,
			"current_price_cents": a.CurrentPriceCents,
			"winner_id":           a.WinnerID,
			"ends_at":             a.EndsAt,
			"top_bids":            fetchTopBids(a.ID, 5),
			"participant_count":   participantCount,
			"auto_extended":       autoExtended,
			"auto_extend_seconds": a.AutoExtendSeconds,
			"server_time":         time.Now().UTC().Format(time.RFC3339Nano),
		})
	}

	if hitCeiling {
		ws.H.Broadcast(a.ID, gin.H{
			"type":              "auction_finished",
			"auction_id":        a.ID,
			"final_price":       a.CurrentPrice,
			"final_price_cents": a.CurrentPriceCents,
			"winner_id":         a.WinnerID,
			"server_time":       time.Now().UTC().Format(time.RFC3339Nano),
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

func countBids(auctionID uint) int64 {
	var count int64
	config.DB.Model(&models.Bid{}).Where("auction_id = ?", auctionID).Count(&count)
	return count
}

func countParticipants(auctionID uint) int64 {
	return countParticipantsTx(config.DB, auctionID)
}

func countParticipantsTx(db *gorm.DB, auctionID uint) int64 {
	var count int64
	db.Model(&models.Bid{}).
		Where("auction_id = ?", auctionID).
		Distinct("user_id").
		Count(&count)
	return count
}

func isBidRateLimited(db *gorm.DB, auctionID uint, userID uint, now time.Time) (bool, error) {
	var count int64
	err := db.Model(&models.Bid{}).
		Where("auction_id = ? AND user_id = ? AND created_at >= ?", auctionID, userID, now.Add(-bidRateLimitWindow)).
		Count(&count).Error
	return count > 0, err
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
