export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

const defaults: RetryOptions = { maxAttempts: 3, baseDelayMs: 1000 };

function isClientError(err: unknown): boolean {
  if (err instanceof RateLimitError) return false;
  if (err instanceof HttpError) return err.status >= 400 && err.status < 500;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const { maxAttempts, baseDelayMs } = { ...defaults, ...options };

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isClientError(err)) throw err;
      if (attempt + 1 >= maxAttempts) throw err;

      const delay =
        err instanceof RateLimitError
          ? err.retryAfterMs
          : baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
