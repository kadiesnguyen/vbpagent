package tools

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	"github.com/nextlevelbuilder/vbpclaw/internal/providers"
)

// resolveAudioFile finds the audio file path from context MediaRefs.
func (t *ReadAudioTool) resolveAudioFile(ctx context.Context, mediaID string) (path, mime string, err error) {
	if t.mediaLoader == nil {
		return "", "", fmt.Errorf("no media storage configured — cannot access audio files")
	}

	refs := MediaAudioRefsFromCtx(ctx)
	if len(refs) == 0 {
		return "", "", fmt.Errorf("no audio files available in this conversation. The user may not have sent an audio file.")
	}

	// Sanitize media_id: LLM may pass the literal tag string (e.g. "<media:audio>")
	// instead of a UUID. Treat tag-like values as empty to fall back to most recent.
	if strings.Contains(mediaID, "<") || strings.Contains(mediaID, "media:") {
		slog.Debug("read_audio: sanitizing tag-like media_id", "raw", mediaID)
		mediaID = ""
	}

	var ref *providers.MediaRef
	if mediaID != "" {
		for i := range refs {
			if refs[i].ID == mediaID {
				ref = &refs[i]
				break
			}
		}
		if ref == nil {
			// Fallback to most recent audio instead of hard error,
			// since LLM may generate invalid IDs.
			slog.Warn("read_audio: media_id not found, falling back to most recent", "media_id", mediaID)
			ref = &refs[len(refs)-1]
		}
	} else {
		ref = &refs[len(refs)-1]
	}

	// Prefer persisted workspace path; fall back to legacy .media/ lookup.
	p := ref.Path
	if p == "" {
		var err error
		if t.mediaLoader == nil {
			return "", "", fmt.Errorf("no media storage configured")
		}
		p, err = t.mediaLoader.LoadPath(ref.ID)
		if err != nil {
			return "", "", fmt.Errorf("audio file not found: %v", err)
		}
	}

	mime = ref.MimeType
	if mime == "" || mime == "application/octet-stream" {
		mime = mimeFromAudioExt(filepath.Ext(p))
	}

	return p, mime, nil
}

// callProvider dispatches audio analysis to the appropriate provider API.
// Gemini: uses File API (upload → poll → file_data in generateContent).
// OpenAI: uses input_audio content part in chat completions.
// Others: falls back to base64 in image_url (best effort).
func (t *ReadAudioTool) callProvider(ctx context.Context, cp credentialProvider, providerName, model string, params map[string]any) ([]byte, *providers.Usage, error) {
	prompt := GetParamString(params, "prompt", "Analyze this audio and describe its contents.")
	data, _ := params["data"].([]byte)
	mime := GetParamString(params, "mime", "audio/mpeg")

	// Provider-specific paths require API credentials; skip when cp is nil
	// (e.g. OAuth-based providers that don't expose static keys).
	ptype := GetParamString(params, "_provider_type", providerTypeFromName(providerName))
	if cp == nil && (ptype == "gemini" || ptype == "openai") {
		slog.Info("read_audio: no API credentials, falling back to Chat API", "provider", providerName)
	}
	if cp != nil {
		// Gemini: use File API (inlineData doesn't work for audio).
		if ptype == "gemini" {
			slog.Info("read_audio: using gemini file API", "provider", providerName, "model", model, "size", len(data), "mime", mime)
			resp, err := geminiFileAPICall(ctx, cp.APIKey(), model, prompt, data, mime, 120*time.Second)
			if err != nil {
				return nil, nil, fmt.Errorf("gemini file API: %w", err)
			}
			return []byte(resp.Content), resp.Usage, nil
		}

		// OpenAI: use input_audio content part (supports wav, mp3).
		if ptype == "openai" {
			slog.Info("read_audio: using openai input_audio API", "provider", providerName, "model", model, "size", len(data), "mime", mime)
			resp, err := openaiAudioCall(ctx, cp.APIKey(), cp.APIBase(), model, prompt, data, mime)
			if err != nil {
				return nil, nil, fmt.Errorf("openai audio call: %w", err)
			}
			return []byte(resp.Content), resp.Usage, nil
		}
	}

	// Other providers: try standard Chat API with audio described as text (best effort).
	// NOTE: We do NOT send audio as Images — providers reject non-image MIME types in
	// the images field. Instead, inform the model that audio is present but cannot be
	// decoded via this provider path.
	p, err := t.registry.Get(ctx, providerName)
	if err != nil {
		return nil, nil, fmt.Errorf("provider %q not available: %w", providerName, err)
	}

	slog.Info("read_audio: using chat API fallback (no audio data)", "provider", providerName, "model", model)
	resp, err := p.Chat(ctx, providers.ChatRequest{
		Messages: []providers.Message{
			{
				Role:    "user",
				Content: fmt.Sprintf("[Audio file (%s, %d bytes) — transcription not supported by this provider. %s]", mime, len(data), prompt),
			},
		},
		Model: model,
		Options: map[string]any{
			"max_tokens":  1024,
			"temperature": 0.2,
		},
	})
	if err != nil {
		return nil, nil, fmt.Errorf("chat API: %w", err)
	}
	return []byte(resp.Content), resp.Usage, nil
}

// openaiAudioCall sends audio to OpenAI using the input_audio content part.
func openaiAudioCall(ctx context.Context, apiKey, baseURL, model, prompt string, data []byte, mime string) (*providers.ChatResponse, error) {
	// Determine format from MIME.
	// gpt-4o-audio-preview input_audio supports: mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm.
	format := "mp3"
	switch {
	case strings.Contains(mime, "wav"):
		format = "wav"
	case strings.Contains(mime, "mp3"), strings.Contains(mime, "mpeg"):
		format = "mp3"
	case strings.Contains(mime, "ogg"), strings.Contains(mime, "opus"):
		format = "ogg"
	case strings.Contains(mime, "mp4"), strings.Contains(mime, "m4a"):
		format = "mp4"
	case strings.Contains(mime, "webm"):
		format = "webm"
	}

	b64 := base64.StdEncoding.EncodeToString(data)

	body := map[string]any{
		"model": model,
		"messages": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{"type": "text", "text": prompt},
					{"type": "input_audio", "input_audio": map[string]string{
						"data":   b64,
						"format": format,
					}},
				},
			},
		},
		"max_tokens": 16384,
	}

	return callOpenAICompatJSON(ctx, apiKey, baseURL, body, 120*time.Second)
}
