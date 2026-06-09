package controllers

import (
	"net/http"
	"strings"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DemoUser struct {
	ID           uint   `json:"id"`
	Username     string `json:"username"`
	Role         string `json:"role"`
	Merchant     string `json:"merchant"`
	BidCount     int64  `json:"bid_count"`
	OrderCount   int64  `json:"order_count"`
	AuctionCount int64  `json:"auction_count"`
}

func AdminFinishAuction(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}

	var out models.Auction
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var a models.Auction
		if err := tx.First(&a, id).Error; err != nil {
			return err
		}
		if a.Status != "active" && a.Status != "pending" {
			return errBadRequest("当前状态不能强制结束: " + a.Status)
		}
		now := time.Now()
		if a.StartedAt == nil {
			a.StartedAt = &now
		}
		a.EndsAt = &now
		a.Status = "finished"
		if err := tx.Save(&a).Error; err != nil {
			return err
		}
		if a.WinnerID != nil {
			var existing int64
			if err := tx.Model(&models.Order{}).Where("auction_id = ?", a.ID).Count(&existing).Error; err != nil {
				return err
			}
			if existing == 0 {
				final := a.CurrentPriceCents
				if final == 0 && a.CurrentPrice > 0 {
					final = int64(a.CurrentPrice*100 + 0.5)
				}
				if err := models.CreateOrderForAuctionCents(tx, a.ID, *a.WinnerID, final); err != nil {
					return err
				}
			}
		}
		out = a
		return nil
	})
	if err != nil {
		writeAdminDemoError(c, err)
		return
	}
	invalidateAuctionCache(out.ID)
	ws.H.Broadcast(out.ID, gin.H{
		"type":              "auction_finished",
		"auction_id":        out.ID,
		"final_price":       out.CurrentPrice,
		"final_price_cents": out.CurrentPriceCents,
		"winner_id":         out.WinnerID,
		"server_time":       time.Now().UTC().Format(time.RFC3339Nano),
	})
	c.JSON(http.StatusOK, gin.H{"data": out})
}

func AdminDeleteAuction(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	if err := config.DB.Transaction(func(tx *gorm.DB) error {
		return deleteAuctionTree(tx, id)
	}); err != nil {
		writeAdminDemoError(c, err)
		return
	}
	invalidateAuctionCache(id)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true, "auction_id": id}})
}

func ListDemoUsers(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	var users []models.User
	if err := config.DB.
		Where("username LIKE ?", "demo-%").
		Order("username ASC").
		Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	out := make([]DemoUser, 0, len(users))
	for _, u := range users {
		entry := DemoUser{ID: u.ID, Username: u.Username, Role: "buyer"}
		var merchant models.Merchant
		if err := config.DB.Where("user_id = ?", u.ID).First(&merchant).Error; err == nil {
			entry.Role = "merchant"
			entry.Merchant = merchant.DisplayName
		}
		config.DB.Model(&models.Bid{}).Where("user_id = ?", u.ID).Count(&entry.BidCount)
		config.DB.Model(&models.Order{}).Where("user_id = ?", u.ID).Count(&entry.OrderCount)
		config.DB.Model(&models.Auction{}).Where("seller_user_id = ?", u.ID).Count(&entry.AuctionCount)
		out = append(out, entry)
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

func DeleteDemoUser(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		var u models.User
		if err := tx.First(&u, id).Error; err != nil {
			return err
		}
		if !strings.HasPrefix(u.Username, "demo-") {
			return errBadRequest("只允许从后台物理删除 demo- 前缀演示用户")
		}

		var auctions []models.Auction
		if err := tx.Select("id").Where("seller_user_id = ?", u.ID).Find(&auctions).Error; err != nil {
			return err
		}
		for _, a := range auctions {
			if err := deleteAuctionTree(tx, a.ID); err != nil {
				return err
			}
		}

		if err := tx.Where("user_id = ?", u.ID).Delete(&models.Merchant{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", u.ID).Delete(&models.Bid{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", u.ID).Delete(&models.Comment{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", u.ID).Delete(&models.UserEvent{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", u.ID).Delete(&models.Order{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Auction{}).Where("winner_id = ?", u.ID).Update("winner_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&models.User{}, u.ID).Error
	})
	if err != nil {
		writeAdminDemoError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true, "user_id": id}})
}

func deleteAuctionTree(tx *gorm.DB, auctionID uint) error {
	var a models.Auction
	if err := tx.Select("id").First(&a, auctionID).Error; err != nil {
		return err
	}
	if err := tx.Where("auction_id = ?", auctionID).Delete(&models.Order{}).Error; err != nil {
		return err
	}
	if err := tx.Where("auction_id = ?", auctionID).Delete(&models.Bid{}).Error; err != nil {
		return err
	}
	if err := tx.Where("auction_id = ?", auctionID).Delete(&models.Comment{}).Error; err != nil {
		return err
	}
	if err := tx.Where("auction_id = ?", auctionID).Delete(&models.UserEvent{}).Error; err != nil {
		return err
	}
	return tx.Delete(&models.Auction{}, auctionID).Error
}

type adminDemoBadRequest string

func (e adminDemoBadRequest) Error() string { return string(e) }

func errBadRequest(msg string) error { return adminDemoBadRequest(msg) }

func writeAdminDemoError(c *gin.Context, err error) {
	if isNotFound(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "资源不存在"})
		return
	}
	if bad, ok := err.(adminDemoBadRequest); ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": bad.Error()})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
