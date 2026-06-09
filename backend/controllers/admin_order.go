package controllers

import (
	"net/http"

	"auction-system/backend/config"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

type AdminOrderEntry struct {
	Order   models.Order   `json:"order"`
	Auction models.Auction `json:"auction"`
}

func ListAdminOrders(c *gin.Context) {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}
	limit, offset := parsePagination(c, 100, 200)

	// base 用于 total count 与列表查询；非管理员只看自己卖出的订单。
	base := config.DB.Table("orders").Joins("JOIN auctions ON auctions.id = orders.auction_id")
	if !isAdminUsername(username) {
		if !isActiveMerchant(uid) {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要商家权限"})
			return
		}
		base = base.Where("auctions.seller_user_id = ?", uid)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var orders []models.Order
	if err := base.Select("orders.*").
		Order("orders.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(orders) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data": []AdminOrderEntry{},
			"meta": pageMeta{Total: total, Limit: limit, Offset: offset},
		})
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

	result := make([]AdminOrderEntry, 0, len(orders))
	for _, o := range orders {
		if auction, ok := auctionMap[o.AuctionID]; ok {
			result = append(result, AdminOrderEntry{Order: o, Auction: auction})
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"data": result,
		"meta": pageMeta{Total: total, Limit: limit, Offset: offset},
	})
}
