import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DownloadProgress } from "@/components/download/DownloadProgress";

describe("DownloadProgress", () => {
  it("renders the Downloading label", () => {
    render(<DownloadProgress progress={null} onCancel={vi.fn()} />);

    expect(screen.getByText("Downloading...")).toBeInTheDocument();
  });

  it("renders 0.0% when progress is null", () => {
    render(<DownloadProgress progress={null} onCancel={vi.fn()} />);

    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("renders the percent, speed, and eta from progress data", () => {
    const progress = { percent: 42.5, speed: "2.50MiB/s", eta: "00:15" };
    render(<DownloadProgress progress={progress} onCancel={vi.fn()} />);

    expect(screen.getByText("42.5%")).toBeInTheDocument();
    expect(screen.getByText("Speed: 2.50MiB/s")).toBeInTheDocument();
    expect(screen.getByText("ETA: 00:15")).toBeInTheDocument();
  });

  it("renders a Cancel button", () => {
    render(<DownloadProgress progress={null} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<DownloadProgress progress={null} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
