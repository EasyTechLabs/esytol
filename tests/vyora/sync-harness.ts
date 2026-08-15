/**
 * A real IndexedDB, and a server that is not a mock of the sync engine.
 *
 * Two decisions hold this harness together.
 *
 * **The database is real.** `fake-indexeddb` is a full implementation of the
 * IndexedDB specification, not a stub of the calls this code happens to make —
 * so transactions really are atomic, unique indexes really refuse duplicates,
 * and a key that sorts wrongly really does come back in the wrong order. A
 * hand-rolled in-memory map would have agreed with whatever the store did,
 * including the bugs.
 *
 * **The server is a small event log with the API's rules**, not a stub that
 * returns canned pages. It deduplicates on `eventId`, stamps its own
 * `recordedAt`, orders by `(recordedAt, eventId)`, and paginates with the same
 * opaque-cursor contract. That is what makes "no duplicates" and "the cursor
 * advances" testable properties rather than assertions about a fixture.
 *
 * Network failure is simulated by refusing to answer — the same thing a dropped
 * connection does — rather than by making the engine's own functions throw.
 * The engine cannot tell the difference, which is the point: nothing in these
 * tests reaches inside it.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDatabase } from "@/lib/vyora/sync/store";
import { resetInFlight } from "@/lib/vyora/sync/engine";

/** A brand-new IndexedDB per test, so nothing leaks between cases. */
export async function freshDatabase(): Promise<IDBDatabase> {
  // Replacing the factory is how fake-indexeddb resets: deleting the database
  // races with connections the previous test may still hold.
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetInFlight();
  return openDatabase();
}

export interface ServerEvent {
  readonly eventId: string;
  readonly type: string;
  readonly aggregateId: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

export interface FakeServerOptions {
  /** Refuse to answer, as a dropped connection does. */
  offline?: boolean;
  /** Answer 401, as an expired session does. */
  unauthorized?: boolean;
  /** Answer 500 on the next N requests, then behave. */
  failNext?: number;
  /** Events per pull page, so pagination is exercised at a testable size. */
  pageSize?: number;
}

/**
 * A shop's log, and the two operations over it.
 *
 * `recordedAt` is minted monotonically rather than from the clock: two events
 * accepted in the same millisecond would otherwise tie, and the ordering under
 * test is exactly the one a tie would hide.
 */
export class FakeServer {
  readonly log: ServerEvent[] = [];
  options: FakeServerOptions;
  /** Every request the engine made, for asserting it did not storm. */
  readonly requests: { method: string; url: string }[] = [];
  private clock = 0;

  constructor(options: FakeServerOptions = {}) {
    this.options = options;
  }

  private stamp(): string {
    this.clock += 1;
    return new Date(Date.UTC(2026, 7, 15, 0, 0, 0, this.clock)).toISOString();
  }

  /** An event recorded by somebody else — a phone, or another browser. */
  receiveFromOtherClient(event: Omit<ServerEvent, "recordedAt">): ServerEvent {
    const stored = { ...event, recordedAt: this.stamp() };
    this.log.push(stored);
    return stored;
  }

  get fetch(): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      this.requests.push({ method, url });

      if (this.options.offline) throw new TypeError("Failed to fetch");
      if (this.options.failNext && this.options.failNext > 0) {
        this.options.failNext -= 1;
        return json(500, { error: { code: "INTERNAL_ERROR", message: "Server error." } });
      }
      if (this.options.unauthorized) {
        return json(401, { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
      }

      if (url.startsWith("/api/vyora-sync/push")) return this.push(init);
      if (url.startsWith("/api/vyora-sync/pull")) return this.pull(url);
      return json(404, { error: { code: "NOT_FOUND", message: "No such route." } });
    }) as typeof fetch;
  }

  private push(init?: RequestInit): Response {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      deviceId?: string;
      schemaVersion: number;
      events: ServerEvent[];
    };

    // The web client must never send one. ADR-0016 moved attribution to the
    // server precisely so a browser does not have to invent a device, and a
    // client that started sending one again would be quietly undoing that.
    if (body.deviceId !== undefined) {
      return json(400, {
        error: { code: "BAD_REQUEST", message: "The browser must not send a deviceId." },
      });
    }

    const accepted: { eventId: string; recordedAt: string }[] = [];
    const duplicate: { eventId: string; recordedAt: string }[] = [];

    for (const event of body.events ?? []) {
      const existing = this.log.find((e) => e.eventId === event.eventId);
      if (existing) {
        // A duplicate keeps its ORIGINAL recordedAt. An event's place in
        // history must never move, or a cursor could step over it.
        duplicate.push({ eventId: existing.eventId, recordedAt: existing.recordedAt });
        continue;
      }
      const stored: ServerEvent = { ...event, recordedAt: this.stamp() };
      this.log.push(stored);
      accepted.push({ eventId: stored.eventId, recordedAt: stored.recordedAt });
    }

    return json(200, {
      accepted,
      duplicate,
      rejected: [],
      cursor: "",
      serverTime: new Date().toISOString(),
    });
  }

  private pull(url: string): Response {
    const query = new URL(url, "http://localhost").searchParams;
    const cursor = query.get("cursor");
    const size = this.options.pageSize ?? Number(query.get("limit") ?? 200);

    const ordered = [...this.log].sort((a, b) =>
      a.recordedAt === b.recordedAt
        ? a.eventId.localeCompare(b.eventId)
        : a.recordedAt.localeCompare(b.recordedAt)
    );
    const after = cursor ? ordered.findIndex((e) => cursorOf(e) === cursor) + 1 : 0;
    const page = ordered.slice(after, after + size);
    const hasMore = after + size < ordered.length;
    const last = page[page.length - 1];

    return json(200, {
      events: page,
      nextCursor: last ? cursorOf(last) : cursor,
      hasMore,
      serverTime: new Date().toISOString(),
    });
  }
}

/** Opaque to the client, which is the only property of a cursor that matters. */
function cursorOf(event: ServerEvent): string {
  return `${event.recordedAt}|${event.eventId}`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
