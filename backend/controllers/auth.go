package controllers

import (
	"net/http"
	"strings"
	"sync"
	"time"

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

const (
	loginFailureWindow   = time.Minute
	loginFailureLimit    = 5
	registerWindow       = 10 * time.Minute
	registerPerIPLimit   = 10
)

type loginFailureBucket struct {
	Count     int
	FirstSeen time.Time
}

var loginFailures = struct {
	sync.Mutex
	items map[string]loginFailureBucket
}{items: make(map[string]loginFailureBucket)}

// 注册节流（按 IP），用同样的 bucket 形态；与 login 失败计数器解耦。
var registerAttempts = struct {
	sync.Mutex
	items map[string]loginFailureBucket
}{items: make(map[string]loginFailureBucket)}

func Register(c *gin.Context) {
	// 注册节流：同一 IP 在 10 分钟内最多 10 次尝试（防被脚本刷注册）。
	ipKey := c.ClientIP()
	if isRegisterRateLimited(ipKey, time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "注册尝试过多，请稍后再试"})
		return
	}
	var req authReq
	if err := c.ShouldBindJSON(&req); err != nil {
		recordRegisterAttempt(ipKey, time.Now())
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	recordRegisterAttempt(ipKey, time.Now())
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
	req.Username = strings.TrimSpace(req.Username)
	key := loginFailureKey(c, req.Username)
	if isLoginRateLimited(key, time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "登录失败次数过多，请稍后再试"})
		return
	}
	var u models.User
	if err := config.DB.Where("username = ?", req.Username).First(&u).Error; err != nil {
		recordLoginFailure(key, time.Now())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		recordLoginFailure(key, time.Now())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}
	clearLoginFailures(key)
	token, err := middleware.IssueToken(u.ID, u.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "签发 token 失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": authResp{UserID: u.ID, Username: u.Username, Token: token}})
}

func loginFailureKey(c *gin.Context, username string) string {
	return c.ClientIP() + ":" + strings.ToLower(strings.TrimSpace(username))
}

func isLoginRateLimited(key string, now time.Time) bool {
	loginFailures.Lock()
	defer loginFailures.Unlock()
	b, ok := loginFailures.items[key]
	if !ok {
		return false
	}
	if now.Sub(b.FirstSeen) > loginFailureWindow {
		delete(loginFailures.items, key)
		return false
	}
	return b.Count >= loginFailureLimit
}

func recordLoginFailure(key string, now time.Time) {
	loginFailures.Lock()
	defer loginFailures.Unlock()
	b, ok := loginFailures.items[key]
	if !ok || now.Sub(b.FirstSeen) > loginFailureWindow {
		loginFailures.items[key] = loginFailureBucket{Count: 1, FirstSeen: now}
		return
	}
	b.Count++
	loginFailures.items[key] = b
}

func clearLoginFailures(key string) {
	loginFailures.Lock()
	defer loginFailures.Unlock()
	delete(loginFailures.items, key)
}

func isRegisterRateLimited(key string, now time.Time) bool {
	registerAttempts.Lock()
	defer registerAttempts.Unlock()
	b, ok := registerAttempts.items[key]
	if !ok {
		return false
	}
	if now.Sub(b.FirstSeen) > registerWindow {
		delete(registerAttempts.items, key)
		return false
	}
	return b.Count >= registerPerIPLimit
}

func recordRegisterAttempt(key string, now time.Time) {
	registerAttempts.Lock()
	defer registerAttempts.Unlock()
	b, ok := registerAttempts.items[key]
	if !ok || now.Sub(b.FirstSeen) > registerWindow {
		registerAttempts.items[key] = loginFailureBucket{Count: 1, FirstSeen: now}
		return
	}
	b.Count++
	registerAttempts.items[key] = b
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
