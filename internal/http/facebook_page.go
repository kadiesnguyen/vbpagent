package http

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/google/uuid"

	"github.com/kadiesnguyen/vbpclaw/internal/bus"
	"github.com/kadiesnguyen/vbpclaw/internal/permissions"
	"github.com/kadiesnguyen/vbpclaw/internal/store"
)

type FacebookPageHandler struct {
	agentStore store.AgentStore
	msgBus     *bus.MessageBus
}

func NewFacebookPageHandler(agentStore store.AgentStore, msgBus *bus.MessageBus) *FacebookPageHandler {
	return &FacebookPageHandler{
		agentStore: agentStore,
		msgBus:     msgBus,
	}
}

func (h *FacebookPageHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/agents/{agent_id}/facebook", h.authOperator(h.handleGetAgentPage))
	mux.HandleFunc("DELETE /v1/agents/{agent_id}/facebook", h.authOperator(h.handleUnassignPage))
}

func (h *FacebookPageHandler) authOperator(next http.HandlerFunc) http.HandlerFunc {
	return requireAuth(permissions.RoleOperator, next)
}


func (h *FacebookPageHandler) handleGetAgentPage(w http.ResponseWriter, r *http.Request) {
	agentIDStr := r.PathValue("agent_id")
	agentID, err := uuid.Parse(agentIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid agent_id"})
		return
	}

	agent, err := h.agentStore.GetByID(r.Context(), agentID)
	if err != nil || agent == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
		return
	}

	resp, err := http.Get("http://facebook-oauth:9878/fb/agent/" + agentIDStr)
	if err != nil {
		slog.Error("failed to get agent facebook assignment", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to get assignment"})
		return
	}
	defer resp.Body.Close()

	var assignment map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&assignment); err != nil {
		slog.Error("failed to decode assignment response", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to parse assignment"})
		return
	}

	writeJSON(w, http.StatusOK, assignment)
}


func (h *FacebookPageHandler) handleUnassignPage(w http.ResponseWriter, r *http.Request) {
	agentIDStr := r.PathValue("agent_id")

	agentID, err := uuid.Parse(agentIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid agent_id"})
		return
	}

	agent, err := h.agentStore.GetByID(r.Context(), agentID)
	if err != nil || agent == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
		return
	}

	req, _ := http.NewRequest("DELETE", "http://facebook-oauth:9878/fb/assign/"+agentIDStr, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Error("failed to unassign facebook page", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to unassign page"})
		return
	}
	defer resp.Body.Close()

	emitAudit(h.msgBus, r, "facebook.page_unassigned", "facebook", agentIDStr)

	writeJSON(w, http.StatusOK, map[string]string{"status": "unassigned"})
}
