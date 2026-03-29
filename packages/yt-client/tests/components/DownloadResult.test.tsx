import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DownloadResult } from "@/components/download/DownloadResult";
import type { DownloadComplete } from "@/types/api";

const mockResult: DownloadComplete = {
  output_path: "/home/user/Downloads/test.mp3",
  title: "Test Video",
  author_name: "Test Author",
  format_id: "mp3",
  format_label: "MP3 audio",
};

describe("DownloadResult", () => {
  it("renders the Download Complete heading", () => {
    render(<DownloadResult result={mockResult} onReset={vi.fn()} />);

    expect(screen.getByText("Download Complete")).toBeInTheDocument();
  });

  it("renders the title, author, format, and output path", () => {
    render(<DownloadResult result={mockResult} onReset={vi.fn()} />);

    expect(screen.getByText("Test Video")).toBeInTheDocument();
    expect(screen.getByText("Test Author")).toBeInTheDocument();
    expect(screen.getByText("MP3 audio")).toBeInTheDocument();
    expect(
      screen.getByText("/home/user/Downloads/test.mp3"),
    ).toBeInTheDocument();
  });

  it("renders a Download Another button", () => {
    render(<DownloadResult result={mockResult} onReset={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Download Another" }),
    ).toBeInTheDocument();
  });

  it("calls onReset when Download Another button is clicked", async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<DownloadResult result={mockResult} onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: "Download Another" }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
