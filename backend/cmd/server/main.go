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

	config.InitDB(cfg)
	ws.InitHub()
	config.StartScheduler()

	gin.SetMode(cfg.ServerMode)
	r := gin.Default()

	routes.Register(r)

	addr := ":" + cfg.ServerPort
	log.Printf("auction-system backend listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
