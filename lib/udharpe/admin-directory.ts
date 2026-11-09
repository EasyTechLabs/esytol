/**
 * The admin directory's upstream path, built from a browser request.
 *
 * Only three things pass through, each checked: a search term (trimmed, at
 * most 100 characters), a page size clamped to 1–200, and — for relationships
 * — a status from the known list. Anything else in the query string is
 * dropped rather than forwarded, so the panel cannot be used to reach an API
 * parameter it was never meant to send.
 */

export type DirectoryView = "shops" | "people" | "relationships";

export const RELATIONSHIP_STATUSES = [
  "pending",
  "active",
  "rejected",
  "cancelled",
  "blocked",
  "revoked",
  "expired",
] as const;

export function directoryPath(view: DirectoryView, requestUrl: string): string {
  const incoming = new URL(requestUrl).searchParams;
  const out = new URLSearchParams();

  const q = (incoming.get("q") ?? "").trim().slice(0, 100);
  if (q) out.set("q", q);

  const raw = Number(incoming.get("limit") ?? 50);
  out.set("limit", String(Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 200) : 50));

  const role = incoming.get("role");
  if (view === "people" && (role === "shopkeeper" || role === "customer")) out.set("role", role);

  const status = incoming.get("status");
  if (
    view === "relationships" &&
    status &&
    (RELATIONSHIP_STATUSES as readonly string[]).includes(status)
  ) {
    out.set("status", status);
  }

  return `/api/v1/admin/${view}?${out.toString()}`;
}
