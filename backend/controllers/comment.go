package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

const (
	defaultCommentLimit = 30
	maxCommentLimit     = 100
	maxCommentRunes     = 100
)

type createCommentReq struct {
	Content string `json:"content"`
}

func GetComments(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}

	limit := parseCommentLimit(c.Query("limit"))

	var comments []models.Comment
	if err := config.DB.
		Where("auction_id = ?", id).
		Order("created_at DESC, id DESC").
		Limit(limit).
		Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for i, j := 0, len(comments)-1; i < j; i, j = i+1, j-1 {
		comments[i], comments[j] = comments[j], comments[i]
	}

	c.JSON(http.StatusOK, gin.H{"data": comments})
}

func CreateComment(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}

	uid, ok := middleware.UserIDFrom(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	var req createCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "评论不能为空"})
		return
	}
	if len([]rune(content)) > maxCommentRunes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "评论不能超过 100 个字符"})
		return
	}

	var auction models.Auction
	if err := config.DB.First(&auction, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "竞拍不存在"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, uid).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
		return
	}

	comment := models.Comment{
		AuctionID: auction.ID,
		UserID:    user.ID,
		Username:  user.Username,
		Content:   content,
	}
	if err := config.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ws.H.Broadcast(auction.ID, gin.H{
		"type":       "new_comment",
		"auction_id": auction.ID,
		"comment":    comment,
	})

	c.JSON(http.StatusOK, gin.H{"data": comment})
}

func parseCommentLimit(raw string) int {
	if raw == "" {
		return defaultCommentLimit
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return defaultCommentLimit
	}
	if n > maxCommentLimit {
		return maxCommentLimit
	}
	return n
}
