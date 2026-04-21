const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: { socket?: { remoteAddress?: string } }): string {
  const ip = req.socket?.remoteAddress?.trim();
  return ip && ip.length > 0 ? ip : "unknown";
}

/** Returns true if request is allowed, false if rate limited. */
export function allowInternalFileRequest(req: {
  socket?: { remoteAddress?: string };
}): boolean {
  const key = clientKey(req);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  b.count += 1;
  return true;
}
