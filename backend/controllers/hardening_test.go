package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"auction-system/backend/config"
	"auction-system/backend/models"

	"github.com/gin-gonic/gin"
)

func createNamedUser(t *testing.T, username string) models.User {
	t.Helper()
	u := models.User{Username: username, PasswordHash: "test"}
	if err := config.DB.Where("username = ?", username).Delete(&models.User{}).Error; err != nil {
		t.Fatalf("cleanup user: %v", err)
	}
	if err := config.DB.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Where("user_id = ?", u.ID).Delete(&models.Merchant{})
		config.DB.Delete(&models.User{}, u.ID)
	})
	return u
}

func createActiveMerchant(t *testing.T, u models.User) {
	t.Helper()
	m := models.Merchant{UserID: u.ID, DisplayName: u.Username, Status: "active"}
	if err := config.DB.Create(&m).Error; err != nil {
		t.Fatalf("create merchant: %v", err)
	}
}

func authReq(t *testing.T, method, path string, body string, user models.User) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, user))
	return req
}

func TestAdminCanCreateAndDisableMerchant(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "root-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "root-admin")
	seller := createNamedUser(t, "seller-managed")

	req := authReq(t, http.MethodPost, "/api/admin/merchants", `{"user_id":`+uintString(seller.ID)+`,"display_name":"Seller"}`, admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var merchant models.Merchant
	if err := config.DB.Where("user_id = ?", seller.ID).First(&merchant).Error; err != nil {
		t.Fatalf("merchant not stored: %v", err)
	}
	if merchant.Status != "active" {
		t.Fatalf("merchant status = %q", merchant.Status)
	}

	req = authReq(t, http.MethodDelete, "/api/admin/merchants/"+uintString(seller.ID), "", admin)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("disable merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if err := config.DB.Where("user_id = ?", seller.ID).First(&merchant).Error; err != nil {
		t.Fatalf("merchant missing after disable: %v", err)
	}
	if merchant.Status != "disabled" {
		t.Fatalf("merchant status after disable = %q", merchant.Status)
	}
}

func TestOnlyMerchantCanCreateAuctionWithCents(t *testing.T) {
	r := setupCommentTest(t)
	buyer := createNamedUser(t, "buyer-no-merchant")
	seller := createNamedUser(t, "seller-create")
	createActiveMerchant(t, seller)

	body := `{"title":"  Cents Auction  ","start_price_cents":10000,"price_step_cents":500,"ceiling_price_cents":15000,"duration_seconds":120}`
	req := authReq(t, http.MethodPost, "/api/auctions", body, buyer)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("non-merchant status = %d, body = %s", rec.Code, rec.Body.String())
	}

	req = authReq(t, http.MethodPost, "/api/auctions", body, seller)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("merchant create status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data models.Auction `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	t.Cleanup(func() {
		config.DB.Delete(&models.Auction{}, resp.Data.ID)
	})
	if resp.Data.SellerUserID != seller.ID || resp.Data.StartPriceCents != 10000 || resp.Data.PriceStepCents != 500 {
		t.Fatalf("unexpected auction: %+v", resp.Data)
	}
	if resp.Data.Title != "Cents Auction" {
		t.Fatalf("title was not trimmed: %q", resp.Data.Title)
	}
}

func TestOrderRequiresOwnerSellerOrAdmin(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "order-admin")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "order-admin")
	seller := createNamedUser(t, "order-seller")
	buyer := createNamedUser(t, "order-buyer")
	other := createNamedUser(t, "order-other")
	createActiveMerchant(t, seller)
	a := createCommentTestAuction(t)
	a.SellerUserID = seller.ID
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("update auction seller: %v", err)
	}
	order := models.Order{AuctionID: a.ID, UserID: buyer.ID, FinalPrice: 123, FinalPriceCents: 12300, Status: "pending"}
	if err := config.DB.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	t.Cleanup(func() { config.DB.Delete(&models.Order{}, order.ID) })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", rec.Code)
	}

	req := authReq(t, http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", "", other)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("other status = %d, body = %s", rec.Code, rec.Body.String())
	}

	for _, u := range []models.User{buyer, seller, admin} {
		req = authReq(t, http.MethodGet, "/api/auctions/"+uintString(a.ID)+"/order", "", u)
		rec = httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d, body = %s", u.Username, rec.Code, rec.Body.String())
		}
	}
}

func TestCommentsForMissingAuctionReturnNotFound(t *testing.T) {
	r := setupCommentTest(t)
	req := httptest.NewRequest(http.MethodGet, "/api/auctions/99999999/comments", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestConcurrentBidsCannotOverwriteHigherBid(t *testing.T) {
	r := setupCommentTest(t)
	u1 := createNamedUser(t, "bidder-high")
	u2 := createNamedUser(t, "bidder-low")
	a := createCommentTestAuction(t)
	ends := time.Now().Add(time.Minute)
	a.CurrentPrice = 100
	a.StartPriceCents = 10000
	a.CurrentPriceCents = 10000
	a.PriceStepCents = 100
	a.Status = "active"
	a.EndsAt = &ends
	if err := config.DB.Save(&a).Error; err != nil {
		t.Fatalf("update auction: %v", err)
	}

	var wg sync.WaitGroup
	for _, tc := range []struct {
		user   models.User
		amount int64
	}{
		{u1, 12000},
		{u2, 10100},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := authReq(t, http.MethodPost, "/api/auctions/"+uintString(a.ID)+"/bids", `{"amount_cents":`+strconv.FormatInt(tc.amount, 10)+`}`, tc.user)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK && rec.Code != http.StatusBadRequest {
				t.Errorf("unexpected bid status = %d, body = %s", rec.Code, rec.Body.String())
			}
		}()
	}
	wg.Wait()

	var fresh models.Auction
	if err := config.DB.First(&fresh, a.ID).Error; err != nil {
		t.Fatalf("load auction: %v", err)
	}
	if fresh.CurrentPriceCents != 12000 || fresh.WinnerID == nil || *fresh.WinnerID != u1.ID {
		t.Fatalf("higher bid was not preserved: %+v", fresh)
	}
}

func TestReleaseSecurityValidationRequiresSecretAndOrigins(t *testing.T) {
	cfg := &config.Config{ServerMode: gin.ReleaseMode, JWTSecret: "", AllowedOrigins: nil}
	if err := config.ValidateSecurity(cfg); err == nil {
		t.Fatal("expected release security validation to fail")
	}
	cfg.JWTSecret = "a-very-long-release-secret"
	cfg.AllowedOrigins = []string{"https://example.com"}
	if err := config.ValidateSecurity(cfg); err != nil {
		t.Fatalf("expected valid release security config: %v", err)
	}
}
