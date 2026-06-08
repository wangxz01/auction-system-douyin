package controllers

import (
	"log"
	"net/http"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	pingPeriod = 30 * time.Second
	pongWait   = 60 * time.Second
	writeWait  = 10 * time.Second
	readLimit  = 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		for _, allowed := range config.Get().AllowedOrigins {
			if allowed == "*" || allowed == origin {
				return true
			}
		}
		return false
	},
}

func HandleWS(c *gin.Context) {
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id 不合法"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WS 升级失败: %v", err)
		return
	}

	client := &ws.Client{
		AuctionID: id,
		Conn:      conn,
		Send:      make(chan []byte, 16),
	}
	ws.H.Register(client)

	go writePump(client)
	go readPump(client)
}

// readPump 持续读取客户端消息。
// 主要用于心跳：客户端的任何消息（包括 pong 帧）都会刷新读超时。
// 60 秒内没收到任何消息则视为断线，自动关闭。
func readPump(c *ws.Client) {
	defer func() {
		ws.H.Unregister(c)
		_ = c.Conn.Close()
	}()

	c.Conn.SetReadLimit(readLimit)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS 读异常 auction=%d: %v", c.AuctionID, err)
			}
			return
		}
		// 业务上当前不接收客户端消息，收到任意消息只视为心跳
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	}
}

// writePump 负责两件事：
//  1. 把 Hub 通过 c.Send 推过来的消息发给客户端
//  2. 每 30 秒发一次 ping，配合 readPump 的 pong handler 检测连接死活
func writePump(c *ws.Client) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub 关闭了通道，发个 Close 帧再退出
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
