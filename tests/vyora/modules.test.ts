/**
 * Vyora — Feature module contract tests (ARCH-005).
 *
 * The objective was "core must know nothing about module internals". That is a
 * claim about imports and ownership, so it is checked the same way ARCH-003's
 * boundary was: against the real files and the real command engine.
 *
 *  - every command the engine can execute is owned by exactly ONE module (or by
 *    core) — no orphans, no two modules claiming the same write;
 *  - every route a module declares has a real page file behind it;
 *  - the shell imports the registry and no module directly.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CommandType } from "@/lib/vyora/commands";
import {
  CORE_COMMANDS,
  CORE_ROUTES,
  MODULES,
  allRoutes,
  findModule,
  navRoutes,
  ownerOfCommand,
} from "@/features/vyora/modules";

const ROOT = process.cwd();
const MODULE_DIR = join(ROOT, "features", "vyora", "modules");

/** Every command the engine understands, read from its own source. */
function commandTypesFromEngine(): CommandType[] {
  const source = readFileSync(join(ROOT, "lib", "vyora", "commands.ts"), "utf8");
  const union = source.slice(
    source.indexOf("export type Command ="),
    source.indexOf("export type CommandType")
  );
  const found = union.match(/type:\s*"([A-Za-z]+)"/g) ?? [];
  return found.map((match) => match.replace(/type:\s*"|"/g, "") as CommandType);
}

describe("the registry is well formed", () => {
  it("gives every module a unique id", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every module a title and a merchant-readable summary", () => {
    for (const feature of MODULES) {
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.summary.length).toBeGreaterThan(10);
    }
  });

  it("looks a module up by id", () => {
    expect(findModule("contacts")?.title).toBe("Contacts");
    expect(findModule("nope")).toBeUndefined();
  });
});

describe("command ownership is total and exclusive", () => {
  const engineCommands = commandTypesFromEngine();

  it("reads a sane command list out of the engine", () => {
    expect(engineCommands.length).toBeGreaterThanOrEqual(9);
    expect(engineCommands).toContain("RecordCredit");
    expect(engineCommands).toContain("BackupLedger");
  });

  it("assigns every engine command exactly one owner", () => {
    for (const command of engineCommands) {
      expect({ command, owner: ownerOfCommand(command) }).not.toEqual({
        command,
        owner: undefined,
      });
    }
  });

  it("never lets two modules claim the same command", () => {
    const claimed = MODULES.flatMap((m) => m.commands);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("never lets a module claim a core command", () => {
    for (const feature of MODULES) {
      for (const command of feature.commands) {
        expect({ module: feature.id, command, isCore: CORE_COMMANDS.includes(command) }).toEqual({
          module: feature.id,
          command,
          isCore: false,
        });
      }
    }
  });

  it("declares no command the engine does not have", () => {
    const known = new Set<string>(engineCommands);
    for (const command of [...CORE_COMMANDS, ...MODULES.flatMap((m) => m.commands)]) {
      expect({ command, known: known.has(command) }).toEqual({ command, known: true });
    }
  });
});

describe("declared routes exist on disk", () => {
  /** "/vyora/parties/[id]" → app/vyora/parties/[id]/page.tsx */
  function pageFileFor(path: string): string {
    return join(ROOT, "app", ...path.split("/").filter(Boolean), "page.tsx");
  }

  it("backs every declared route with a real page file", () => {
    for (const route of allRoutes()) {
      expect({ path: route.path, exists: existsSync(pageFileFor(route.path)) }).toEqual({
        path: route.path,
        exists: true,
      });
    }
  });

  it("puts every nav route in the full route list", () => {
    for (const route of navRoutes()) {
      expect(allRoutes()).toContain(route);
    }
  });

  it("keeps the core's own routes in the map", () => {
    expect(CORE_ROUTES.map((r) => r.path)).toContain("/vyora");
  });
});

describe("core knows nothing about module internals", () => {
  const moduleFiles = readdirSync(MODULE_DIR).filter(
    (name) => /\.tsx?$/.test(name) && name !== "index.ts" && name !== "types.ts"
  );

  it("finds the module files it is supposed to be checking", () => {
    expect(moduleFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("lets the shell import the registry, never a module file", () => {
    const shell = readFileSync(join(ROOT, "features", "vyora", "AppShell.tsx"), "utf8");
    expect(shell).toMatch(/from\s+["']\.\/modules["']/);
    for (const file of moduleFiles) {
      const stem = file.replace(/\.tsx?$/, "");
      expect({ stem, imported: shell.includes(`modules/${stem}`) }).toEqual({
        stem,
        imported: false,
      });
    }
  });

  it("names no module in the shell's logic", () => {
    const shell = readFileSync(join(ROOT, "features", "vyora", "AppShell.tsx"), "utf8");
    for (const feature of MODULES) {
      expect({ id: feature.id, named: shell.includes(`"${feature.id}"`) }).toEqual({
        id: feature.id,
        named: false,
      });
    }
  });

  it("keeps modules from importing each other", () => {
    for (const file of moduleFiles) {
      const source = readFileSync(join(MODULE_DIR, file), "utf8");
      for (const other of moduleFiles) {
        if (other === file) continue;
        const stem = other.replace(/\.tsx?$/, "");
        expect({ file, imports: stem, yes: source.includes(`./${stem}`) }).toEqual({
          file,
          imports: stem,
          yes: false,
        });
      }
    }
  });
});
