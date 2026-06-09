package main

import (
	"log"

	"auction-system/backend/config"
	"auction-system/backend/routes"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if err := config.ValidateSecurity(cfg); err != nil {
		log.Fatalf("配置校验失败: %v", err)
	}
	config.SetActive(cfg)

	config.InitDB(cfg)
	config.InitRedis(cfg)
	ws.InitHub(cfg.MaxWSConnections)
	config.StartScheduler()

	// 演示种子（SEED_DEMO_DATA=true 时首启灌入；已存在则跳过）
	config.SeedDemoData(config.DB)

	gin.SetMode(cfg.ServerMode)
	r := gin.Default()

	routes.Register(r)

	addr := ":" + cfg.ServerPort
	log.Printf("auction-system backend listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
