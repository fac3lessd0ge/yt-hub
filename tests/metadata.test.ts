import { describe, it, expect, beforeAll, afterEach, afterAll } from "bun:test";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { HttpMetadataFetcher, MetadataError } from "~/metadata";

const OEMBED_URL = "https://www.youtube.com/oembed";

const handlers = [
  http.get(OEMBED_URL, ({ request }) => {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get("url");
    if (videoUrl?.includes("not-found")) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ title: "Test Video Title", author_name: "Test Author", type: "video", version: "1.0" });
  }),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("HttpMetadataFetcher", () => {
  const fetcher = new HttpMetadataFetcher();

  it("returns metadata for a valid video URL", async () => {
    const metadata = await fetcher.fetch("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(metadata.title).toBe("Test Video Title");
    expect(metadata.authorName).toBe("Test Author");
  });

  it("throws MetadataError on 404", async () => {
    expect(fetcher.fetch("https://www.youtube.com/watch?v=not-found")).rejects.toThrow(MetadataError);
    expect(fetcher.fetch("https://www.youtube.com/watch?v=not-found")).rejects.toThrow("Video not found");
  });

  it("throws MetadataError on network error", async () => {
    server.use(http.get(OEMBED_URL, () => HttpResponse.error()));
    expect(fetcher.fetch("https://www.youtube.com/watch?v=abc")).rejects.toThrow(MetadataError);
  });

  it("throws MetadataError on server error (500)", async () => {
    server.use(http.get(OEMBED_URL, () => new HttpResponse(null, { status: 500 })));
    expect(fetcher.fetch("https://www.youtube.com/watch?v=abc")).rejects.toThrow("Failed to fetch video metadata");
  });
});
