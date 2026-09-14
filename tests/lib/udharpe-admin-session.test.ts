/**
 * The administrator panel's two security controls.
 *
 * Everything else in that panel is a list and some buttons. These two decide
 * whether it can be pointed somewhere it should not be, and whether a
 * hand-written `fetch` can reach past the UI — so they are the parts with
 * tests.
 */

import { describe, expect, it } from "vitest";
import { decideAdminApi, mayForward } from "@/lib/udharpe/admin-session";

describe("which API the admin panel may reach", () => {
  const on = { enabled: "true" };

  it("is off unless it is explicitly turned on", () => {
    // A panel that is on by default is on in every preview deployment and
    // every developer's checkout.
    expect(decideAdminApi({ apiUrl: "https://api.esytol.com" }).enabled).toBe(false);
    expect(decideAdminApi({ enabled: "false", apiUrl: "https://api.esytol.com" }).enabled).toBe(
      false
    );
  });

  it("has no default API URL, so a misconfiguration fails closed", () => {
    const d = decideAdminApi(on);
    expect(d.enabled).toBe(false);
    expect(d.reason).toMatch(/deliberately no default/i);
  });

  it("accepts https", () => {
    expect(decideAdminApi({ ...on, apiUrl: "https://api.esytol.com" })).toMatchObject({
      enabled: true,
      apiUrl: "https://api.esytol.com",
    });
  });

  it("accepts loopback for development, and nothing else in plaintext", () => {
    expect(decideAdminApi({ ...on, apiUrl: "http://127.0.0.1:4000" }).enabled).toBe(true);
    expect(decideAdminApi({ ...on, apiUrl: "http://localhost:4000" }).enabled).toBe(true);
    // The case that matters: plaintext to somewhere real.
    expect(decideAdminApi({ ...on, apiUrl: "http://api.esytol.com" }).enabled).toBe(false);
    expect(decideAdminApi({ ...on, apiUrl: "http://10.0.0.5:4000" }).enabled).toBe(false);
  });

  it("refuses something that is not a URL at all", () => {
    expect(decideAdminApi({ ...on, apiUrl: "api.esytol.com" }).enabled).toBe(false);
  });

  it("trims a trailing slash, so paths do not double up", () => {
    expect(decideAdminApi({ ...on, apiUrl: "https://api.esytol.com/" }).apiUrl).toBe(
      "https://api.esytol.com"
    );
  });
});

describe("what the forwarder will pass through", () => {
  it("allows the administrator operations", () => {
    const id = "0189a1b2-c3d4-4e5f-8091-a2b3c4d5e6f7";
    expect(mayForward("GET", "/api/v1/admin/applications")).toBe(true);
    expect(mayForward("POST", `/api/v1/admin/applications/${id}/approve`)).toBe(true);
    expect(mayForward("POST", `/api/v1/admin/disputes/${id}/decide`)).toBe(true);
    expect(mayForward("GET", "/api/v1/admin/audit?limit=100")).toBe(true);
    expect(mayForward("GET", `/api/v1/admin/captures/${id}`)).toBe(true);
  });

  it("allows only the sign-in operations outside the admin namespace", () => {
    expect(mayForward("POST", "/api/v1/auth/email/request-code")).toBe(true);
    expect(mayForward("POST", "/api/v1/auth/email/verify-code")).toBe(true);
    expect(mayForward("POST", "/api/v1/auth/logout")).toBe(true);
  });

  it("refuses the ledger, sync and everything else", () => {
    // The reason this is an allowlist and not a prefix match: an admin panel
    // that can reach the ledger is an admin panel that can read balances, and
    // an administrator reviews applications, not books.
    for (const path of [
      "/api/v1/me",
      "/api/v1/parties",
      "/api/v1/parties/pty_1/statement",
      "/api/v1/sync/pull",
      "/api/v1/payments",
      "/api/v1/admin/../me",
    ]) {
      expect(mayForward("GET", path), path).toBe(false);
      expect(mayForward("POST", path), path).toBe(false);
    }
  });

  it("refuses a verb the operation does not have", () => {
    expect(mayForward("POST", "/api/v1/admin/applications")).toBe(false);
    expect(mayForward("GET", "/api/v1/admin/applications/x/approve")).toBe(false);
  });

  it("refuses an admin action that is not one of the six", () => {
    // A prefix match would have admitted whatever is added under this path
    // next. The list is the control.
    const id = "0189a1b2-c3d4-4e5f-8091-a2b3c4d5e6f7";
    for (const action of ["delete", "impersonate", "setAmount", "adjust"]) {
      expect(mayForward("POST", `/api/v1/admin/applications/${id}/${action}`), action).toBe(false);
    }
  });

  it("refuses an application id that is not an id", () => {
    expect(mayForward("POST", "/api/v1/admin/applications/*/approve")).toBe(false);
    expect(mayForward("POST", "/api/v1/admin/applications/1/approve")).toBe(false);
  });
});
