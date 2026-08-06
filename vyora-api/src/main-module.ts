import { pathToFileURL } from "node:url";

/**
 * True when this module is the script Node was invoked with.
 *
 * Hand-rolling this as `import.meta.url === "file://" + argv[1]` is wrong on
 * Windows: `import.meta.url` is `file:///C:/...` (three slashes, drive letter
 * encoded) while a naive join produces `file://C:/...`. The comparison silently
 * fails, so `db:migrate` and `db:seed` exit 0 having done nothing — which looks
 * exactly like success. `pathToFileURL` does the platform-correct conversion.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return pathToFileURL(entry).href === moduleUrl;
}
