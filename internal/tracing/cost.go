package tracing

import (
	"strings"

	"github.com/kadiesnguyen/vbpclaw/internal/config"
	"github.com/kadiesnguyen/vbpclaw/internal/providers"
)

// defaultModelPricing contains built-in USD pricing for popular models (per million tokens).
// Values sourced from official provider pricing pages (2025).
// Users can override any entry via telemetry.model_pricing in config.
var defaultModelPricing = map[string]*config.ModelPricing{
	// Anthropic Claude 4
	"claude-opus-4-5":   {InputPerMillion: 15.0, OutputPerMillion: 75.0, CacheReadPerMillion: 1.5, CacheCreatePerMillion: 18.75},
	"claude-opus-4":     {InputPerMillion: 15.0, OutputPerMillion: 75.0, CacheReadPerMillion: 1.5, CacheCreatePerMillion: 18.75},
	"claude-sonnet-4-5": {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheCreatePerMillion: 3.75},
	"claude-sonnet-4":   {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheCreatePerMillion: 3.75},
	"claude-haiku-4-5":  {InputPerMillion: 0.8, OutputPerMillion: 4.0, CacheReadPerMillion: 0.08, CacheCreatePerMillion: 1.0},
	"claude-haiku-4":    {InputPerMillion: 0.8, OutputPerMillion: 4.0, CacheReadPerMillion: 0.08, CacheCreatePerMillion: 1.0},
	// Anthropic Claude 3.x
	"claude-3-5-sonnet-20241022": {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheCreatePerMillion: 3.75},
	"claude-3-5-sonnet-20240620": {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheCreatePerMillion: 3.75},
	"claude-3-5-haiku-20241022":  {InputPerMillion: 0.8, OutputPerMillion: 4.0, CacheReadPerMillion: 0.08, CacheCreatePerMillion: 1.0},
	"claude-3-opus-20240229":     {InputPerMillion: 15.0, OutputPerMillion: 75.0, CacheReadPerMillion: 1.5, CacheCreatePerMillion: 18.75},
	"claude-3-sonnet-20240229":   {InputPerMillion: 3.0, OutputPerMillion: 15.0},
	"claude-3-haiku-20240307":    {InputPerMillion: 0.25, OutputPerMillion: 1.25, CacheReadPerMillion: 0.03, CacheCreatePerMillion: 0.3},
	// OpenAI GPT-5 series
	"gpt-5":          {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	"gpt-5.4":        {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	"gpt-5.1":        {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	"gpt-5-mini":     {InputPerMillion: 0.15, OutputPerMillion: 0.6, CacheReadPerMillion: 0.075},
	"gpt-5-nano":     {InputPerMillion: 0.05, OutputPerMillion: 0.2},
	// OpenAI GPT-4o
	"gpt-4o":         {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	"gpt-4o-mini":    {InputPerMillion: 0.15, OutputPerMillion: 0.6, CacheReadPerMillion: 0.075},
	"gpt-4o-2024-11-20": {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	"gpt-4o-2024-08-06": {InputPerMillion: 2.5, OutputPerMillion: 10.0, CacheReadPerMillion: 1.25},
	// OpenAI o-series
	"o1":             {InputPerMillion: 15.0, OutputPerMillion: 60.0, CacheReadPerMillion: 7.5},
	"o1-mini":        {InputPerMillion: 1.1, OutputPerMillion: 4.4, CacheReadPerMillion: 0.55},
	"o3":             {InputPerMillion: 10.0, OutputPerMillion: 40.0, CacheReadPerMillion: 2.5},
	"o3-mini":        {InputPerMillion: 1.1, OutputPerMillion: 4.4, CacheReadPerMillion: 0.55},
	"o4-mini":        {InputPerMillion: 1.1, OutputPerMillion: 4.4, CacheReadPerMillion: 0.275},
	// OpenAI GPT-4 Turbo
	"gpt-4-turbo":          {InputPerMillion: 10.0, OutputPerMillion: 30.0},
	"gpt-4-turbo-preview":  {InputPerMillion: 10.0, OutputPerMillion: 30.0},
	"gpt-4":                {InputPerMillion: 30.0, OutputPerMillion: 60.0},
	"gpt-3.5-turbo":        {InputPerMillion: 0.5, OutputPerMillion: 1.5},
	// Google Gemini
	"gemini-2.5-pro":              {InputPerMillion: 1.25, OutputPerMillion: 10.0},
	"gemini-2.5-flash":            {InputPerMillion: 0.15, OutputPerMillion: 0.6},
	"gemini-2.5-flash-preview":    {InputPerMillion: 0.15, OutputPerMillion: 0.6},
	"gemini-2.0-flash":            {InputPerMillion: 0.1, OutputPerMillion: 0.4},
	"gemini-2.0-flash-exp":        {InputPerMillion: 0.1, OutputPerMillion: 0.4},
	"gemini-1.5-pro":              {InputPerMillion: 1.25, OutputPerMillion: 5.0},
	"gemini-1.5-flash":            {InputPerMillion: 0.075, OutputPerMillion: 0.3},
	"gemini-1.5-flash-8b":         {InputPerMillion: 0.0375, OutputPerMillion: 0.15},
	// Alibaba Qwen (DashScope)
	"qwen-max":         {InputPerMillion: 1.6, OutputPerMillion: 6.4},
	"qwen-plus":        {InputPerMillion: 0.4, OutputPerMillion: 1.2},
	"qwen-turbo":       {InputPerMillion: 0.2, OutputPerMillion: 0.6},
	"qwen-long":        {InputPerMillion: 0.05, OutputPerMillion: 0.2},
	"qwen-vl-max":      {InputPerMillion: 3.0, OutputPerMillion: 9.0},
	"qwen-vl-plus":     {InputPerMillion: 1.5, OutputPerMillion: 4.5},
	"qwen2.5-72b-instruct": {InputPerMillion: 0.4, OutputPerMillion: 1.2},
	"qwen2.5-7b-instruct":  {InputPerMillion: 0.05, OutputPerMillion: 0.1},
	// DeepSeek
	"deepseek-chat":     {InputPerMillion: 0.07, OutputPerMillion: 1.1},
	"deepseek-reasoner": {InputPerMillion: 0.55, OutputPerMillion: 2.19},
	// Mistral
	"mistral-large-latest":  {InputPerMillion: 2.0, OutputPerMillion: 6.0},
	"mistral-small-latest":  {InputPerMillion: 0.1, OutputPerMillion: 0.3},
	"codestral-latest":      {InputPerMillion: 0.2, OutputPerMillion: 0.6},
}

// CalculateCost computes the USD cost for a single LLM call based on token usage and pricing.
// Returns 0 if pricing is nil.
func CalculateCost(pricing *config.ModelPricing, usage *providers.Usage) float64 {
	if pricing == nil || usage == nil {
		return 0
	}
	cost := float64(usage.PromptTokens) * pricing.InputPerMillion / 1_000_000
	cost += float64(usage.CompletionTokens) * pricing.OutputPerMillion / 1_000_000
	if pricing.CacheReadPerMillion > 0 && usage.CacheReadTokens > 0 {
		cost += float64(usage.CacheReadTokens) * pricing.CacheReadPerMillion / 1_000_000
	}
	if pricing.CacheCreatePerMillion > 0 && usage.CacheCreationTokens > 0 {
		cost += float64(usage.CacheCreationTokens) * pricing.CacheCreatePerMillion / 1_000_000
	}
	return cost
}

// normalizeModel strips a routing-provider prefix from OpenRouter-style model IDs.
// OpenRouter passes models as "openai/gpt-5.4", "anthropic/claude-sonnet-4-5", etc.
// We strip the leading "vendor/" segment so the rest of LookupPricing can match on
// the canonical model name (e.g. "gpt-5.4", "claude-sonnet-4-5").
func normalizeModel(model string) string {
	if idx := strings.Index(model, "/"); idx >= 0 {
		return model[idx+1:]
	}
	return model
}

// LookupPricing finds the model pricing, checking config overrides first, then built-in defaults.
// Lookup order: "provider/model" in config → "model" in config → "provider/model" in defaults →
// "model" in defaults → normalized model (strip routing prefix) → prefix match in defaults.
func LookupPricing(pricingMap map[string]*config.ModelPricing, provider, model string) *config.ModelPricing {
	// 1. User config overrides (exact match).
	if pricingMap != nil {
		if p, ok := pricingMap[provider+"/"+model]; ok {
			return p
		}
		if p, ok := pricingMap[model]; ok {
			return p
		}
	}

	// 2. Built-in defaults (exact match).
	if p, ok := defaultModelPricing[provider+"/"+model]; ok {
		return p
	}
	if p, ok := defaultModelPricing[model]; ok {
		return p
	}

	// 3. Normalized model (strips OpenRouter-style "vendor/" prefix, e.g. "openai/gpt-5.4" → "gpt-5.4").
	if norm := normalizeModel(model); norm != model {
		if p, ok := defaultModelPricing[norm]; ok {
			return p
		}
	}

	// 4. Prefix match in defaults — handles snapshot suffixes like "claude-sonnet-4-5-20251001".
	for key, p := range defaultModelPricing {
		if strings.HasPrefix(model, key) {
			return p
		}
	}

	return nil
}
