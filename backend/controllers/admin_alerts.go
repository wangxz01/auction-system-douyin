package controllers

import (
	"fmt"
	"net/http"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

type AdminAlert struct {
	Severity  string `json:"severity"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}

func GetAdminAlerts(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": buildAdminAlerts()})
}

func buildAdminAlerts() []AdminAlert {
	now := time.Now()
	alerts := make([]AdminAlert, 0)
	add := func(severity, code, message string) {
		alerts = append(alerts, AdminAlert{
			Severity:  severity,
			Code:      code,
			Message:   message,
			CreatedAt: now.UTC().Format(time.RFC3339Nano),
		})
	}

	if !dbAvailable() {
		add("critical", "db_unavailable", "数据库健康检查失败")
		return alerts
	}
	if !redisAvailable() {
		add("warning", "redis_unavailable", "Redis 不可用，出价锁和读缓存已降级到 MySQL 行锁")
	}

	var stale []models.Auction
	config.DB.
		Select("id").
		Where("status = ? AND ends_at IS NOT NULL AND ends_at <= ?", "active", now).
		Limit(5).
		Find(&stale)
	for _, auction := range stale {
		add("warning", "stale_active_auction", fmt.Sprintf("竞拍 %d 已到结束时间但仍为 active，等待定时器处理", auction.ID))
	}

	limit := config.Get().MaxWSConnections
	if limit > 0 {
		metrics := ws.H.Metrics()
		if metrics.OnlineConnections*100 >= limit*80 {
			add("warning", "ws_capacity_high", fmt.Sprintf("WebSocket 在线连接 %d/%d，接近容量上限", metrics.OnlineConnections, limit))
		}
	}
	return alerts
}
