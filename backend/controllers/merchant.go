package controllers

import (
	"net/http"
	"strings"

	"auction-system/backend/config"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type upsertMerchantReq struct {
	UserID      uint   `json:"user_id"`
	DisplayName string `json:"display_name"`
}

func ListMerchants(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	var merchants []models.Merchant
	if err := config.DB.Order("created_at DESC").Find(&merchants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": merchants})
}

func UpsertMerchant(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	var req upsertMerchantReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}
	if req.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id 必填"})
		return
	}
	var user models.User
	if err := config.DB.First(&user, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = user.Username
	}

	var merchant models.Merchant
	err := config.DB.Where("user_id = ?", req.UserID).First(&merchant).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	merchant.UserID = req.UserID
	merchant.DisplayName = displayName
	merchant.Status = "active"
	if err == gorm.ErrRecordNotFound {
		if err := config.DB.Create(&merchant).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else if err := config.DB.Save(&merchant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": merchant})
}

func DisableMerchant(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	id, err := parseID(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id 不合法"})
		return
	}
	var merchant models.Merchant
	if err := config.DB.Where("user_id = ?", id).First(&merchant).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "商家不存在"})
		return
	}
	merchant.Status = "disabled"
	if err := config.DB.Save(&merchant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": merchant})
}
