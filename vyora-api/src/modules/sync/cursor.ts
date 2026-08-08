/**
 * Sync cursors.
 *
 * Opaque to clients, and signed so a cursor this server did not issue is
 * detectable rather than silently accepted. Encodes `(recordedAt, eventId)`:
 * a bare timestamp would skip or repeat events sharing a millisecond, and both
 * failures are invisible until a merchant notices a missing entry.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cursorExpired, cursorInvalid } from "../../errors.js";

export interface CursorPosition {
  readonly recordedAt: string;
  readonly eventId: string;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeCursor(position: CursorPosition, secret: string): string {
  const payload = Buffer.from(`${position.recordedAt}|${position.eventId}`, "utf8").toString(
    "base64url"
  );
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Decode and verify.
 *
 * @throws SYNC_CURSOR_INVALID — malformed, or not issued by this server
 * @throws SYNC_CURSOR_EXPIRED — valid but pointing before the retained window
 */
export function decodeCursor(
  cursor: string,
  secret: string,
  retentionDays: number,
  now: Date = new Date()
): CursorPosition {
  const parts = cursor.split(".");
  if (parts.length !== 2) throw cursorInvalid("Cursor is malformed.");
  const [payload, signature] = parts as [string, string];

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw cursorInvalid("Cursor was not issued by this server.");
  }

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf("|");
  if (separator < 0) throw cursorInvalid("Cursor payload is malformed.");

  const recordedAt = decoded.slice(0, separator);
  const eventId = decoded.slice(separator + 1);
  const at = Date.parse(recordedAt);
  if (Number.isNaN(at)) throw cursorInvalid("Cursor timestamp is not a valid instant.");

  const oldestRetained = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  if (at < oldestRetained) {
    // Recoverable, not fatal: the client restarts the pull with no cursor and
    // re-applies from the beginning. Re-application is keyed on eventId, so it
    // is a no-op for everything already held.
    throw cursorExpired(
      "Cursor points before the retained window. Restart the pull with no cursor."
    );
  }

  return { recordedAt, eventId };
}
