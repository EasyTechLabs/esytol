-- 002 — fields the statement projection needs.
--
-- Both are already carried by the `CreditRecorded` event; the projection simply
-- was not surfacing them. Adding them here rather than deriving from `events`
-- on every read keeps the statement a plain indexed query.
--
-- Additive and nullable, so existing rows stay valid. The projection is a cache
-- rebuildable from the log, so no backfill correctness question arises: replay
-- fills these in.

ALTER TABLE entry_projection
  ADD COLUMN IF NOT EXISTS description text;

-- The immutable event this entry came from. The audit handle that lets a
-- statement row be traced back to the exact event that produced it.
ALTER TABLE entry_projection
  ADD COLUMN IF NOT EXISTS event_id text;

-- Statement reads are always "one party, oldest first". Ordering by
-- (created_at, entry_id) keeps the running balance stable across reads when two
-- entries share a millisecond.
CREATE INDEX IF NOT EXISTS entry_projection_statement_idx
  ON entry_projection (merchant_id, party_id, created_at, entry_id);
