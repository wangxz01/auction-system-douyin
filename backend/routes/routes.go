package routes

import (
	"auction-system/backend/controllers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine) {
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))

	r.GET("/health", controllers.Health)

	// WebSocket 实时通道：每个 auction_id 独立房间
	r.GET("/ws/auctions/:id", controllers.HandleWS)

	api := r.Group("/api")
	{
		api.POST("/auctions", controllers.CreateAuction)
		api.GET("/auctions", controllers.GetAuctions)
		api.GET("/auctions/:id", controllers.GetAuction)
		api.POST("/auctions/:id/start", controllers.StartAuction)
		api.POST("/auctions/:id/cancel", controllers.CancelAuction)

		api.POST("/auctions/:id/bids", controllers.PlaceBid)
		api.GET("/auctions/:id/bids", controllers.GetBids)

		api.GET("/auctions/:id/order", controllers.GetOrder)
	}
}
