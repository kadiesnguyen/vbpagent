-- Reverse: reset all span and trace costs to 0.
-- Note: this cannot distinguish retroactively-set costs from originally-set costs,
-- so it resets ALL costs. Only run if you need to fully undo the backfill.
UPDATE spans SET total_cost = NULL WHERE span_type = 'llm_call';
UPDATE traces SET total_cost = 0;
