/**
 * Errores tipados del REST API.
 *
 * Cada error sale con la forma:
 *   { error: { code, message, details? }, requestId }
 */

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "conflict"
  | "method_not_allowed"
  | "unprocessable_entity"
  | "service_unavailable"
  | "internal_error"
  | "idempotency_conflict";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 400,
  rate_limited: 429,
  conflict: 409,
  method_not_allowed: 405,
  unprocessable_entity: 422,
  service_unavailable: 503,
  internal_error: 500,
  idempotency_conflict: 422,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (details !== undefined) this.details = details;
  }
}

export function unauthorized(message = "Falta autenticación") {
  return new ApiError("unauthorized", message);
}
export function forbidden(message = "Permiso denegado") {
  return new ApiError("forbidden", message);
}
export function notFound(message = "Recurso no encontrado") {
  return new ApiError("not_found", message);
}
export function validation(message: string, details?: unknown) {
  return new ApiError("validation_error", message, details);
}
export function rateLimited(retryAfterMs: number) {
  return new ApiError(
    "rate_limited",
    `Has excedido el rate limit. Reintenta en ${Math.ceil(retryAfterMs / 1000)}s.`,
  );
}
export function conflict(message: string) {
  return new ApiError("conflict", message);
}
export function unprocessable(message: string, details?: unknown) {
  return new ApiError("unprocessable_entity", message, details);
}
