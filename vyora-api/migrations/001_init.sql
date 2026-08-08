-- 001_init — the whole schema.
--
-- Two kinds of table, and the distinction is the point:
--   `events`      is the record. Append-only, immutable, never updated.
--   `*_projection` are caches. Rebuildable from events at any time.
-- If a projection and the log disagree, the log wins and the projection is
-- rebuilt. That is why no projection is ever authoritative and why there is
-- no balance column anywhere.

-- ── Tenancy ─────────────────────────────────────────────────────────────────

CREATE TABLE merchants (
  merchant_id   uuid PRIMARY KEY,
  display_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  user_id       uuid PRIMARY KEY,
  merchant_id   uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  display_name  text,
  role          text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner'))
);

CREATE TABLE devices (
  device_id     uuid PRIMARY KEY,
  merchant_id   uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  label         text,
  registered_at timestamptz NOT NULL DEFAULT now()
);

-- Synthetic bearer tokens. A local stand-in for an identity provider, which is
-- a Phase E decision. The token is the ONLY thing that resolves tenant scope.
CREATE TABLE access_tokens (
  token         text PRIMARY KEY,
  merchant_id   uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id     uuid NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  expires_at    timestamptz
);

-- Fixture workspaces reachable by the development identity header. There is no
-- path from this table to a real merchant record, which is what keeps the
-- development scheme unable to address real data even if every other control
-- failed.
CREATE TABLE dev_identities (
  name          text PRIMARY KEY,
  merchant_id   uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id     uuid NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE
);

-- ── The record ──────────────────────────────────────────────────────────────

CREATE TABLE events (
  merchant_id     uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  event_id        text NOT NULL,
  device_id       uuid NOT NULL,
  type            text NOT NULL,
  aggregate_id    text,
  payload         jsonb NOT NULL,
  payload_version integer NOT NULL,
  schema_version  integer NOT NULL,
  -- Device clock. Orders the merchant-visible timeline. Never a cursor.
  occurred_at     timestamptz(3) NOT NULL,
  -- Server clock. Orders the sync cursor. The only order all devices agree on.
  --
  -- Millisecond precision, deliberately. A cursor round-trips through ISO-8601,
  -- which carries milliseconds; storing microseconds would truncate the cursor
  -- on the way out and re-serve the last event of every page forever. Ties
  -- within a millisecond are what the event_id half of the cursor is for.
  recorded_at     timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  causation_id    text,
  PRIMARY KEY (merchant_id, event_id)
);

-- The pull cursor is (recorded_at, event_id), so ties within a millisecond are
-- neither skipped nor repeated across pages.
CREATE INDEX events_cursor_idx ON events (merchant_id, recorded_at, event_id);
CREATE INDEX events_aggregate_idx ON events (merchant_id, aggregate_id);

-- ── Projections (rebuildable caches) ────────────────────────────────────────

CREATE TABLE party_projection (
  merchant_id uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  party_id    text NOT NULL,
  name        text NOT NULL,
  phone       text,
  note        text,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  -- A tombstone, not a deletion. Every event about the party stays in the log.
  deleted     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (merchant_id, party_id)
);

-- Flattened credits and payments. `direction` is the entry's, never the party's
-- — which is what lets one party be owed-from and owed-to over time.
CREATE TABLE entry_projection (
  merchant_id   uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  entry_id      text NOT NULL,
  party_id      text NOT NULL,
  entry_type    text NOT NULL CHECK (entry_type IN ('credit', 'payment')),
  direction     text NOT NULL CHECK (direction IN ('given', 'taken', 'received', 'paid')),
  amount        bigint NOT NULL CHECK (amount >= 0),
  business_date date NOT NULL,
  due_date      date,
  created_at    timestamptz NOT NULL,
  deleted       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (merchant_id, entry_id)
);

CREATE INDEX entry_projection_party_idx ON entry_projection (merchant_id, party_id);

-- ── Idempotency ─────────────────────────────────────────────────────────────

-- Scoped per merchant on purpose. A global unique index on the key looks
-- correct until two workspaces generate the same UUID — rare, but a
-- cross-tenant information leak when it happens.
CREATE TABLE idempotency_keys (
  merchant_id     uuid NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  key             uuid NOT NULL,
  fingerprint     text NOT NULL,
  response_status integer NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, key)
);
