package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// FacebookPagesTool allows the agent to retrieve Facebook Pages connected to it.
type FacebookPagesTool struct {
	facebookOAuthURL string
}

func NewFacebookPagesTool(facebookOAuthURL string) *FacebookPagesTool {
	return &FacebookPagesTool{
		facebookOAuthURL: facebookOAuthURL,
	}
}

func (t *FacebookPagesTool) Name() string { return "facebook_pages" }

func (t *FacebookPagesTool) Description() string {
	return "Get the list of Facebook Pages connected to this agent, including user info and page details"
}

func (t *FacebookPagesTool) Parameters() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}
}

func (t *FacebookPagesTool) Execute(ctx context.Context, args map[string]any) *Result {
	agentID := ToolAgentIDFromCtx(ctx)
	if agentID == "" {
		return ErrorResult("agent_id not found in context")
	}

	url := fmt.Sprintf("%s/fb/agent/%s", t.facebookOAuthURL, agentID)
	resp, err := http.Get(url)
	if err != nil {
		return ErrorResult(fmt.Sprintf("failed to fetch Facebook pages: %v", err))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ErrorResult(fmt.Sprintf("failed to read response: %v", err))
	}

	var data map[string]any
	if err := json.Unmarshal(body, &data); err != nil {
		return ErrorResult(fmt.Sprintf("failed to parse response: %v", err))
	}

	assigned, _ := data["assigned"].(bool)
	if !assigned {
		return NewResult("Chưa có tài khoản Facebook nào được kết nối với agent này.")
	}

	userName, _ := data["user_name"].(string)
	userEmail, _ := data["user_email"].(string)
	pages, _ := data["pages"].([]any)

	result := fmt.Sprintf("Tài khoản Facebook: %s", userName)
	if userEmail != "" {
		result += fmt.Sprintf(" (%s)", userEmail)
	}
	result += fmt.Sprintf("\n\nSố lượng Pages: %d\n\n", len(pages))

	if len(pages) > 0 {
		result += "Danh sách Pages:\n"
		for i, p := range pages {
			page, ok := p.(map[string]any)
			if !ok {
				continue
			}
			pageName, _ := page["page_name"].(string)
			category, _ := page["category"].(string)
			result += fmt.Sprintf("%d. %s", i+1, pageName)
			if category != "" {
				result += fmt.Sprintf(" - %s", category)
			}
			result += "\n"
		}
	}

	return NewResult(result)
}
