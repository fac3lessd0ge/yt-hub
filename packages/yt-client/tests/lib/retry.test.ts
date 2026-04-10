import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, RateLimitError, withRetry } from "@/lib/retry";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withRetry", () => {
  it("returns value on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 502"))
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(1000); // 1st retry
    await vi.advanceTimersByTimeAsync(2000); // 2nd retry
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx error", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(404, "Not found"));
    await expect(withRetry(fn)).rejects.toThrow("Not found");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 500"));

    const promise = withRetry(fn).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(10000);
    const err = await promise;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("HTTP 500");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses RateLimitError delay instead of exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError(3000))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn);
    // Should wait 3s (RateLimitError delay), not 1s (exponential)
    await vi.advanceTimersByTimeAsync(2999);
    expect(fn).toHaveBeenCalledTimes(1); // still waiting
    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on RateLimitError even though it looks like 4xx", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError(1000))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
