-- Backfill costs for OpenRouter-style models (e.g. "openai/gpt-5.4", "anthropic/claude-sonnet-4-5").
-- OpenRouter prefixes model IDs with the upstream provider, e.g. "openai/gpt-5.4".
-- Strip the "vendor/" prefix and resolve against the same pricing table as migration 000035/000036.

WITH pricing (key, input_per_m, output_per_m, cache_read_per_m) AS (
  VALUES
    ('gpt-5',      2.5,  10.0, 1.25),
    ('gpt-5.4',    2.5,  10.0, 1.25),
    ('gpt-5.1',    2.5,  10.0, 1.25),
    ('gpt-5-mini', 0.15,  0.6, 0.075),
    ('gpt-5-nano', 0.05,  0.2, 0.0),
    ('gpt-4o',     2.5,  10.0, 1.25),
    ('gpt-4o-mini',0.15,  0.6, 0.075),
    ('o1',        15.0,  60.0, 7.5),
    ('o3',        10.0,  40.0, 2.5),
    ('o3-mini',    1.1,   4.4, 0.55),
    ('o4-mini',    1.1,   4.4, 0.275),
    ('claude-opus-4-5',   15.0,  75.0, 1.5),
    ('claude-opus-4',     15.0,  75.0, 1.5),
    ('claude-sonnet-4-5',  3.0,  15.0, 0.3),
    ('claude-sonnet-4',    3.0,  15.0, 0.3),
    ('claude-haiku-4-5',   0.8,   4.0, 0.08),
    ('claude-haiku-4',     0.8,   4.0, 0.08),
    ('claude-3-5-sonnet-20241022', 3.0, 15.0, 0.3),
    ('claude-3-5-haiku-20241022',  0.8,  4.0, 0.08),
    ('claude-3-opus-20240229',    15.0, 75.0, 1.5),
    ('gemini-2.5-pro',    1.25, 10.0, 0.0),
    ('gemini-2.5-flash',  0.15,  0.6, 0.0),
    ('gemini-2.0-flash',  0.1,   0.4, 0.0),
    ('gemini-1.5-pro',    1.25,  5.0, 0.0),
    ('gemini-1.5-flash',  0.075, 0.3, 0.0),
    ('deepseek-chat',     0.07,  1.1, 0.0),
    ('deepseek-reasoner', 0.55, 2.19, 0.0)
),
-- Strip the routing-provider prefix from OpenRouter model IDs: "openai/gpt-5.4" → "gpt-5.4"
resolved AS (
  SELECT
    s.id AS span_id,
    s.trace_id,
    -- Normalized model name (strip "vendor/" prefix if present)
    CASE WHEN s.model LIKE '%/%' THEN SUBSTRING(s.model FROM POSITION('/' IN s.model) + 1) ELSE s.model END AS norm_model,
    COALESCE(s.input_tokens, 0)  AS input_tokens,
    COALESCE(s.output_tokens, 0) AS output_tokens,
    COALESCE((s.metadata->>'cache_read_tokens')::int, 0) AS cache_read_tokens
  FROM spans s
  WHERE s.span_type = 'llm_call'
    AND (s.total_cost IS NULL OR s.total_cost = 0)
    AND (s.input_tokens > 0 OR s.output_tokens > 0)
    AND s.model LIKE '%/%'  -- only OpenRouter-style models
),
priced AS (
  SELECT
    r.span_id,
    r.trace_id,
    ROUND(
      (r.input_tokens  * p.input_per_m  / 1000000.0)
    + (r.output_tokens * p.output_per_m / 1000000.0)
    + (r.cache_read_tokens * p.cache_read_per_m / 1000000.0)
    , 8) AS cost
  FROM resolved r
  JOIN pricing p ON (
    p.key = r.norm_model
    OR r.norm_model LIKE p.key || '%'
  )
  -- Take the longest matching prefix (most specific)
  WHERE p.key = (
    SELECT p2.key FROM pricing p2
    WHERE r.norm_model = p2.key OR r.norm_model LIKE p2.key || '%'
    ORDER BY length(p2.key) DESC
    LIMIT 1
  )
)
UPDATE spans
SET total_cost = priced.cost
FROM priced
WHERE spans.id = priced.span_id
  AND priced.cost > 0;

-- Re-aggregate trace totals
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
    AND s.model LIKE '%/%'
);
