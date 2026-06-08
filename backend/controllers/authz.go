package controllers

import (
	"net/http"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func isAdminUsername(username string) bool {
	for _, admin := range config.Get().AdminUsernames {
		if admin == username {
			return true
		}
	}
	return false
}

func currentUser(c *gin.Context) (uint, string, bool) {
	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		return 0, "", false
	}
	username, _ := middleware.UsernameFrom(c)
	return uid, username, true
}

func requireAdmin(c *gin.Context) (uint, string, bool) {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return 0, "", false
	}
	if !isAdminUsername(username) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
		return 0, "", false
	}
	return uid, username, true
}

func isActiveMerchant(userID uint) bool {
	var m models.Merchant
	err := config.DB.
		Where("user_id = ? AND status = ?", userID, "active").
		First(&m).Error
	return err == nil
}

func canCreateAuction(c *gin.Context) (uint, bool) {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return 0, false
	}
	if isAdminUsername(username) || isActiveMerchant(uid) {
		return uid, true
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "需要商家权限"})
	return 0, false
}

func canManageAuction(c *gin.Context, a models.Auction) bool {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return false
	}
	if isAdminUsername(username) {
		return true
	}
	if a.SellerUserID != 0 && a.SellerUserID == uid && isActiveMerchant(uid) {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "无权管理该竞拍"})
	return false
}

func canViewOrder(c *gin.Context, order models.Order, auction models.Auction) bool {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return false
	}
	if isAdminUsername(username) || order.UserID == uid {
		return true
	}
	if auction.SellerUserID != 0 && auction.SellerUserID == uid && isActiveMerchant(uid) {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "无权查看该订单"})
	return false
}

func isNotFound(err error) bool {
	return err == gorm.ErrRecordNotFound
}
