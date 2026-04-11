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

const req = {
  link: "https://youtube.com/watch?v=abc",
  format: "mp3",
  name: "test",
};

describe("streamDownload", () => {
  it("dispatches progress and complete events", async () => {
    const stream = createMockStream([
      'event: progress\ndata: {"percent":50,"speed":"2.00MiB/s","eta":"00:03"}\n\n',
      'event: complete\ndata: {"output_path":"/tmp/test.mp3","title":"Test","author_name":"Author","format_id":"mp3","format_label":"MP3 audio"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await streamDownload(req, { onProgress, onComplete, onError });

    expect(onProgress).toHaveBeenCalledWith({
      percent: 50,
      speed: "2.00MiB/s",
      eta: "00:03",
    });
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ output_path: "/tmp/test.mp3", title: "Test" }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("dispatches error event", async () => {
    const stream = createMockStream([
      'event: error\ndata: {"code":"VALIDATION","message":"bad link"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await streamDownload(req, { onProgress, onComplete, onError });

    expect(onError).toHaveBeenCalledWith({
      code: "VALIDATION",
      message: "bad link",
    });
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onError for failed HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, body: null });

    const onError = vi.fn();
    await streamDownload(req, {
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "HTTP_ERROR" }),
    );
  });

  it("calls onError with PARSE_ERROR for malformed JSON", async () => {
    const stream = createMockStream([
      "event: progress\ndata: {invalid json\n\n",
      'event: complete\ndata: {"output_path":"/tmp/test.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onError = vi.fn();
    const onProgress = vi.fn();
    await streamDownload(req, {
      onProgress,
      onComplete: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PARSE_ERROR" }),
    );
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("handles multiple progress events in a single chunk", async () => {
    const stream = createMockStream([
      'event: progress\ndata: {"percent":25,"speed":"1.00MiB/s","eta":"00:06"}\n\nevent: progress\ndata: {"percent":75,"speed":"3.00MiB/s","eta":"00:01"}\n\n',
      'event: complete\ndata: {"output_path":"/tmp/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    await streamDownload(req, {
      onProgress,
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls[0][0].percent).toBe(25);
    expect(onProgress.mock.calls[1][0].percent).toBe(75);
  });

  it("calls onError with CONNECTION_LOST when stream ends without terminal event", async () => {
    const stream = createMockStream([
      'event: progress\ndata: {"percent":50,"speed":"2.00MiB/s","eta":"00:03"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onError = vi.fn();

    await streamDownload(req, { onProgress, onComplete: vi.fn(), onError });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CONNECTION_LOST", retryable: true }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
