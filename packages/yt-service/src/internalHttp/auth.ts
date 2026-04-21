import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { HEADER_INTERNAL_API_KEY } from "./protocol";

export const AuthResult = {
  Authorized: "authorized",
  Missing: "missing",
  Invalid: "invalid",
} as const;

export type AuthResultType = (typeof AuthResult)[keyof typeof AuthResult];

export function authorize(
  req: IncomingMessage,
  internalApiKey: string,
): AuthResultType {
  const incomingHeader = req.headers[HEADER_INTERNAL_API_KEY];
  const incomingKey = Array.isArray(incomingHeader)
    ? incomingHeader[0]
    : incomingHeader;
  if (!incomingKey) {
    return AuthResult.Missing;
  }

  const expected = Buffer.from(internalApiKey);
  const received = Buffer.from(incomingKey);
  if (expected.length !== received.length) {
    return AuthResult.Invalid;
  }

  return timingSafeEqual(expected, received)
    ? AuthResult.Authorized
    : AuthResult.Invalid;
}
