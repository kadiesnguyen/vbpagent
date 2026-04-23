package http

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/kadiesnguyen/vbpclaw/internal/permissions"
)

// IntegrationsHandler exposes read-only status endpoints for external integrations
// (Google Workspace OAuth, etc.). All routes require admin role.
type IntegrationsHandler struct {
	oauthServiceURL string
	httpClient      *http.Client
}

func NewIntegrationsHandler() *IntegrationsHandler {
	url := os.Getenv("OAUTH_SERVICE_URL")
	if url == "" {
		url = "http://oauth-service:9876"
	}
	return &IntegrationsHandler{
		oauthServiceURL: url,
		httpClient:      &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *IntegrationsHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/integrations/google/accounts", requireAuth(permissions.RoleAdmin, h.handleGoogleAccounts))
}

// handleGoogleAccounts proxies to the oauth-service /status endpoint and returns
// the list of authenticated Google accounts. Used by the agent config UI to show
// which emails have valid OAuth credentials.
func (h *IntegrationsHandler) handleGoogleAccounts(w http.ResponseWriter, r *http.Request) {
	resp, err := h.httpClient.Get(fmt.Sprintf("%s/status", h.oauthServiceURL))
	if err != nil {
		// oauth-service not reachable → return empty list (feature not configured)
		writeJSON(w, http.StatusOK, map[string]any{"accounts": []any{}, "available": false})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"accounts": []any{}, "available": false})
		return
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"accounts": []any{}, "available": false})
		return
	}
	result["available"] = true
	writeJSON(w, http.StatusOK, result)
}
