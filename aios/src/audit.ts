/**
 * Audit log (AIOS-004) — the append-only record of everything the orchestrator does (AIOS.md §8).
 *
 * Every dispatch, decision, state transition, approval, failure, and retry is recorded here with full
 * provenance. The log is the source of truth for "what did the AI do and why," and — because it is
 * deterministic given a deterministic clock/id — the basis of golden-task replay.
 */

import type { Clock, IdGenerator } from "./kernel";
import { AIOS_VERSION } from "./kernel";
import type { AuditRecord, PlainData, Provenance } from "./types";

/** A pluggable audit sink; the default keeps records in memory (interface-backed → file/DB later). */
export interface AuditSink {
  append(record: AuditRecord): void;
  all(): readonly AuditRecord[];
}

export class InMemoryAuditSink implements AuditSink {
  private records: AuditRecord[] = [];
  append(record: AuditRecord): void {
    this.records.push(record);
  }
  all(): readonly AuditRecord[] {
    return this.records;
  }
}

export class AuditLog {
  constructor(
    private readonly sink: AuditSink,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  record(action: string, detail: string, provenance: Provenance, data?: PlainData): AuditRecord {
    const entry: AuditRecord = {
      id: this.ids.next("audit"),
      at: this.clock.now(),
      action,
      detail,
      // The audit log is the authority on the AIOS version stamp — it always wins.
      provenance: { ...provenance, aiosVersion: AIOS_VERSION },
      ...(data ? { data } : {}),
    };
    this.sink.append(entry);
    return entry;
  }

  all(): readonly AuditRecord[] {
    return this.sink.all();
  }
}
