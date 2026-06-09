package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestRegisterRejectsConnectionsAboveLimit(t *testing.T) {
	InitHub(1)

	first := &Client{AuctionID: 1, Conn: &websocket.Conn{}, Send: make(chan []byte, 1)}
	second := &Client{AuctionID: 1, Conn: &websocket.Conn{}, Send: make(chan []byte, 1)}

	if !H.Register(first) {
		t.Fatal("first connection should be accepted")
	}
	t.Cleanup(func() { H.Unregister(first) })

	if H.Register(second) {
		t.Fatal("second connection should be rejected by max connection limit")
	}

	deadline := time.After(time.Second)
	for {
		select {
		case <-deadline:
			t.Fatal("metrics did not reflect the accepted connection")
		default:
			metrics := H.Metrics()
			if metrics.OnlineConnections == 1 {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
	}
}

func TestBroadcastFanoutToLargeRoom(t *testing.T) {
	const clientsCount = 1000
	InitHub(clientsCount)

	clients := make([]*Client, 0, clientsCount)
	for i := 0; i < clientsCount; i++ {
		c := &Client{AuctionID: 99, Conn: &websocket.Conn{}, Send: make(chan []byte, 1)}
		if !H.Register(c) {
			t.Fatalf("register client %d rejected", i)
		}
		clients = append(clients, c)
	}
	t.Cleanup(func() {
		for _, c := range clients {
			H.Unregister(c)
		}
	})

	deadline := time.After(2 * time.Second)
	for {
		metrics := H.Metrics()
		if metrics.ActiveRooms == 1 && metrics.OnlineConnections == clientsCount {
			break
		}
		select {
		case <-deadline:
			t.Fatalf("metrics = %+v; want 1 room and %d connections", metrics, clientsCount)
		default:
			time.Sleep(10 * time.Millisecond)
		}
	}

	H.Broadcast(99, map[string]any{"type": "new_bid", "auction_id": 99, "current_price_cents": 12300})

	for i, c := range clients {
		select {
		case raw := <-c.Send:
			var event struct {
				Type              string `json:"type"`
				AuctionID         uint   `json:"auction_id"`
				CurrentPriceCents int64  `json:"current_price_cents"`
			}
			if err := json.Unmarshal(raw, &event); err != nil {
				t.Fatalf("client %d received invalid json: %v", i, err)
			}
			if event.Type != "new_bid" || event.AuctionID != 99 || event.CurrentPriceCents != 12300 {
				t.Fatalf("client %d received unexpected event: %+v", i, event)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("client %d did not receive broadcast", i)
		}
	}
}
