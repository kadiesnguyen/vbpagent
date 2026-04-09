package methods

import (
	"context"

	"github.com/nextlevelbuilder/vbpclaw/internal/channels"
	"github.com/nextlevelbuilder/vbpclaw/internal/gateway"
	"github.com/nextlevelbuilder/vbpclaw/internal/i18n"
	"github.com/nextlevelbuilder/vbpclaw/internal/store"
	"github.com/nextlevelbuilder/vbpclaw/pkg/protocol"
)

// ChannelsMethods handles channels.list, channels.status, channels.toggle.
type ChannelsMethods struct {
	manager *channels.Manager
}

func NewChannelsMethods(manager *channels.Manager) *ChannelsMethods {
	return &ChannelsMethods{manager: manager}
}

func (m *ChannelsMethods) Register(router *gateway.MethodRouter) {
	router.Register(protocol.MethodChannelsList, m.handleList)
	router.Register(protocol.MethodChannelsStatus, m.handleStatus)
	router.Register(protocol.MethodChannelsToggle, m.handleToggle)
}

func (m *ChannelsMethods) handleList(_ context.Context, client *gateway.Client, req *protocol.RequestFrame) {
	// Channels are system-level resources — only visible to master tenant callers.
	if client.TenantID() != store.MasterTenantID {
		client.SendResponse(protocol.NewOKResponse(req.ID, map[string]any{
			"channels": []string{},
		}))
		return
	}
	enabled := m.manager.GetEnabledChannels()
	client.SendResponse(protocol.NewOKResponse(req.ID, map[string]any{
		"channels": enabled,
	}))
}

func (m *ChannelsMethods) handleStatus(_ context.Context, client *gateway.Client, req *protocol.RequestFrame) {
	// Channels are system-level resources — only visible to master tenant callers.
	if client.TenantID() != store.MasterTenantID {
		client.SendResponse(protocol.NewOKResponse(req.ID, map[string]any{
			"channels": map[string]any{},
		}))
		return
	}
	status := m.manager.GetStatus()
	client.SendResponse(protocol.NewOKResponse(req.ID, map[string]any{
		"channels": status,
	}))
}

func (m *ChannelsMethods) handleToggle(ctx context.Context, client *gateway.Client, req *protocol.RequestFrame) {
	locale := store.LocaleFromContext(ctx)
	// Channel toggling requires restarting the channel, which is a Phase 3 feature.
	client.SendResponse(protocol.NewErrorResponse(req.ID, protocol.ErrNotFound, i18n.T(locale, i18n.MsgNotImplemented, "channels.toggle")))
}
