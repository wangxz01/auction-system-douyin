package controllers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxUploadImageSize = 5 << 20

func UploadImage(c *gin.Context) {
	uid, username, ok := currentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}
	if !isAdminUsername(username) && !isActiveMerchant(uid) {
		c.JSON(http.StatusForbidden, gin.H{"error": "需要商家权限"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadImageSize)
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少上传文件"})
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 jpg/jpeg/png/webp/gif"})
		return
	}

	name := fmt.Sprintf("%d-%d%s", time.Now().UnixNano(), uid, ext)
	rel := filepath.Join("uploads", "images", name)
	if err := c.SaveUploadedFile(file, rel); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := c.GetHeader("X-Forwarded-Proto"); forwarded != "" {
		scheme = forwarded
	}
	url := scheme + "://" + c.Request.Host + "/" + filepath.ToSlash(rel)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"url": url}})
}
