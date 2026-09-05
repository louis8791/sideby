ALTER TABLE venue_recommendation_index_entries
  ALTER COLUMN price_min_twd DROP NOT NULL,
  ALTER COLUMN price_max_twd DROP NOT NULL;

ALTER TABLE venue_recommendation_index_entries
  DROP CONSTRAINT IF EXISTS venue_recommendation_index_entries_price_basis_check;

ALTER TABLE venue_recommendation_index_entries
  ADD CONSTRAINT venue_recommendation_index_entries_price_basis_check
  CHECK (price_basis IN ('person', 'couple', 'entry', 'unknown'));
