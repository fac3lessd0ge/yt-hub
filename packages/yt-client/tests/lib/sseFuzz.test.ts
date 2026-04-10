import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamDownload } from "@/lib/sse";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function createMockStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

const req = { link: "https://youtube.com/watch?v=abc", format: "mp3", name: "test" };
const completeEvent =
  'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n';

describe("SSE parser fuzz", () => {
  it("handles empty chunks without crashing", async () => {
    const stream = createMockStream(["", "\n", "\n\n", completeEvent]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError: vi.fn() });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles missing event type gracefully", async () => {
    const stream = createMockStream(['data: {"percent":50}\n\n', completeEvent]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress, onComplete, onError: vi.fn() });
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles missing data field gracefully", async () => {
    const stream = createMockStream(["event: progress\n\n", completeEvent]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress, onComplete, onError: vi.fn() });
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles binary-like data in event stream", async () => {
    const stream = createMockStream(["event: progress\ndata: \x00\x01\x02\n\n", completeEvent]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onError = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles extremely long data lines", async () => {
    const longData = "a".repeat(100000);
    const stream = createMockStream([`event: progress\ndata: ${longData}\n\n`, completeEvent]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onError = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
