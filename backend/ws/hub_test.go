package ws

import (
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
