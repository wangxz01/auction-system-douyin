package controllers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"auction-system/backend/config"
)

func TestAdminAlertsRequiresAdmin(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "alerts-admin")
	r := setupCommentTest(t)
	regular := createNamedUser(t, "alerts-regular")

	req := authReq(t, http.MethodGet, "/api/admin/alerts", "", regular)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("regular status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestAdminAlertsReportStaleActiveAuction(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "alerts-admin-2")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "alerts-admin-2")
	auction := createCommentTestAuction(t)
	past := time.Now().Add(-time.Minute)
	auction.Status = "active"
	auction.EndsAt = &past
	if err := config.DB.Save(&auction).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodGet, "/api/admin/alerts", "", admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("admin status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data []struct {
			Severity string `json:"severity"`
			Code     string `json:"code"`
			Message  string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode alerts: %v", err)
	}
	for _, alert := range resp.Data {
		if alert.Code == "stale_active_auction" && strings.Contains(alert.Message, uintString(auction.ID)) {
			if alert.Severity != "warning" {
				t.Fatalf("stale auction severity = %q; want warning", alert.Severity)
			}
			return
		}
	}
	t.Fatalf("missing stale auction alert: %+v", resp.Data)
}

func TestAdminMetricsIncludesAlertCount(t *testing.T) {
	t.Setenv("ADMIN_USERNAMES", "alerts-admin-3")
	r := setupCommentTest(t)
	admin := createNamedUser(t, "alerts-admin-3")
	auction := createCommentTestAuction(t)
	past := time.Now().Add(-time.Minute)
	auction.Status = "active"
	auction.EndsAt = &past
	if err := config.DB.Save(&auction).Error; err != nil {
		t.Fatalf("prepare auction: %v", err)
	}

	req := authReq(t, http.MethodGet, "/api/admin/metrics", "", admin)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Data struct {
			AlertCount int `json:"alert_count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode metrics: %v", err)
	}
	if resp.Data.AlertCount < 1 {
		t.Fatalf("expected alert_count >= 1, got %d", resp.Data.AlertCount)
	}
}
