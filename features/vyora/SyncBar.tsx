"use client";

/**
 * Where the sync status actually appears (WEB-SYNC-003).
 *
 * `SyncStatus` is the presentation — a mark, a sentence, and a "Sync now"
 * button — and it takes props so it can be rendered from a test without a
 * provider. This is the three lines that connect it to the running app.
 *
 * **Hidden when there is nothing true to say.** A browser that has not signed
 * into a shop is not failing to sync; it is an offline-first ledger working
 * exactly as designed, and a permanent grey "not syncing" would invite a
 * merchant to go looking for a problem that does not exist. So `idle` with
 * nothing queued renders nothing at all.
 */

import { SyncStatus } from "./SyncStatus";
import { useVyora } from "./VyoraProvider";

export function SyncBar() {
  const { sync, syncNow } = useVyora();

  if (sync.state === "idle" && sync.pending === 0) return null;

  return (
    <div className="mb-3">
      <SyncStatus state={sync.state} pending={sync.pending} onSync={() => void syncNow()} />
    </div>
  );
}
