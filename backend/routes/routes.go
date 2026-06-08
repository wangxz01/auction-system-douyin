package routes

import (
	"auction-system/backend/config"
	"auction-system/backend/controllers"
	"auction-system/backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine) {
	cfg := config.Get()
	r.Use(cors.New(cors.Config{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))

	r.GET("/health", controllers.Health)
	r.Static("/uploads", "./uploads")

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
		api.GET("/auctions/:id/comments", controllers.GetComments)

		// 需要登录的接口
		auth := api.Group("")
		auth.Use(middleware.RequireAuth())
		{
			auth.GET("/auth/me", controllers.Me)

			auth.GET("/auctions/:id/order", controllers.GetOrder)
			auth.POST("/auctions", controllers.CreateAuction)
			auth.PUT("/auctions/:id", controllers.UpdateAuction)
			auth.POST("/auctions/:id/start", controllers.StartAuction)
			auth.POST("/auctions/:id/cancel", controllers.CancelAuction)
			auth.POST("/auctions/:id/bids", controllers.PlaceBid)
			auth.POST("/auctions/:id/comments", controllers.CreateComment)

			auth.GET("/admin/merchants", controllers.ListMerchants)
			auth.POST("/admin/merchants", controllers.UpsertMerchant)
			auth.DELETE("/admin/merchants/:user_id", controllers.DisableMerchant)
			auth.GET("/admin/orders", controllers.ListAdminOrders)
			auth.POST("/admin/uploads/images", controllers.UploadImage)

			// 当前用户的聚合数据
			auth.GET("/me/bids", controllers.GetMyBids)
			auth.GET("/me/orders", controllers.GetMyOrders)
		}
	}
}
