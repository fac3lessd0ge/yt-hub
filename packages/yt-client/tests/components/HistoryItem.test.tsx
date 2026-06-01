import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryItem } from "@/components/history/HistoryItem";

const baseProps = {
  title: "Test Song",
  author: "Test Channel",
  format: "mp3",
  formatType: "audio" as const,
  link: "https://www.youtube.com/watch?v=DCC6w9pAn3k",
  localPath: "/tmp/Test Song.mp3",
  downloadedAt: 1717200000000,
  fileExists: true,
  onShow: vi.fn(),
  onRedownload: vi.fn(),
  onRemove: vi.fn(),
};

describe("HistoryItem", () => {
  it("renders the YouTube thumbnail (lazy) for a valid link", () => {
    const { container } = render(<HistoryItem {...baseProps} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("DCC6w9pAn3k");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("falls back to the format icon when the link has no video id", () => {
    const { container } = render(
      <HistoryItem {...baseProps} link="not-a-youtube-url" />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
