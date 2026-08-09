/**
 * Generate mobile API types from the Vyora OpenAPI contract.
 *
 * The mobile client must not carry a hand-maintained copy of the wire shapes.
 * A hand-written copy drifts silently: the server adds a required field, the
 * app keeps compiling, and the mismatch surfaces as a rejected write on a
 * merchant's phone rather than as a red build.
 *
 * So the types are emitted from `vyora-api/openapi/openapi.yaml`, and a test
 * re-runs this generator and compares the result to the committed file. Drift
 * therefore fails the mobile test suite, in the repository, before it can reach
 * a device.
 *
 * This is a focused emitter, not a general OpenAPI code generator. It handles
 * exactly the JSON Schema subset this contract uses — objects, enums, arrays,
 * `$ref`, `allOf`, nullable unions and the primitive formats. Anything it does
 * not understand is an explicit error rather than a silent `unknown`, because a
 * quietly widened type is how a contract stops being enforced.
 *
 * Usage: node scripts/generate-api-types.mjs [--check]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACT_PATH = resolve(here, "..", "..", "vyora-api", "openapi", "openapi.yaml");
export const OUTPUT_PATH = resolve(here, "..", "src", "api", "contract.generated.ts");

/**
 * Schemas the mobile app actually speaks.
 *
 * An allow-list rather than "emit everything": the sync envelopes and event
 * payloads are in the same document, and emitting them would put types for an
 * inert protocol in front of a developer as though they were available.
 * Referenced schemas are pulled in transitively, so this list names intent and
 * the closure takes care of itself.
 */
const ROOTS = [
  "Party",
  "PartyPage",
  "PartyBalance",
  "PartyPosition",
  "CreatePartyRequest",
  "UpdatePartyRequest",
  "RecordCreditRequest",
  "RecordPaymentRequest",
  "LedgerEntry",
  "StatementRow",
  "PartyStatement",
  "PartyLedgerSummary",
  "LedgerTotals",
  "LedgerCounts",
  "EntryKind",
  "PaymentKind",
  "ErrorEnvelope",
  "ErrorObject",
  "ErrorCode",
  "FieldError",
  "Me",
];

/** Operations the mobile client is allowed to call. */
const OPERATIONS = [
  "listParties",
  "createParty",
  "getParty",
  "recordCredit",
  "recordPayment",
  "getPartyStatement",
  "getPartyLedgerSummary",
];

function refName(ref) {
  const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
  if (!match) throw new Error(`Unsupported $ref: ${ref}`);
  return match[1];
}

/** Collect the transitive closure of schema names reachable from the roots. */
function closure(schemas, roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    if (!schemas[name]) throw new Error(`Contract has no schema named ${name}`);
    seen.add(name);
    walkRefs(schemas[name], (target) => queue.push(target));
  }
  return [...seen].sort();
}

function walkRefs(node, visit) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkRefs(item, visit);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") visit(refName(value));
    else walkRefs(value, visit);
  }
}

const PRIMITIVES = {
  string: "string",
  integer: "number",
  number: "number",
  boolean: "boolean",
};

/** JSON Schema (the subset this contract uses) → a TypeScript type expression. */
function toType(schema, indent) {
  if (schema.$ref) return refName(schema.$ref);

  // `allOf` here is only ever "a $ref plus prose", or the StatementRow
  // extension pattern. Both flatten to an intersection.
  if (schema.allOf) {
    const parts = schema.allOf.map((part) => toType(part, indent));
    return parts.length === 1 ? parts[0] : parts.join(" & ");
  }

  if (schema.enum) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  const type = schema.type;

  // OpenAPI 3.1 nullable: `type: [string, "null"]`.
  if (Array.isArray(type)) {
    const parts = type.map((t) => (t === "null" ? "null" : toType({ ...schema, type: t }, indent)));
    return [...new Set(parts)].join(" | ");
  }

  if (type === "array") {
    if (!schema.items) throw new Error("Array schema without items");
    const inner = toType(schema.items, indent);
    return /[|&) ]/.test(inner) ? `Array<${inner}>` : `${inner}[]`;
  }

  if (type === "object" || schema.properties) {
    return objectBody(schema, indent);
  }

  const primitive = PRIMITIVES[type];
  if (!primitive) throw new Error(`Unsupported schema type: ${JSON.stringify(type)}`);
  return primitive;
}

function objectBody(schema, indent) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const pad = "  ".repeat(indent + 1);

  const lines = Object.entries(properties).map(([name, property]) => {
    const optional = required.has(name) ? "" : "?";
    const doc = describe(property, pad);
    return `${doc}${pad}${safeKey(name)}${optional}: ${toType(property, indent + 1)};`;
  });

  if (schema.additionalProperties === true) {
    lines.push(`${pad}[key: string]: unknown;`);
  }
  if (lines.length === 0) return "Record<string, never>";
  return `{\n${lines.join("\n")}\n${"  ".repeat(indent)}}`;
}

function safeKey(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** First sentence of a description, as a one-line comment. Keeps the file readable. */
function describe(schema, pad) {
  const text = typeof schema.description === "string" ? schema.description.trim() : "";
  if (!text) return "";
  const firstLine = text.split("\n")[0].trim().replace(/\*\//g, "*\\/");
  if (!firstLine) return "";
  return `${pad}/** ${firstLine} */\n`;
}

function blockComment(schema) {
  const text = typeof schema.description === "string" ? schema.description.trim() : "";
  if (!text) return "";
  const body = text
    .split("\n")
    .map((line) => ` * ${line}`.trimEnd().replace(/\*\//g, "*\\/"))
    .join("\n");
  return `/**\n${body}\n */\n`;
}

export function generate() {
  const document = parseYaml(readFileSync(CONTRACT_PATH, "utf8"));
  const schemas = document.components.schemas;
  const names = closure(schemas, ROOTS);

  const out = [];
  out.push("/**");
  out.push(" * GENERATED FILE — DO NOT EDIT BY HAND.");
  out.push(" *");
  out.push(" * Emitted from vyora-api/openapi/openapi.yaml by");
  out.push(" * scripts/generate-api-types.mjs. Run `npm run api:types` after any");
  out.push(" * contract change; `npm run api:types:check` fails if this file is stale,");
  out.push(" * and the mobile test suite runs that check.");
  out.push(" *");
  out.push(" * Editing this by hand reintroduces exactly the drift it exists to prevent.");
  out.push(" */");
  out.push("");
  out.push("/* eslint-disable */");
  out.push("");

  const info = document.info ?? {};
  out.push(`export const CONTRACT_VERSION = ${JSON.stringify(String(info.version ?? "unknown"))};`);
  out.push("");

  // Paths, so a caller cannot mistype a URL that the contract defines.
  const paths = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      const operation = item[method];
      if (operation && OPERATIONS.includes(operation.operationId)) {
        paths.push({ id: operation.operationId, method: method.toUpperCase(), path });
      }
    }
  }
  paths.sort((a, b) => (a.id < b.id ? -1 : 1));

  out.push("/** Operations this client is allowed to call, exactly as the contract declares them. */");
  out.push("export const OPERATIONS = {");
  for (const op of paths) {
    out.push(`  ${op.id}: { method: ${JSON.stringify(op.method)}, path: ${JSON.stringify(op.path)} },`);
  }
  out.push("} as const;");
  out.push("");
  out.push("export type OperationId = keyof typeof OPERATIONS;");
  out.push("");

  for (const name of names) {
    const schema = schemas[name];
    const doc = blockComment(schema);
    const body = toType(schema, 0);
    const keyword = body.startsWith("{") ? "interface" : "type";
    out.push(doc + (keyword === "interface" ? `export interface ${name} ${body}` : `export type ${name} = ${body};`));
    out.push("");
  }

  return out.join("\n");
}

export function main({ check = false } = {}) {
  const generated = generate();
  if (check) {
    let current = "";
    try {
      current = readFileSync(OUTPUT_PATH, "utf8");
    } catch {
      console.error(`Missing ${OUTPUT_PATH}. Run: npm run api:types`);
      process.exit(1);
    }
    if (normalise(current) !== normalise(generated)) {
      console.error(
        "src/api/contract.generated.ts is out of date with the OpenAPI contract.\n" +
          "Run: npm run api:types"
      );
      process.exit(1);
    }
    console.log("contract.generated.ts matches the contract.");
    return;
  }
  writeFileSync(OUTPUT_PATH, generated, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

/** Compare ignoring line endings — Windows checkouts rewrite them. */
export function normalise(text) {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

// `pathToFileURL`, not `"file://" + argv[1]`. The naive form silently never
// matches on Windows, which once made two migration scripts exit 0 having done
// nothing at all (VYORA-PLATFORM-006.2).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main({ check: process.argv.includes("--check") });
}
