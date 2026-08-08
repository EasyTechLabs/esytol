/**
 * Synthetic seed data.
 *
 * Two merchant workspaces with independent parties, devices and events. They
 * exist so tenant isolation can be *tested* rather than asserted: every
 * isolation test reads workspace A's resource with workspace B's credentials
 * and requires a 404.
 *
 * Everything here is invented. No real merchant, customer, phone number or
 * amount appears in this file.
 */

import { createPool, withTransaction, type Pool, type PoolClient } from "../db/pool.js";
import { appendAndApply } from "../events/apply.js";
import { loadConfig } from "../config.js";
import { isMainModule } from "../main-module.js";

export interface SeededWorkspace {
  readonly merchantId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly secondDeviceId: string;
  readonly token: string;
  readonly devIdentity: string;
  readonly displayName: string;
  readonly partyIds: readonly string[];
}

export interface SeedResult {
  readonly alpha: SeededWorkspace;
  readonly beta: SeededWorkspace;
  readonly expiredToken: string;
}

// Fixed UUIDs so tests can reason about them without a lookup round-trip.
const ALPHA: SeededWorkspace = {
  merchantId: "11111111-1111-4111-8111-111111111111",
  userId: "11111111-1111-4111-8111-1111111111a1",
  deviceId: "11111111-1111-4111-8111-1111111111d1",
  secondDeviceId: "11111111-1111-4111-8111-1111111111d2",
  token: "alpha-token-synthetic",
  devIdentity: "alpha",
  displayName: "Alpha Kirana Store (synthetic)",
  partyIds: [
    "pty_aaaaaaa1-1111-4111-8111-aaaaaaaaaaa1",
    "pty_aaaaaaa2-1111-4111-8111-aaaaaaaaaaa2",
    "pty_aaaaaaa3-1111-4111-8111-aaaaaaaaaaa3",
  ],
};

const BETA: SeededWorkspace = {
  merchantId: "22222222-2222-4222-8222-222222222222",
  userId: "22222222-2222-4222-8222-2222222222b1",
  deviceId: "22222222-2222-4222-8222-2222222222d1",
  secondDeviceId: "22222222-2222-4222-8222-2222222222d2",
  token: "beta-token-synthetic",
  devIdentity: "beta",
  displayName: "Beta Cloth House (synthetic)",
  partyIds: [
    "pty_bbbbbbb1-2222-4222-8222-bbbbbbbbbbb1",
    "pty_bbbbbbb2-2222-4222-8222-bbbbbbbbbbb2",
  ],
};

const EXPIRED_TOKEN = "alpha-token-expired";

let counter = 0;
/** Deterministic ids — a seed that differs between runs makes tests flaky. */
const nextId = (prefix: string): string =>
  `${prefix}_${(++counter).toString().padStart(4, "0")}-seed-4000-8000-000000000000`;

async function seedWorkspace(client: PoolClient, ws: SeededWorkspace, schemaVersion: number) {
  await client.query(`INSERT INTO merchants (merchant_id, display_name) VALUES ($1, $2)`, [
    ws.merchantId,
    ws.displayName,
  ]);
  await client.query(
    `INSERT INTO users (user_id, merchant_id, display_name, role) VALUES ($1, $2, $3, 'owner')`,
    [ws.userId, ws.merchantId, `${ws.displayName} owner`]
  );
  for (const [deviceId, label] of [
    [ws.deviceId, "primary phone"],
    [ws.secondDeviceId, "counter tablet"],
  ] as const) {
    await client.query(`INSERT INTO devices (device_id, merchant_id, label) VALUES ($1, $2, $3)`, [
      deviceId,
      ws.merchantId,
      label,
    ]);
  }
  await client.query(
    `INSERT INTO access_tokens (token, merchant_id, user_id, device_id, expires_at)
     VALUES ($1, $2, $3, $4, NULL)`,
    [ws.token, ws.merchantId, ws.userId, ws.deviceId]
  );
  await client.query(
    `INSERT INTO dev_identities (name, merchant_id, user_id, device_id) VALUES ($1, $2, $3, $4)`,
    [ws.devIdentity, ws.merchantId, ws.userId, ws.deviceId]
  );

  // Parties and entries are created the same way a device would create them:
  // as events, through the one application path.
  const base = Date.parse("2026-07-01T09:00:00.000Z");
  let index = 0;

  for (const partyId of ws.partyIds) {
    const createdAt = new Date(base + index * 3_600_000).toISOString();
    await appendAndApply(client, ws.merchantId, ws.deviceId, schemaVersion, {
      eventId: nextId("evt"),
      type: "ContactCreated",
      aggregateId: partyId,
      payloadVersion: 1,
      occurredAt: createdAt,
      payload: {
        party: {
          id: partyId,
          name: `${ws.devIdentity} party ${index + 1}`,
          phone: `90000000${index + 1}`,
          note: null,
          createdAt,
        },
      },
    });

    // Every third party is net-negative, so `merchant_owes` is a state the
    // tests actually exercise rather than one that never occurs. This is the
    // whole reason role is not stored: the same party sits on either side.
    const supplier = index % 3 === 2;
    await appendAndApply(client, ws.merchantId, ws.deviceId, schemaVersion, {
      eventId: nextId("evt"),
      type: "CreditRecorded",
      aggregateId: partyId,
      payloadVersion: 1,
      occurredAt: createdAt,
      payload: {
        transaction: {
          id: nextId("txn"),
          partyId,
          amount: supplier ? 500 : 1500,
          kind: supplier ? "taken" : "given",
          description: supplier ? "stock taken on credit" : "goods given on credit",
          date: "2026-07-01",
          dueDate: null,
          createdAt,
        },
      },
    });

    index += 1;
  }
}

export async function seed(pool: Pool, schemaVersion = 1): Promise<SeedResult> {
  await withTransaction(pool, async (client) => {
    // Idempotent: a re-seed starts from a clean slate rather than colliding.
    await client.query(
      `TRUNCATE idempotency_keys, entry_projection, party_projection, events,
                dev_identities, access_tokens, devices, users, merchants RESTART IDENTITY CASCADE`
    );
    counter = 0;
    await seedWorkspace(client, ALPHA, schemaVersion);
    await seedWorkspace(client, BETA, schemaVersion);

    await client.query(
      `INSERT INTO access_tokens (token, merchant_id, user_id, device_id, expires_at)
       VALUES ($1, $2, $3, $4, now() - interval '1 day')`,
      [EXPIRED_TOKEN, ALPHA.merchantId, ALPHA.userId, ALPHA.deviceId]
    );
  });

  return { alpha: ALPHA, beta: BETA, expiredToken: EXPIRED_TOKEN };
}

export const workspaces = { alpha: ALPHA, beta: BETA, expiredToken: EXPIRED_TOKEN };

if (isMainModule(import.meta.url)) {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  try {
    const result = await seed(pool, config.schemaVersion);
    console.log(
      `seeded 2 synthetic workspaces:\n` +
        `  ${result.alpha.displayName}  token=${result.alpha.token}  dev=${result.alpha.devIdentity}\n` +
        `  ${result.beta.displayName}   token=${result.beta.token}   dev=${result.beta.devIdentity}`
    );
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
