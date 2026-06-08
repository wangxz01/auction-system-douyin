package controllers

import (
	"net/http"
	"sort"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

// MyBidEntry 是 /api/me/bids 返回的每一条聚合数据：
// 一场竞拍 + 我出过的最高价 + 我出价次数 + 我是否领先。
type MyBidEntry struct {
	Auction      models.Auction `json:"auction"`
	MyHighestBid float64        `json:"my_highest_bid"`
	MyBidCount   int            `json:"my_bid_count"`
	IsLeading    bool           `json:"is_leading"`
}

// GetMyBids 列出当前用户参与过的所有竞拍。
// 按 auction.updated_at 降序（最近活跃的在最前）。
func GetMyBids(c *gin.Context) {
	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	type agg struct {
		AuctionID uint    `gorm:"column:auction_id"`
		MyHighest float64 `gorm:"column:my_highest"`
		MyCount   int     `gorm:"column:my_count"`
	}
	var aggs []agg
	if err := config.DB.
		Table("bids").
		Select("auction_id, MAX(amount) AS my_highest, COUNT(*) AS my_count").
		Where("user_id = ?", uid).
		Group("auction_id").
		Scan(&aggs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(aggs) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []MyBidEntry{}})
		return
	}

	auctionIDs := make([]uint, len(aggs))
	for i, a := range aggs {
		auctionIDs[i] = a.AuctionID
	}

	var auctions []models.Auction
	if err := config.DB.Where("id IN ?", auctionIDs).Find(&auctions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	auctionMap := make(map[uint]models.Auction, len(auctions))
	for _, a := range auctions {
		auctionMap[a.ID] = a
	}

	result := make([]MyBidEntry, 0, len(aggs))
	for _, a := range aggs {
		auc, ok := auctionMap[a.AuctionID]
		if !ok {
			continue
		}
		leading := auc.WinnerID != nil && *auc.WinnerID == uid
		result = append(result, MyBidEntry{
			Auction:      auc,
			MyHighestBid: a.MyHighest,
			MyBidCount:   a.MyCount,
			IsLeading:    leading,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Auction.UpdatedAt.After(result[j].Auction.UpdatedAt)
	})

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// MyOrderEntry 是 /api/me/orders 返回的每一条：订单 + 对应竞拍。
type MyOrderEntry struct {
	Order   models.Order   `json:"order"`
	Auction models.Auction `json:"auction"`
}

// GetMyOrders 列出当前用户所有订单，按下单时间倒序。
func GetMyOrders(c *gin.Context) {
	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	var orders []models.Order
	if err := config.DB.
		Where("user_id = ?", uid).
		Order("created_at DESC").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(orders) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": []MyOrderEntry{}})
		return
	}

	auctionIDs := make([]uint, len(orders))
	for i, o := range orders {
		auctionIDs[i] = o.AuctionID
	}
	var auctions []models.Auction
	if err := config.DB.Where("id IN ?", auctionIDs).Find(&auctions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	auctionMap := make(map[uint]models.Auction, len(auctions))
	for _, a := range auctions {
		auctionMap[a.ID] = a
	}

	result := make([]MyOrderEntry, 0, len(orders))
	for _, o := range orders {
		auc, ok := auctionMap[o.AuctionID]
		if !ok {
			continue
		}
		result = append(result, MyOrderEntry{Order: o, Auction: auc})
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
