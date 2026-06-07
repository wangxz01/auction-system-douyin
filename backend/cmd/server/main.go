package main

import (
	"log"

	"auction-system/backend/config"
	"auction-system/backend/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	config.InitDB(cfg)
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
