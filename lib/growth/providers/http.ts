/**
 * Minimal, dependency-free HTTP + safe-JSON helpers for live provider fetchers.
 * Untyped provider responses are read through the `as*` guards so the mapping
 * code stays type-safe (no `any`) even though these paths only run when the
 * relevant credentials are configured.
 */

export async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
export function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
export function asNum(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
export function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
