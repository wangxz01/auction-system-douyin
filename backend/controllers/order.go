package controllers

import (
	"net/http"

	"auction-system/backend/config"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

func GetOrder(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}
	var o models.Order
	if err := config.DB.Where("auction_id = ?", id).First(&o).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}
	var a models.Auction
	if err := config.DB.First(&a, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}
	if !canViewOrder(c, o, a) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": o})
}

// createOrder 是 controllers 包内部使用的便捷封装。
// 不暴露为 HTTP 接口，供竞拍结束（封顶价命中）时调用。
// 定时器在 config/scheduler.go 中直接调 models.CreateOrderForAuction（避免 import 循环）。
func createOrder(auctionID, userID uint, finalPrice float64) error {
	return models.CreateOrderForAuction(config.DB, auctionID, userID, finalPrice)
}

func createOrderCents(auctionID, userID uint, finalPriceCents int64) error {
	return models.CreateOrderForAuctionCents(config.DB, auctionID, userID, finalPriceCents)
}
