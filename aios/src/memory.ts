/**
 * Memory (AIOS-004) — the scoped, versioned store + the loader that binds a read-only snapshot to a
 * task (MemoryArchitecture.md). Agents are stateless; AIOS remembers. Writes supersede (never
 * overwrite), so history is preserved and a corrupted value can be restored from a prior version.
 */

import { deepClone, deepFreeze } from "./kernel";
import type { MemorySnapshot, MemoryWrite } from "./types";

interface VersionedValue {
  value: unknown;
  version: number;
}

/** Interface-backed store (in-memory reference impl; a file/DB backend slots in behind this later). */
export interface MemoryStore {
  read(scope: string, key: string): unknown;
  /** Write a value; returns the new version. Supersede, not overwrite. */
  write(scope: string, key: string, value: unknown): number;
  keys(scope: string): string[];
  /** Full history of a key (newest last) — enables restore-from-good. */
  history(scope: string, key: string): readonly VersionedValue[];
}

export class InMemoryMemoryStore implements MemoryStore {
  private data = new Map<string, Map<string, VersionedValue[]>>();

  private scopeMap(scope: string): Map<string, VersionedValue[]> {
    let m = this.data.get(scope);
    if (!m) {
      m = new Map();
      this.data.set(scope, m);
    }
    return m;
  }

  read(scope: string, key: string): unknown {
    const versions = this.data.get(scope)?.get(key);
    if (!versions || versions.length === 0) return undefined;
    return deepClone(versions[versions.length - 1].value);
  }

  write(scope: string, key: string, value: unknown): number {
    const m = this.scopeMap(scope);
    const versions = m.get(key) ?? [];
    const version = versions.length + 1;
    versions.push({ value: deepClone(value), version });
    m.set(key, versions);
    return version;
  }

  keys(scope: string): string[] {
    return Array.from(this.data.get(scope)?.keys() ?? []);
  }

  history(scope: string, key: string): readonly VersionedValue[] {
    return this.data.get(scope)?.get(key) ?? [];
  }
}

/** Raised when a task attempts to write a scope it was not granted. */
export class MemoryPermissionError extends Error {
  constructor(readonly scope: string) {
    super(`Memory write denied for scope "${scope}"`);
    this.name = "MemoryPermissionError";
  }
}

/**
 * Builds the deeply-frozen read-only snapshot the runtime binds to a task (from the agent's granted
 * read scopes), and applies declared writes only to granted write scopes.
 */
export class MemoryLoader {
  constructor(private readonly store: MemoryStore) {}

  snapshot(readScopes: readonly string[]): MemorySnapshot {
    const snap: Record<string, Record<string, unknown>> = {};
    for (const scope of readScopes) {
      const entries: Record<string, unknown> = {};
      for (const key of this.store.keys(scope)) entries[key] = this.store.read(scope, key);
      snap[scope] = entries;
    }
    return deepFreeze(snap);
  }

  applyWrites(writes: readonly MemoryWrite[], writeScopes: readonly string[]): void {
    for (const w of writes) {
      if (!writeScopes.includes(w.scope)) throw new MemoryPermissionError(w.scope);
      this.store.write(w.scope, w.key, w.value);
    }
  }
}
