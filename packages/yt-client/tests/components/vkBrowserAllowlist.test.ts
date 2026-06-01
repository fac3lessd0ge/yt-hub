import { describe, expect, it } from "vitest";
import { isSupportedCookieBrowser } from "yt-downloader";
import { BROWSERS } from "@/components/settings/VkAccessSection";

// Drift guard: the renderer declares its browser list locally to stay
// Node-free, but every option it offers MUST be accepted by the engine's
// allowlist — otherwise the UI would offer a browser the main process rejects.
describe("VK browser dropdown ↔ engine allowlist", () => {
  it("every offered browser id passes isSupportedCookieBrowser", () => {
    for (const { id } of BROWSERS) {
      expect(isSupportedCookieBrowser(id)).toBe(true);
    }
  });

  it("offers at least Firefox (the most reliable option)", () => {
    expect(BROWSERS.some((b) => b.id === "firefox")).toBe(true);
  });
});
