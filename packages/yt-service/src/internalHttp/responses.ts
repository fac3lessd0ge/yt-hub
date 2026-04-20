import type { ServerResponse } from "node:http";

export type ApiStatus = "ok" | "degraded" | "error";

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  if (res.headersSent) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function envelopeOk(data: Record<string, unknown>): Record<string, unknown> {
  return { status: "ok" as ApiStatus, data };
}

export function envelopeDegraded(data: Record<string, unknown>): Record<string, unknown> {
  return { status: "degraded" as ApiStatus, data };
}

export function envelopeError(code: string, message: string): Record<string, unknown> {
  return { status: "error" as ApiStatus, code, message };
}
