package controllers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
)

func TestAdminForceFinishAuctionCreatesOrder(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "demo-finish-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "demo-finish-admin")
	regular := createNamedUser(t, "demo-finish-regular")
	a := createCommentTestAuction(t)
	a.Status = "active"
	now := time.Now().Add(-time.Hour)
	a.StartedAt = &now
	ends := time.Now().Add(10 * 24 * time.Hour)
	a.EndsAt = &ends
	a.WinnerID = &regular.ID
	a.CurrentPrice = 260
	a.CurrentPriceCents = 26000
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("save auction: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Where("auction_id = ?", a.ID).Delete(&models.Order{})
	})

	req := authReq(t, http.MethodPost, "/api/admin/auctions/"+uintString(a.ID)+"/finish", "", regular)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("regular status = %d, body = %s", rec.Code, rec.Body.String())
	}

	req = authReq(t, http.MethodPost, "/api/admin/auctions/"+uintString(a.ID)+"/finish", "", admin)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var fresh models.Auction
	if err := config.DB.First(&fresh, a.ID).Error; err != nil {
		t.Fatalf("load auction: %v", err)
	}
	if fresh.Status != "finished" {
		t.Fatalf("status = %s; want finished", fresh.Status)
	}
	var orders int64
	config.DB.Model(&models.Order{}).Where("auction_id = ?", a.ID).Count(&orders)
	if orders != 1 {
		t.Fatalf("orders = %d; want 1", orders)
	}
}

func TestAdminDeleteAuctionCascadesDemoRows(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "demo-delete-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "demo-delete-admin")
	buyer := createNamedUser(t, "demo-delete-buyer")
	a := createCommentTestAuction(t)
	bid := models.Bid{AuctionID: a.ID, UserID: buyer.ID, Amount: 110, AmountCents: 11000}
	comment := models.Comment{AuctionID: a.ID, UserID: buyer.ID, Username: buyer.Username, Content: "demo"}
	event := models.UserEvent{AuctionID: a.ID, UserID: buyer.ID, EventType: "enter_room"}
	for _, item := range []any{&bid, &comment, &event} {
		if err := config.DB.Create(item).Error; err != nil {
			t.Fatalf("create dependent row: %v", err)
		}
	}

	req := authReq(t, http.MethodDelete, "/api/admin/auctions/"+uintString(a.ID), "", admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	for table, model := range map[string]any{
		"auctions":    &models.Auction{},
		"bids":        &models.Bid{},
		"comments":    &models.Comment{},
		"user_events": &models.UserEvent{},
	} {
		var count int64
		query := config.DB.Model(model)
		if table == "auctions" {
			query = query.Where("id = ?", a.ID)
		} else {
			query = query.Where("auction_id = ?", a.ID)
		}
		query.Count(&count)
		if count != 0 {
			t.Fatalf("%s count = %d; want 0", table, count)
		}
	}
}

func TestAdminListsAndDeletesDemoUserOnly(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "demo-users-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "demo-users-admin")
	demo := createNamedUser(t, "demo-user-delete-me")
	nonDemo := createNamedUser(t, "normal-user-delete-me")
	a := createCommentTestAuction(t)
	if err := config.DB.Create(&models.Bid{AuctionID: a.ID, UserID: demo.ID, Amount: 120, AmountCents: 12000}).Error; err != nil {
		t.Fatalf("create bid: %v", err)
	}

	req := authReq(t, http.MethodGet, "/api/admin/demo-users", "", admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data []struct {
			ID       uint   `json:"id"`
			Username string `json:"username"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	found := false
	for _, u := range resp.Data {
		if u.ID == demo.ID && u.Username == demo.Username {
			found = true
		}
		if strings.HasPrefix(u.Username, "normal-") {
			t.Fatalf("non-demo user leaked into demo list: %+v", u)
		}
	}
	if !found {
		t.Fatalf("demo user %s not listed: %+v", demo.Username, resp.Data)
	}

	req = authReq(t, http.MethodDelete, "/api/admin/demo-users/"+uintString(nonDemo.ID), "", admin)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("delete non-demo status = %d, body = %s", rec.Code, rec.Body.String())
	}

	req = authReq(t, http.MethodDelete, "/api/admin/demo-users/"+uintString(demo.ID), "", admin)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete demo status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var users int64
	config.DB.Model(&models.User{}).Where("id = ?", demo.ID).Count(&users)
	if users != 0 {
		t.Fatalf("demo user count = %d; want 0", users)
	}
	var bids int64
	config.DB.Model(&models.Bid{}).Where("user_id = ?", demo.ID).Count(&bids)
	if bids != 0 {
		t.Fatalf("demo user bid count = %d; want 0", bids)
	}
}
