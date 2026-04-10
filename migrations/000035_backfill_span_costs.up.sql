-- Backfill total_cost for existing llm_call spans that have token counts but no cost.
-- Uses a built-in pricing table (USD per million tokens) matching internal/tracing/cost.go defaults.
-- Key format matches LookupPricing: try "provider/model" then "model".

WITH pricing (key, input_per_m, output_per_m, cache_read_per_m, cache_create_per_m) AS (
  VALUES
    -- Anthropic Claude 4
    ('claude-opus-4-5',                    15.0,  75.0,  1.50,  18.75),
    ('claude-opus-4',                      15.0,  75.0,  1.50,  18.75),
    ('claude-sonnet-4-5',                   3.0,  15.0,  0.30,   3.75),
    ('claude-sonnet-4',                     3.0,  15.0,  0.30,   3.75),
    ('claude-haiku-4-5',                    0.8,   4.0,  0.08,   1.00),
    ('claude-haiku-4',                      0.8,   4.0,  0.08,   1.00),
    -- Anthropic Claude 3.x
    ('claude-3-5-sonnet-20241022',          3.0,  15.0,  0.30,   3.75),
    ('claude-3-5-sonnet-20240620',          3.0,  15.0,  0.30,   3.75),
    ('claude-3-5-haiku-20241022',           0.8,   4.0,  0.08,   1.00),
    ('claude-3-opus-20240229',             15.0,  75.0,  1.50,  18.75),
    ('claude-3-sonnet-20240229',            3.0,  15.0,  0.00,   0.00),
    ('claude-3-haiku-20240307',             0.25,  1.25, 0.03,   0.30),
    -- OpenAI GPT-5 series
    ('gpt-5',                               2.5,  10.0,  1.25,   0.00),
    ('gpt-5.4',                             2.5,  10.0,  1.25,   0.00),
    ('gpt-5.1',                             2.5,  10.0,  1.25,   0.00),
    ('gpt-5-mini',                          0.15,  0.6,  0.075,  0.00),
    ('gpt-5-nano',                          0.05,  0.2,  0.00,   0.00),
    -- OpenAI GPT-4o
    ('gpt-4o',                              2.5,  10.0,  1.25,   0.00),
    ('gpt-4o-mini',                         0.15,  0.6,  0.075,  0.00),
    ('gpt-4o-2024-11-20',                   2.5,  10.0,  1.25,   0.00),
    ('gpt-4o-2024-08-06',                   2.5,  10.0,  1.25,   0.00),
    -- OpenAI o-series
    ('o1',                                 15.0,  60.0,  7.50,   0.00),
    ('o1-mini',                             1.1,   4.4,  0.55,   0.00),
    ('o3',                                 10.0,  40.0,  2.50,   0.00),
    ('o3-mini',                             1.1,   4.4,  0.55,   0.00),
    ('o4-mini',                             1.1,   4.4,  0.275,  0.00),
    -- OpenAI GPT-4
    ('gpt-4-turbo',                        10.0,  30.0,  0.00,   0.00),
    ('gpt-4-turbo-preview',                10.0,  30.0,  0.00,   0.00),
    ('gpt-4',                              30.0,  60.0,  0.00,   0.00),
    ('gpt-3.5-turbo',                       0.5,   1.5,  0.00,   0.00),
    -- Google Gemini
    ('gemini-2.5-pro',                      1.25, 10.0,  0.00,   0.00),
    ('gemini-2.5-flash',                    0.15,  0.6,  0.00,   0.00),
    ('gemini-2.5-flash-preview',            0.15,  0.6,  0.00,   0.00),
    ('gemini-2.0-flash',                    0.1,   0.4,  0.00,   0.00),
    ('gemini-2.0-flash-exp',                0.1,   0.4,  0.00,   0.00),
    ('gemini-1.5-pro',                      1.25,  5.0,  0.00,   0.00),
    ('gemini-1.5-flash',                    0.075, 0.3,  0.00,   0.00),
    ('gemini-1.5-flash-8b',                 0.0375,0.15, 0.00,   0.00),
    -- Alibaba Qwen
    ('qwen-max',                            1.6,   6.4,  0.00,   0.00),
    ('qwen-plus',                           0.4,   1.2,  0.00,   0.00),
    ('qwen-turbo',                          0.2,   0.6,  0.00,   0.00),
    ('qwen-long',                           0.05,  0.2,  0.00,   0.00),
    ('qwen-vl-max',                         3.0,   9.0,  0.00,   0.00),
    ('qwen-vl-plus',                        1.5,   4.5,  0.00,   0.00),
    ('qwen2.5-72b-instruct',                0.4,   1.2,  0.00,   0.00),
    ('qwen2.5-7b-instruct',                 0.05,  0.1,  0.00,   0.00),
    -- DeepSeek
    ('deepseek-chat',                       0.07,  1.1,  0.00,   0.00),
    ('deepseek-reasoner',                   0.55,  2.19, 0.00,   0.00),
    -- Mistral
    ('mistral-large-latest',                2.0,   6.0,  0.00,   0.00),
    ('mistral-small-latest',                0.1,   0.3,  0.00,   0.00),
    ('codestral-latest',                    0.2,   0.6,  0.00,   0.00)
),
-- Resolve pricing for each span: try "provider/model" first, then "model", then prefix match.
resolved AS (
  SELECT
    s.id AS span_id,
    s.trace_id,
    COALESCE(
      -- Exact "provider/model" match
      (SELECT p.input_per_m FROM pricing p WHERE p.key = s.provider || '/' || s.model),
      -- Exact "model" match
      (SELECT p.input_per_m FROM pricing p WHERE p.key = s.model),
      -- Prefix match (e.g. "claude-sonnet-4-5-20251001" matches "claude-sonnet-4-5")
      (SELECT p.input_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1)
    ) AS input_per_m,
    COALESCE(
      (SELECT p.output_per_m FROM pricing p WHERE p.key = s.provider || '/' || s.model),
      (SELECT p.output_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.output_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1)
    ) AS output_per_m,
    COALESCE(
      (SELECT p.cache_read_per_m FROM pricing p WHERE p.key = s.provider || '/' || s.model),
      (SELECT p.cache_read_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.cache_read_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1),
      0.0
    ) AS cache_read_per_m,
    COALESCE(
      (SELECT p.cache_create_per_m FROM pricing p WHERE p.key = s.provider || '/' || s.model),
      (SELECT p.cache_create_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.cache_create_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1),
      0.0
    ) AS cache_create_per_m,
    COALESCE(s.input_tokens, 0)  AS input_tokens,
    COALESCE(s.output_tokens, 0) AS output_tokens,
    COALESCE((s.metadata->>'cache_read_tokens')::int, 0)     AS cache_read_tokens,
    COALESCE((s.metadata->>'cache_creation_tokens')::int, 0) AS cache_create_tokens
  FROM spans s
  WHERE s.span_type = 'llm_call'
    AND (s.total_cost IS NULL OR s.total_cost = 0)
    AND (s.input_tokens > 0 OR s.output_tokens > 0)
    AND s.model IS NOT NULL
),
costs AS (
  SELECT
    span_id,
    trace_id,
    ROUND(
      (input_tokens  * input_per_m  / 1000000.0)
    + (output_tokens * output_per_m / 1000000.0)
    + (cache_read_tokens   * cache_read_per_m   / 1000000.0)
    + (cache_create_tokens * cache_create_per_m / 1000000.0)
    , 8) AS cost
  FROM resolved
  WHERE input_per_m IS NOT NULL
)
-- Step 1: Update span costs
UPDATE spans
SET total_cost = c.cost
FROM costs c
WHERE spans.id = c.span_id
  AND c.cost > 0;

-- Step 2: Re-aggregate trace totals from updated spans
UPDATE traces t
SET total_cost = COALESCE((
  SELECT SUM(s.total_cost)
  FROM spans s
  WHERE s.trace_id = t.id
    AND s.span_type = 'llm_call'
    AND s.total_cost IS NOT NULL
), 0)
WHERE EXISTS (
  SELECT 1 FROM spans s
  WHERE s.trace_id = t.id
    AND s.span_type = 'llm_call'
    AND s.total_cost > 0
);
