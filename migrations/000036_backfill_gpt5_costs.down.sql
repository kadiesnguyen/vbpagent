-- Reset costs for gpt-5 series spans
UPDATE spans SET total_cost = NULL WHERE span_type = 'llm_call' AND model LIKE 'gpt-5%';
UPDATE traces t SET total_cost = COALESCE((
  SELECT SUM(s.total_cost) FROM spans s
  WHERE s.trace_id = t.id AND s.span_type = 'llm_call' AND s.total_cost IS NOT NULL
), 0);
