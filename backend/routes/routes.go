package routes

import (
	"auction-system/backend/controllers"
	"auction-system/backend/middleware"

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

	// WebSocket（不鉴权，订阅是只读的）
	r.GET("/ws/auctions/:id", controllers.HandleWS)

	api := r.Group("/api")
	{
		// 鉴权相关：注册/登录公开
		api.POST("/auth/register", controllers.Register)
		api.POST("/auth/login", controllers.Login)

		// 公开读接口
		api.GET("/auctions", controllers.GetAuctions)
		api.GET("/auctions/:id", controllers.GetAuction)
		api.GET("/auctions/:id/bids", controllers.GetBids)
		api.GET("/auctions/:id/order", controllers.GetOrder)

		// 需要登录的接口
		auth := api.Group("")
		auth.Use(middleware.RequireAuth())
		{
			auth.GET("/auth/me", controllers.Me)

			auth.POST("/auctions", controllers.CreateAuction)
			auth.POST("/auctions/:id/start", controllers.StartAuction)
			auth.POST("/auctions/:id/cancel", controllers.CancelAuction)
			auth.POST("/auctions/:id/bids", controllers.PlaceBid)

			// 当前用户的聚合数据
			auth.GET("/me/bids", controllers.GetMyBids)
			auth.GET("/me/orders", controllers.GetMyOrders)
		}
	}
}
