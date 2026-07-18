/**
 * YAML feature detection — the analysis layer for the JSON ↔ YAML Converter (DEVELOPER-002).
 *
 * js-yaml resolves anchors, aliases, and merge keys silently during `load`, so a converted
 * document gives no hint that they were present. This module scans the *raw* YAML text to
 * surface those features as informational notes — the converter expands them to plain values,
 * and the user should know that. Stats (objects/arrays/depth/…) reuse `analyzeJson` from
 * jsonInsights, because YAML parses to the same JavaScript shape as JSON — no duplication here.
 *
 * Pure and deterministic; nothing touches the network, DOM, or storage.
 */

export type YamlNoteSeverity = "info" | "warning";

export interface YamlNote {
  severity: YamlNoteSeverity;
  title: string;
  detail: string;
}

export interface YamlScan {
  documentCount: number;
  multiDocument: boolean;
  anchors: string[];
  aliases: string[];
  mergeKeys: number;
  tags: string[];
  notes: YamlNote[];
}

/** Best-effort removal of comments and quoted-string contents so detectors don't false-positive. */
function stripNoise(line: string): string {
  // Drop quoted segments first (so a "#" or "&" inside a string is ignored).
  let s = line.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:[^']|'')*'/g, "''");
  // Drop an inline comment: a "#" that starts a token (preceded by start or whitespace).
  s = s.replace(/(^|\s)#.*$/, "$1");
  return s;
}

const uniq = (arr: string[]): string[] => Array.from(new Set(arr));

/**
 * Scan raw YAML text for features that conversion silently resolves. `documentCount` is
 * authoritative (pass the count from `parseYamlAll`); everything else is derived from the text.
 */
export function scanYaml(input: string, documentCount = 1): YamlScan {
  const anchors: string[] = [];
  const aliases: string[] = [];
  const tags: string[] = [];
  let mergeKeys = 0;

  for (const rawLine of input.split("\n")) {
    const line = stripNoise(rawLine);
    if (line.trim() === "") continue;

    for (const m of line.matchAll(/(?:^|[\s[{,])&([A-Za-z0-9_][\w-]*)/g)) anchors.push(m[1]);
    for (const m of line.matchAll(/(?:^|[\s[{,])\*([A-Za-z0-9_][\w-]*)/g)) aliases.push(m[1]);
    for (const m of line.matchAll(/(?:^|\s)(!!?[A-Za-z][\w:.\-/]*)/g)) tags.push(m[1]);
    if (/(^|\s)<<\s*:/.test(line)) mergeKeys++;
  }

  const uniqueAnchors = uniq(anchors);
  const uniqueAliases = uniq(aliases);
  const uniqueTags = uniq(tags);
  const multiDocument = documentCount > 1;

  const notes: YamlNote[] = [];
  if (multiDocument)
    notes.push({
      severity: "info",
      title: `Multi-document stream (${documentCount} documents)`,
      detail:
        "JSON has no multi-document concept, so the documents are converted to a JSON array — one element per YAML document, in order.",
    });
  if (uniqueAnchors.length || uniqueAliases.length)
    notes.push({
      severity: "info",
      title: `Anchors & aliases (${uniqueAnchors.length} anchor${uniqueAnchors.length === 1 ? "" : "s"}, ${uniqueAliases.length} alias${uniqueAliases.length === 1 ? "" : "es"})`,
      detail:
        "Aliases are expanded to a copy of their anchored value during conversion — JSON cannot represent references, so the output is fully self-contained (repeated values are duplicated).",
    });
  if (mergeKeys)
    notes.push({
      severity: "info",
      title: `Merge keys (${mergeKeys})`,
      detail:
        "The `<<:` merge keys are resolved: the referenced maps are merged into the containing object, then the merge key itself is dropped (JSON has no merge key).",
    });
  const customTags = uniqueTags.filter(
    (t) => t !== "!!str" && t !== "!!int" && t !== "!!float" && t !== "!!bool" && t !== "!!null"
  );
  if (customTags.length)
    notes.push({
      severity: "warning",
      title: `Custom/explicit tags (${customTags.join(", ")})`,
      detail:
        "Custom or non-standard YAML tags cannot be represented in JSON. Standard scalar tags are applied to the value; other tags are dropped, keeping the resolved value only.",
    });

  return {
    documentCount,
    multiDocument,
    anchors: uniqueAnchors,
    aliases: uniqueAliases,
    mergeKeys,
    tags: uniqueTags,
    notes,
  };
}
