/**
 * The one error shape this API emits.
 *
 * `api-error-model.md`: every non-2xx on every operation returns
 * `{ error: { code, message, requestId, details? } }`. No bare strings, no
 * framework HTML, no stack traces. `message` is developer-facing and is never
 * rendered to a merchant — the client owns that wording.
 */

import type { FastifyReply } from "fastify";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "VERSION_CONFLICT"
  | "PRECONDITION_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "RESOURCE_ALREADY_EXISTS"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "SYNC_CURSOR_INVALID"
  | "SYNC_CURSOR_EXPIRED"
  | "SYNC_CLIENT_TOO_OLD"
  | "SYNC_SCHEMA_VERSION_UNSUPPORTED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type FieldErrorCode =
  "REQUIRED" | "INVALID_FORMAT" | "OUT_OF_RANGE" | "TOO_LONG" | "NOT_ALLOWED";

export interface FieldError {
  field: string;
  code: FieldErrorCode;
  message: string;
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: FieldError[];
  };
}

/** An error that already knows its HTTP status and contract code. */
export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[]
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: FieldError[]) => new ApiError(400, "BAD_REQUEST", m, d);
export const unauthenticated = (m: string) => new ApiError(401, "UNAUTHENTICATED", m);
export const tokenExpired = (m: string) => new ApiError(401, "TOKEN_EXPIRED", m);
export const notFound = (m: string) => new ApiError(404, "NOT_FOUND", m);
export const validationFailed = (m: string, d?: FieldError[]) =>
  new ApiError(422, "VALIDATION_FAILED", m, d);
export const versionConflict = (m: string) => new ApiError(412, "VERSION_CONFLICT", m);
export const preconditionRequired = (m: string) => new ApiError(428, "PRECONDITION_REQUIRED", m);
export const idempotencyKeyReused = (m: string) => new ApiError(409, "IDEMPOTENCY_KEY_REUSED", m);
export const resourceAlreadyExists = (m: string) => new ApiError(409, "RESOURCE_ALREADY_EXISTS", m);
export const payloadTooLarge = (m: string) => new ApiError(413, "PAYLOAD_TOO_LARGE", m);
export const cursorInvalid = (m: string) => new ApiError(400, "SYNC_CURSOR_INVALID", m);
export const cursorExpired = (m: string) => new ApiError(409, "SYNC_CURSOR_EXPIRED", m);
export const schemaVersionUnsupported = (m: string) =>
  new ApiError(409, "SYNC_SCHEMA_VERSION_UNSUPPORTED", m);
export const dependencyUnavailable = (m: string) => new ApiError(503, "DEPENDENCY_UNAVAILABLE", m);

export function envelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: FieldError[]
): ErrorEnvelope {
  const error: ErrorEnvelope["error"] = { code, message, requestId };
  if (details && details.length > 0) error.details = details;
  return { error };
}

/**
 * The single exit for every failure.
 *
 * `X-Request-Id` is set here rather than per route so no error path can
 * accidentally omit it — a merchant reporting "it failed" has to have one id to
 * read off the screen, and it must correlate client log, server log and ticket.
 */
export function sendError(reply: FastifyReply, requestId: string, err: unknown): FastifyReply {
  const api =
    err instanceof ApiError
      ? err
      : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred.");

  reply.header("x-request-id", requestId);
  return reply.status(api.status).send(envelope(api.code, api.message, requestId, api.details));
}
