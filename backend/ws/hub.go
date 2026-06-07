package ws

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// Client 表示一个 WebSocket 连接。
// Send 是出站消息缓冲；Hub 通过往这里塞数据来向客户端推送。
type Client struct {
	AuctionID uint
	Conn      *websocket.Conn
	Send      chan []byte
}

// roomEvent 是 Hub 内部用的广播事件。
type roomEvent struct {
	auctionID uint
	payload   []byte
}

// Hub 维护所有按 auction_id 分组的客户端连接，并通过 channel 串行化所有操作，
// 避免并发读写 map 引发 panic。
type Hub struct {
	rooms      map[uint]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan roomEvent
}

// H 是全局 Hub 实例。main 启动时调 InitHub() 初始化。
var H *Hub

func InitHub() {
	H = &Hub{
		rooms:      make(map[uint]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan roomEvent, 256),
	}
	go H.run()
	log.Println("✅ WebSocket Hub 已启动")
}

func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			if _, ok := h.rooms[c.AuctionID]; !ok {
				h.rooms[c.AuctionID] = make(map[*Client]bool)
			}
			h.rooms[c.AuctionID][c] = true
			log.Printf("📡 客户端加入房间 auction=%d，房间人数=%d", c.AuctionID, len(h.rooms[c.AuctionID]))

		case c := <-h.unregister:
			if room, ok := h.rooms[c.AuctionID]; ok {
				if _, exists := room[c]; exists {
					delete(room, c)
					close(c.Send)
					log.Printf("📡 客户端离开房间 auction=%d，房间人数=%d", c.AuctionID, len(room))
					if len(room) == 0 {
						delete(h.rooms, c.AuctionID)
					}
				}
			}

		case ev := <-h.broadcast:
			room, ok := h.rooms[ev.auctionID]
			if !ok {
				continue
			}
			for c := range room {
				select {
				case c.Send <- ev.payload:
				default:
					// 客户端发送缓冲满（慢客户端），直接踢掉避免拖垮 Hub。
					close(c.Send)
					delete(room, c)
				}
			}
		}
	}
}

func (h *Hub) Register(c *Client)   { h.register <- c }
func (h *Hub) Unregister(c *Client) { h.unregister <- c }

// Broadcast 把 msg 序列化为 JSON 并推送到指定房间。
// 如果房间不存在（没人订阅），消息直接丢弃，不会报错。
func (h *Hub) Broadcast(auctionID uint, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Hub Broadcast 序列化失败: %v", err)
		return
	}
	select {
	case h.broadcast <- roomEvent{auctionID: auctionID, payload: data}:
	default:
		log.Printf("Hub broadcast channel 已满，丢弃 auction=%d 消息", auctionID)
	}
}
