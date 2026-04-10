-- Backfill costs for gpt-5 series models not covered by migration 000035.
-- Same logic as 000035 but scoped to gpt-5 model prefix.

WITH pricing (key, input_per_m, output_per_m, cache_read_per_m) AS (
  VALUES
    ('gpt-5',      2.5,  10.0, 1.25),
    ('gpt-5.4',    2.5,  10.0, 1.25),
    ('gpt-5.1',    2.5,  10.0, 1.25),
    ('gpt-5-mini', 0.15,  0.6, 0.075),
    ('gpt-5-nano', 0.05,  0.2, 0.0)
),
resolved AS (
  SELECT
    s.id AS span_id,
    s.trace_id,
    COALESCE(
      (SELECT p.input_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.input_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1)
    ) AS input_per_m,
    COALESCE(
      (SELECT p.output_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.output_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1)
    ) AS output_per_m,
    COALESCE(
      (SELECT p.cache_read_per_m FROM pricing p WHERE p.key = s.model),
      (SELECT p.cache_read_per_m FROM pricing p WHERE s.model LIKE p.key || '%' ORDER BY length(p.key) DESC LIMIT 1),
      0.0
    ) AS cache_read_per_m,
    COALESCE(s.input_tokens, 0)  AS input_tokens,
    COALESCE(s.output_tokens, 0) AS output_tokens,
    COALESCE((s.metadata->>'cache_read_tokens')::int, 0) AS cache_read_tokens
  FROM spans s
  WHERE s.span_type = 'llm_call'
    AND (s.total_cost IS NULL OR s.total_cost = 0)
    AND (s.input_tokens > 0 OR s.output_tokens > 0)
    AND s.model LIKE 'gpt-5%'
),
costs AS (
  SELECT
    span_id,
    trace_id,
    ROUND(
      (input_tokens  * input_per_m  / 1000000.0)
    + (output_tokens * output_per_m / 1000000.0)
    + (cache_read_tokens * cache_read_per_m / 1000000.0)
    , 8) AS cost
  FROM resolved
  WHERE input_per_m IS NOT NULL
)
UPDATE spans
SET total_cost = c.cost
FROM costs c
WHERE spans.id = c.span_id
  AND c.cost > 0;

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
    AND s.model LIKE 'gpt-5%'
);
