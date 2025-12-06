import { NextResponse } from "next/server";

/**
 * Create a standardized success response payload.
 * @template T
 * @param {T} [data={}] - Data payload to return to the client.
 * @param {ResponseInit} [init={}] - Optional NextResponse init options.
 * @returns {NextResponse} JSON response with success flag.
 */
export function success(data = {}, init = {}) {
  return NextResponse.json({ success: true, data, error: null }, init);
}

/**
 * Create a standardized failure response payload.
 * @param {string} [error="Request failed"] - Human-readable error message.
 * @param {number} [status=400] - HTTP status code to return.
 * @param {Record<string, unknown>} [extras={}] - Additional metadata to include.
 * @returns {NextResponse} JSON response with failure flag.
 */
export function failure(error = "Request failed", status = 400, extras = {}) {
  const safeStatus = Number.isInteger(status) ? status : 400;
  const safeExtras = extras && typeof extras === "object" ? extras : {};
  return NextResponse.json({ success: false, data: null, error, ...safeExtras }, { status: safeStatus });
}

/**
 * Normalize unexpected errors into a consistent API failure response.
 * @param {unknown} error - Error thrown during request handling.
 * @returns {NextResponse} JSON error response with inferred status code.
 */
export function handleApiError(error) {
  const status =
    (error && typeof error === "object" && "status" in error && Number.isInteger(error.status) && error.status) ||
    (error?.code === "FORBIDDEN"
      ? 403
      : error?.code === "UNAUTHORIZED"
        ? 401
        : 400);
  const message = (error && typeof error === "object" && "message" in error && error.message) || "Unexpected error";
  return failure(message, status);
}