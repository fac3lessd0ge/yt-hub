const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: "Invalid input — please check the URL and try again",
  NOT_FOUND: "Video not found — it may have been removed or made private",
  RATE_LIMIT_EXCEEDED: "Too many requests — please wait a moment and try again",
  GRPC_UNAVAILABLE: "Server is not responding — please try again later",
  TIMEOUT: "Request timed out — the server may be overloaded",
  CONNECTION_LOST: "Connection was lost during download — please retry",
  PARSE_ERROR: "Received unexpected data from server",
  HTTP_ERROR: "Server error — please try again later",
  NETWORK_ERROR: "Could not reach the server — check your connection",
  SAVE_FAILED: "Failed to save file to disk",
};

export function friendlyError(code: string, fallback: string): string {
  return errorMessages[code] ?? fallback;
}
