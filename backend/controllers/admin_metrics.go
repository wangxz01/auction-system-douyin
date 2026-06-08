package controllers

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

type AdminMetrics struct {
	ActiveAuctions      int64 `json:"active_auctions"`
	OnlineWSConnections int   `json:"online_ws_connections"`
	ActiveRooms         int   `json:"active_rooms"`
	TotalBidsToday      int64 `json:"total_bids_today"`
	RedisAvailable      bool  `json:"redis_available"`
	DBAvailable         bool  `json:"db_available"`
}

func GetAdminMetrics(c *gin.Context) {
	if _, _, ok := requireAdmin(c); !ok {
		return
	}

	var activeAuctions int64
	config.DB.Model(&models.Auction{}).
		Where("status = ?", "active").
		Count(&activeAuctions)

	startOfDay := time.Now().Truncate(24 * time.Hour)
	var totalBidsToday int64
	config.DB.Model(&models.Bid{}).
		Where("created_at >= ?", startOfDay).
		Count(&totalBidsToday)

	wsMetrics := ws.H.Metrics()
	c.JSON(http.StatusOK, gin.H{"data": AdminMetrics{
		ActiveAuctions:      activeAuctions,
		OnlineWSConnections: wsMetrics.OnlineConnections,
		ActiveRooms:         wsMetrics.ActiveRooms,
		TotalBidsToday:      totalBidsToday,
		RedisAvailable:      redisAvailable(),
		DBAvailable:         dbAvailable(),
	}})
}

func redisAvailable() bool {
	if config.Redis == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	return config.Redis.Ping(ctx).Err() == nil
}

func dbAvailable() bool {
	sqlDB, err := config.DB.DB()
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	return pingDB(ctx, sqlDB) == nil
}

func pingDB(ctx context.Context, db *sql.DB) error {
	return db.PingContext(ctx)
}
