import { describe, expect, it } from "vitest";
import { HttpMetadataFetcher, MetadataError } from "~/metadata";

const RUN = process.env.INTEGRATION === "1";
const describeIf = RUN ? describe : describe.skip;

describeIf("HttpMetadataFetcher integration", () => {
  const fetcher = new HttpMetadataFetcher();

  it(
    "fetches metadata for a known video (Me at the zoo)",
    async () => {
      const metadata = await fetcher.fetch(
        "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      );

      expect(metadata.title).toBeTruthy();
      expect(metadata.authorName).toBeTruthy();
      // "Me at the zoo" is the first YouTube video ever uploaded
      expect(metadata.title).toContain("zoo");
    },
    { timeout: 15000 },
  );

  it(
    "returns error for an invalid/non-existent video URL",
    async () => {
      await expect(
        fetcher.fetch(
          "https://www.youtube.com/watch?v=ZZZZZZZZZZZ_invalid_99999",
        ),
      ).rejects.toThrow(MetadataError);
    },
    { timeout: 15000 },
  );
});
