package controllers

import (
	"net/http"
	"strings"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type authReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResp struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Token    string `json:"token"`
}

func Register(c *gin.Context) {
	var req authReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 2 || len(req.Username) > 32 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名长度需在 2~32 字符之间"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码至少 6 位"})
		return
	}

	// 检查用户名是否已存在
	var existing models.User
	if err := config.DB.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名已被占用"})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	u := models.User{Username: req.Username, PasswordHash: string(hash)}
	if err := config.DB.Create(&u).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	token, err := middleware.IssueToken(u.ID, u.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "签发 token 失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": authResp{UserID: u.ID, Username: u.Username, Token: token}})
}

func Login(c *gin.Context) {
	var req authReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}
	var u models.User
	if err := config.DB.Where("username = ?", req.Username).First(&u).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	token, err := middleware.IssueToken(u.ID, u.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "签发 token 失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": authResp{UserID: u.ID, Username: u.Username, Token: token}})
}

// Me 返回当前登录用户信息（需 RequireAuth 中间件）。
func Me(c *gin.Context) {
	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}
	var u models.User
	if err := config.DB.First(&u, uid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"user_id": u.ID, "username": u.Username}})
}
