/**
 * The only thing sync says to a merchant.
 *
 * Mostly a test that it says *little*: no cursor, no outbox, no device, no
 * event log. The other half is that "offline" does not read as a failure — the
 * work is recorded and safe, and telling someone their entry failed when it
 * did not is its own kind of data loss.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncStatus, describeSync, toneFor } from "@/features/vyora/SyncStatus";
import type { SyncState } from "@/lib/vyora/sync/engine";

const FORBIDDEN = /cursor|outbox|event log|device_id|deviceId|IndexedDB|schemaVersion|payload/i;

const ALL_STATES: SyncState[] = [
  "idle",
  "auth-required",
  "pushing",
  "pulling",
  "synced",
  "offline",
  "retry-wait",
  "error",
];

describe("the sync indicator", () => {
  it("never uses technical language, in any state", () => {
    for (const state of ALL_STATES) {
      for (const pending of [0, 1, 7]) {
        expect(describeSync(toneFor(state), pending)).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("maps every state to one of the four the merchant sees", () => {
    expect(toneFor("synced")).toBe("synced");
    expect(toneFor("pushing")).toBe("syncing");
    expect(toneFor("pulling")).toBe("syncing");
    expect(toneFor("offline")).toBe("offline");
    expect(toneFor("retry-wait")).toBe("offline");
    expect(toneFor("error")).toBe("needs-attention");
    expect(toneFor("auth-required")).toBe("signed-out");
  });

  it("says the work is safe when offline, not that it failed", () => {
    const message = describeSync("offline", 3);

    expect(message).toContain("Saved on this device");
    expect(message).not.toMatch(/fail|error|lost|could not save/i);
  });

  it("counts one entry as one entry", () => {
    expect(describeSync("offline", 1)).toContain("1 entry will send");
    expect(describeSync("offline", 2)).toContain("2 entries will send");
  });

  it("renders the state without shouting over someone mid-entry", () => {
    render(<SyncStatus state="synced" pending={0} />);

    const status = screen.getByTestId("vyora-sync-status");
    expect(status).toHaveAttribute("data-tone", "synced");
    // Polite, so a sync finishing does not interrupt a screen reader user
    // typing an amount.
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Up to date on all your devices.");
  });

  it("offers a manual sync except while one is running", () => {
    const { rerender } = render(<SyncStatus state="offline" pending={2} onSync={() => {}} />);
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument();

    rerender(<SyncStatus state="pushing" pending={2} onSync={() => {}} />);
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });
});
