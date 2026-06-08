package controllers_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"
	"auction-system/backend/ws"

	"github.com/gorilla/websocket"
)

func TestMerchantCanUpdatePendingAuctionRules(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-edit")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	a.Status = "pending"
	a.SellerUserID = seller.ID
	a.StartPriceCents = 10000
	a.PriceStepCents = 500
	a.CurrentPriceCents = 10000
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	body := `{"title":"Updated","description":"new","image_url":"https://example.com/a.jpg","start_price_cents":12000,"price_step_cents":1000,"duration_seconds":600,"auto_extend_seconds":20}`
	req := authReq(t, http.MethodPut, "/api/auctions/"+uintString(a.ID), body, seller)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data models.Auction `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Data.Title != "Updated" || resp.Data.StartPriceCents != 12000 || resp.Data.AutoExtendSeconds != 20 {
		t.Fatalf("unexpected auction update: %+v", resp.Data)
	}
}

func TestCannotUpdateActiveAuctionRules(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-edit-active")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	a.SellerUserID = seller.ID
	a.Status = "active"
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodPut, "/api/auctions/"+uintString(a.ID), `{"title":"Nope","start_price_cents":12000,"price_step_cents":1000,"duration_seconds":600}`, seller)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestMerchantCanListOwnOrders(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-orders")
	otherSeller := createNamedUser(t, "seller-orders-other")
	buyer := createNamedUser(t, "seller-orders-buyer")
	createActiveMerchant(t, seller)
	createActiveMerchant(t, otherSeller)

	own := createCommentTestAuction(t)
	own.SellerUserID = seller.ID
	own.Status = "finished"
	other := createCommentTestAuction(t)
	other.SellerUserID = otherSeller.ID
	other.Status = "finished"
	if err := config.DB.Save(&own).Error; err != nil {
		t.Fatalf("save own auction: %v", err)
	}
	if err := config.DB.Save(&other).Error; err != nil {
		t.Fatalf("save other auction: %v", err)
	}
	ownOrder := models.Order{AuctionID: own.ID, UserID: buyer.ID, FinalPrice: 111, FinalPriceCents: 11100, Status: "pending"}
	otherOrder := models.Order{AuctionID: other.ID, UserID: buyer.ID, FinalPrice: 222, FinalPriceCents: 22200, Status: "pending"}
	if err := config.DB.Create(&ownOrder).Error; err != nil {
		t.Fatalf("create own order: %v", err)
	}
	if err := config.DB.Create(&otherOrder).Error; err != nil {
		t.Fatalf("create other order: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Delete(&models.Order{}, ownOrder.ID)
		config.DB.Delete(&models.Order{}, otherOrder.ID)
	})

	req := authReq(t, http.MethodGet, "/api/admin/orders", "", seller)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data []struct {
			Order   models.Order   `json:"order"`
			Auction models.Auction `json:"auction"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Data) != 1 || resp.Data[0].Order.ID != ownOrder.ID {
		t.Fatalf("unexpected orders: %+v", resp.Data)
	}
}

func TestUploadImageStoresFileAndReturnsURL(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-upload")
	createActiveMerchant(t, seller)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "product.jpg")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("fake image")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/uploads/images", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", authHeader(t, seller))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "/uploads/images/") {
		t.Fatalf("upload response missing URL: %s", rec.Body.String())
	}
}

func TestAutoExtendSecondsUsesAuctionRule(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-extend")
	bidder := createNamedUser(t, "bidder-extend")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	ends := time.Now().Add(5 * time.Second)
	a.SellerUserID = seller.ID
	a.CurrentPriceCents = 10000
	a.PriceStepCents = 500
	a.AutoExtendSeconds = 20
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":10500}`, bidder)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var fresh models.Auction
	if err := config.DB.First(&fresh, a.ID).Error; err != nil {
		t.Fatalf("load auction: %v", err)
	}
	if fresh.EndsAt == nil || time.Until(*fresh.EndsAt) < 15*time.Second {
		t.Fatalf("auction was not extended by configured rule: %v", fresh.EndsAt)
	}
}

func TestNewBidBroadcastIncludesRealtimeMetadata(t *testing.T) {
	r := setupCommentTest(t)
	seller := createNamedUser(t, "seller-realtime")
	bidder := createNamedUser(t, "bidder-realtime")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	ends := time.Now().Add(5 * time.Second)
	a.SellerUserID = seller.ID
	a.CurrentPriceCents = 0
	a.CurrentPrice = 0
	a.PriceStepCents = 100
	a.PriceStep = 1
	a.AutoExtendSeconds = 20
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	client := &ws.Client{
		AuctionID: a.ID,
		Conn:      &websocket.Conn{},
		Send:      make(chan []byte, 1),
	}
	ws.H.Register(client)
	t.Cleanup(func() {
		ws.H.Unregister(client)
	})

	req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":100,"client_bid_id":"realtime-1"}`, bidder)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	select {
	case raw := <-client.Send:
		var event struct {
			Type             string `json:"type"`
			ParticipantCount int64  `json:"participant_count"`
			AutoExtended     bool   `json:"auto_extended"`
			ServerTime       string `json:"server_time"`
		}
		if err := json.Unmarshal(raw, &event); err != nil {
			t.Fatalf("decode broadcast: %v", err)
		}
		if event.Type != "new_bid" || event.ParticipantCount != 1 || !event.AutoExtended || event.ServerTime == "" {
			t.Fatalf("unexpected realtime metadata: %+v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for new_bid broadcast")
	}
}
