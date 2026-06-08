package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/middleware"
	"auction-system/backend/models"
	"auction-system/backend/routes"
	"auction-system/backend/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func setupCommentTest(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	if config.DB == nil {
		config.InitDB(config.Load())
	}
	ws.InitHub()
	r := gin.New()
	routes.Register(r)
	return r
}

func createCommentTestUser(t *testing.T) models.User {
	t.Helper()
	u := models.User{
		Username:     "commenter-" + time.Now().Format("20060102150405.000000000"),
		PasswordHash: "test",
	}
	if err := config.DB.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Delete(&models.User{}, u.ID)
	})
	return u
}

func createCommentTestAuction(t *testing.T) models.Auction {
	t.Helper()
	a := models.Auction{
		Title:           "comment test auction",
		StartPrice:      100,
		PriceStep:       10,
		CurrentPrice:    100,
		DurationSeconds: 300,
		Status:          "active",
	}
	if err := config.DB.Create(&a).Error; err != nil {
		t.Fatalf("create auction: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Where("auction_id = ?", a.ID).Delete(&models.Comment{})
		config.DB.Delete(&models.Auction{}, a.ID)
	})
	return a
}

func authHeader(t *testing.T, u models.User) string {
	t.Helper()
	token, err := middleware.IssueToken(u.ID, u.Username)
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	return "Bearer " + token
}

func TestCreateCommentStoresAndBroadcastsNewComment(t *testing.T) {
	r := setupCommentTest(t)
	u := createCommentTestUser(t)
	a := createCommentTestAuction(t)

	client := &ws.Client{
		AuctionID: a.ID,
		Conn:      &websocket.Conn{},
		Send:      make(chan []byte, 1),
	}
	ws.H.Register(client)
	t.Cleanup(func() {
		ws.H.Unregister(client)
	})

	body := bytes.NewBufferString(`{"content":"  这个不错  "}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auctions/1/comments", body)
	req.URL.Path = "/api/auctions/" + uintString(a.ID) + "/comments"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, u))
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data models.Comment `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Data.Content != "这个不错" {
		t.Fatalf("content = %q", resp.Data.Content)
	}
	if resp.Data.UserID != u.ID || resp.Data.Username != u.Username || resp.Data.AuctionID != a.ID {
		t.Fatalf("unexpected comment user or auction: %+v", resp.Data)
	}

	var stored models.Comment
	if err := config.DB.First(&stored, resp.Data.ID).Error; err != nil {
		t.Fatalf("comment not stored: %v", err)
	}

	select {
	case raw := <-client.Send:
		var event struct {
			Type      string         `json:"type"`
			AuctionID uint           `json:"auction_id"`
			Comment   models.Comment `json:"comment"`
		}
		if err := json.Unmarshal(raw, &event); err != nil {
			t.Fatalf("decode broadcast: %v", err)
		}
		if event.Type != "new_comment" || event.AuctionID != a.ID || event.Comment.ID != resp.Data.ID {
			t.Fatalf("unexpected broadcast: %+v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for new_comment broadcast")
	}
}

func TestCreateCommentRejectsEmptyContent(t *testing.T) {
	r := setupCommentTest(t)
	u := createCommentTestUser(t)
	a := createCommentTestAuction(t)

	req := httptest.NewRequest(http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/comments", bytes.NewBufferString(`{"content":"   "}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, u))
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestGetCommentsReturnsRecentLimitedCommentsInDisplayOrder(t *testing.T) {
	r := setupCommentTest(t)
	u := createCommentTestUser(t)
	a := createCommentTestAuction(t)

	comments := []models.Comment{
		{AuctionID: a.ID, UserID: u.ID, Username: u.Username, Content: "oldest"},
		{AuctionID: a.ID, UserID: u.ID, Username: u.Username, Content: "middle"},
		{AuctionID: a.ID, UserID: u.ID, Username: u.Username, Content: "newest"},
	}
	for i := range comments {
		if err := config.DB.Create(&comments[i]).Error; err != nil {
			t.Fatalf("create comment %d: %v", i, err)
		}
		time.Sleep(time.Millisecond)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/comments?limit=2", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data []models.Comment `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("len = %d, data = %+v", len(resp.Data), resp.Data)
	}
	if resp.Data[0].Content != "middle" || resp.Data[1].Content != "newest" {
		t.Fatalf("unexpected order: %+v", resp.Data)
	}
}

func uintString(v uint) string {
	return strconv.FormatUint(uint64(v), 10)
}
