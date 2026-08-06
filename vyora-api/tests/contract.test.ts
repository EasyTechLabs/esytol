/**
 * Contract validity and implementation parity.
 *
 * The contract is the source of truth, so "the code drifted from the spec" must
 * be a test failure rather than something a reviewer notices later. These
 * assertions compare the registered routes to the contract's operations in both
 * directions — an undocumented endpoint fails just as loudly as a missing one.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { loadContract } from "../src/contract.js";
import { startHarness, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const contract = loadContract();

describe("OpenAPI contract", () => {
  it("is OpenAPI 3.1 with the /api/v1 prefix on every path", () => {
    expect(contract.document.openapi).toBe("3.1.0");
    for (const op of contract.operations) {
      expect(op.path.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("declares exactly the eight approved operations", () => {
    const actual = contract.operations.map((o) => `${o.method} ${o.path}`).sort();
    expect(actual).toEqual(
      [
        "GET /api/v1/health",
        "GET /api/v1/me",
        "GET /api/v1/parties",
        "POST /api/v1/parties",
        "GET /api/v1/parties/{partyId}",
        "PATCH /api/v1/parties/{partyId}",
        "POST /api/v1/sync/push",
        "GET /api/v1/sync/pull",
      ].sort()
    );
  });

  it("never accepts a merchantId in any request", () => {
    // Tenant scope comes from the token. A caller that cannot name a workspace
    // cannot reach the wrong one, whatever a handler forgets to check.
    interface Operation {
      parameters?: Array<{ name?: string }>;
      requestBody?: unknown;
    }
    const paths = contract.document.paths as Record<string, Record<string, Operation>>;
    const offenders: string[] = [];

    for (const [path, item] of Object.entries(paths)) {
      if (/merchant/i.test(path)) offenders.push(`path ${path}`);
      for (const [method, op] of Object.entries(item)) {
        if (typeof op !== "object" || op === null) continue;
        for (const p of op.parameters ?? []) {
          if (/^merchant_?id$/i.test(p.name ?? "")) offenders.push(`${method} ${path} param`);
        }
        if (/"merchantId"/.test(JSON.stringify(op.requestBody ?? {}))) {
          offenders.push(`${method} ${path} body`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no Customer or Supplier entity and no role field on a party", () => {
    const schemas = contract.document.components as { schemas: Record<string, unknown> };
    const names = Object.keys(schemas.schemas);
    expect(names.filter((n) => /customer|supplier/i.test(n))).toEqual([]);

    const party = schemas.schemas.Party as { properties: Record<string, unknown> };
    for (const forbidden of ["role", "type", "isCustomer", "partyType"]) {
      expect(Object.keys(party.properties)).not.toContain(forbidden);
    }
  });
});

describe("implementation parity", () => {
  it("registers a route for every contract operation, and no extras", () => {
    // Collected from Fastify's onRoute hook, so this compares what is actually
    // registered rather than a regex over printed output.
    const registered = [...h.routes].sort();
    const expected = contract.operations.map((o) => `${o.method} ${o.path}`).sort();
    expect(registered).toEqual(expected);
  });

  it("validates a request body against the contract, not a hand-written copy", () => {
    expect(contract.validate("CreatePartyRequest", { id: "nope", name: "x" })).not.toBeNull();
    expect(
      contract.validate("CreatePartyRequest", {
        id: "pty_11111111-1111-4111-8111-111111111111",
        name: "Valid",
      })
    ).toBeNull();
  });

  it("rejects a request body carrying an undeclared field", () => {
    const problems = contract.validate("CreatePartyRequest", {
      id: "pty_11111111-1111-4111-8111-111111111111",
      name: "Valid",
      merchantId: "22222222-2222-4222-8222-222222222222",
    });
    expect(problems).not.toBeNull();
    expect(problems!.some((p) => p.code === "NOT_ALLOWED")).toBe(true);
  });
});
