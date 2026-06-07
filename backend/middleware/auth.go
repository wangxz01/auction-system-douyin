package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"auction-system/backend/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	CtxUserIDKey   = "user_id"
	CtxUsernameKey = "username"
)

type Claims struct {
	UserID   uint   `json:"uid"`
	Username string `json:"usr"`
	jwt.RegisteredClaims
}

// IssueToken 用配置里的 JWTSecret 签发 JWT。
func IssueToken(userID uint, username string) (string, error) {
	hours, _ := strconv.Atoi(getCfg().JWTExpireHours)
	if hours <= 0 {
		hours = 72
	}
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(hours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "auction-system",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(getCfg().JWTSecret))
}

// RequireAuth 中间件：从 Authorization: Bearer <token> 读 JWT，
// 成功则把 user_id / username 写入 gin.Context；失败返回 401。
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "缺少 Authorization Bearer token"})
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")
		claims := &Claims{}
		_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(getCfg().JWTSecret), nil
		})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token 无效或已过期"})
			return
		}
		c.Set(CtxUserIDKey, claims.UserID)
		c.Set(CtxUsernameKey, claims.Username)
		c.Next()
	}
}

// UserIDFrom 从 gin.Context 取出 RequireAuth 注入的 user_id。
func UserIDFrom(c *gin.Context) (uint, bool) {
	v, ok := c.Get(CtxUserIDKey)
	if !ok {
		return 0, false
	}
	id, ok := v.(uint)
	return id, ok
}

// getCfg 每次重新加载一份 config，避免循环依赖（不缓存）。
// 实际使用时性能可忽略；如果在意可以改成包级 var + Init 注入。
func getCfg() *config.Config {
	return config.Load()
}
