package controllers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"auction-system/backend/config"
	"auction-system/backend/models"
)

func TestCreateAuctionEventStoresUserBehavior(t *testing.T) {
	r := setupCommentTest(t)
	user := createNamedUser(t, "event-user")
	auction := createCommentTestAuction(t)

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(auction.ID)+"/events", `{"event_type":"enter_room","metadata":"{\"source\":\"demo\"}"}`, user)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data models.UserEvent `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Data.AuctionID != auction.ID || resp.Data.UserID != user.ID || resp.Data.EventType != "enter_room" {
		t.Fatalf("unexpected event response: %+v", resp.Data)
	}

	var stored models.UserEvent
	if err := config.DB.First(&stored, resp.Data.ID).Error; err != nil {
		t.Fatalf("event not stored: %v", err)
	}
	if !strings.Contains(stored.Metadata, "demo") {
		t.Fatalf("metadata not stored: %q", stored.Metadata)
	}
}

func TestCreateAuctionEventRejectsEmptyType(t *testing.T) {
	r := setupCommentTest(t)
	user := createNamedUser(t, "event-empty-user")
	auction := createCommentTestAuction(t)

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(auction.ID)+"/events", `{"event_type":"   "}`, user)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}
