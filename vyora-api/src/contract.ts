/**
 * The OpenAPI contract, loaded at boot and used as the runtime validator.
 *
 * The contract is not a document the code is written *against* and then drifts
 * from — it is the code's validator. `openapi.yaml` is parsed at startup and
 * its `components.schemas` are handed straight to Ajv, so a request that the
 * contract forbids is rejected by the contract itself. There is no second copy
 * of the rules to fall out of step.
 *
 * OpenAPI 3.1 schemas *are* JSON Schema 2020-12, which is what makes this
 * possible without a translation layer.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import type { FieldError } from "./errors.js";

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACT_PATH = join(here, "..", "openapi", "openapi.yaml");

export interface OperationRef {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
}

export interface Contract {
  readonly document: Record<string, unknown>;
  readonly operations: readonly OperationRef[];
  /** Validate a value against `#/components/schemas/<name>`. */
  validate(schemaName: string, value: unknown): FieldError[] | null;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

/** Ajv keywords OpenAPI adds that carry no validation meaning. */
const OPENAPI_ONLY_KEYWORDS = ["discriminator", "xml", "externalDocs", "example"];

export function loadContract(path: string = CONTRACT_PATH): Contract {
  const document = parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;

  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    // The document is the schema root, so `#/components/schemas/X` resolves
    // exactly as written in the contract — no rewriting of $ref targets.
    schemas: { contract: document },
  });
  addFormats(ajv);
  for (const keyword of OPENAPI_ONLY_KEYWORDS) ajv.addKeyword(keyword);

  const cache = new Map<string, ValidateFunction>();
  function compiled(schemaName: string): ValidateFunction {
    const existing = cache.get(schemaName);
    if (existing) return existing;
    const fn = ajv.compile({ $ref: `contract#/components/schemas/${schemaName}` });
    cache.set(schemaName, fn);
    return fn;
  }

  const paths = (document.paths ?? {}) as Record<string, Record<string, { operationId?: string }>>;
  const operations: OperationRef[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op) {
        operations.push({
          method: method.toUpperCase(),
          path,
          operationId: op.operationId ?? `${method}:${path}`,
        });
      }
    }
  }

  return {
    document,
    operations,
    validate(schemaName, value) {
      const fn = compiled(schemaName);
      if (fn(value)) return null;
      return (fn.errors ?? []).map(toFieldError);
    },
  };
}

/**
 * Ajv error → contract `FieldError`.
 *
 * `field` is a JSONPath into the request, so a rejected event in a batch of 500
 * points at the offending one instead of making a client bisect its outbox.
 */
function toFieldError(err: {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}): FieldError {
  const missing = err.params?.["missingProperty"] as string | undefined;
  const pointer = err.instancePath === "" ? "$" : `$${err.instancePath.replace(/\//g, ".")}`;
  const field = missing ? `${pointer}.${missing}` : pointer;

  let code: FieldError["code"] = "INVALID_FORMAT";
  switch (err.keyword) {
    case "required":
      code = "REQUIRED";
      break;
    case "maximum":
    case "minimum":
    case "exclusiveMaximum":
    case "exclusiveMinimum":
    case "minItems":
    case "maxItems":
      code = "OUT_OF_RANGE";
      break;
    case "maxLength":
      code = "TOO_LONG";
      break;
    case "additionalProperties":
      code = "NOT_ALLOWED";
      break;
    default:
      code = "INVALID_FORMAT";
  }

  return { field, code, message: err.message ?? "invalid value" };
}
