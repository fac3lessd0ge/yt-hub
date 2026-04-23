import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DownloadPage } from "@/components/download/DownloadPage";

const mockUseDownload = vi.fn();

vi.mock("@/hooks/useDownload", () => ({
  useDownload: () => mockUseDownload(),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      theme: "system",
      defaultDownloadDir: null,
      defaultFormat: "mp4",
    },
    updateSetting: vi.fn(),
  }),
}));

vi.mock("@/hooks/useQueue", () => ({
  useQueue: () => ({
    items: [],
    addItem: vi.fn(),
    cancelItem: vi.fn(),
    removeItem: vi.fn(),
    retryItem: vi.fn(),
  }),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

// Mock child components to avoid needing their dependencies
vi.mock("@/components/download/DownloadForm", () => ({
  DownloadForm: ({ onSubmit }: { onSubmit: () => void }) => (
    <div data-testid="download-form">
      <button type="button" onClick={onSubmit}>
        MockForm Submit
      </button>
    </div>
  ),
}));

vi.mock("@/components/download/DownloadProgress", () => ({
  DownloadProgress: () => <div data-testid="download-progress" />,
}));

vi.mock("@/components/download/DownloadResult", () => ({
  DownloadResult: () => <div data-testid="download-result" />,
}));

function makeHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    state: "idle",
    progress: null,
    result: null,
    localPath: null,
    error: null,
    start: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

describe("DownloadPage", () => {
  it("renders the Download heading", () => {
    mockUseDownload.mockReturnValue(makeHookReturn());
    render(<DownloadPage />);

    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("shows DownloadForm when state is idle", () => {
    mockUseDownload.mockReturnValue(makeHookReturn({ state: "idle" }));
    render(<DownloadPage />);

    expect(screen.getByTestId("download-form")).toBeInTheDocument();
    expect(screen.queryByTestId("download-progress")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-result")).not.toBeInTheDocument();
  });

  it("shows DownloadProgress when state is downloading", () => {
    mockUseDownload.mockReturnValue(
      makeHookReturn({
        state: "downloading",
        progress: { percent: 50, speed: "1MiB/s", eta: "00:10" },
      }),
    );
    render(<DownloadPage />);

    expect(screen.getByTestId("download-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("download-form")).not.toBeInTheDocument();
  });

  it("shows DownloadResult when state is complete", () => {
    mockUseDownload.mockReturnValue(
      makeHookReturn({
        state: "complete",
        result: {
          output_path: "/tmp/test.mp3",
          title: "Video",
          author_name: "Author",
          format_id: "mp3",
          format_label: "MP3",
        },
      }),
    );
    render(<DownloadPage />);

    expect(screen.getByTestId("download-result")).toBeInTheDocument();
    expect(screen.queryByTestId("download-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-progress")).not.toBeInTheDocument();
  });

  it("shows error block when state is error", () => {
    mockUseDownload.mockReturnValue(
      makeHookReturn({
        state: "error",
        error: { code: "NETWORK_ERROR", message: "Connection failed" },
      }),
    );
    render(<DownloadPage />);

    expect(screen.getByText("Download Failed")).toBeInTheDocument();
    expect(
      screen.getByText("Could not reach the server — check your connection"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("does not show error block when state is idle", () => {
    mockUseDownload.mockReturnValue(makeHookReturn({ state: "idle" }));
    render(<DownloadPage />);

    expect(screen.queryByText("Download Failed")).not.toBeInTheDocument();
  });

  it("error block has role=alert", () => {
    mockUseDownload.mockReturnValue(
      makeHookReturn({
        state: "error",
        error: { code: "NETWORK_ERROR", message: "Connection failed" },
      }),
    );
    render(<DownloadPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("saving state has aria-busy", () => {
    mockUseDownload.mockReturnValue(makeHookReturn({ state: "saving" }));
    render(<DownloadPage />);
    expect(screen.getByText("Saving file...")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("starts the download when re-download is requested in single-mode", () => {
    const start = vi.fn();
    const req = { link: "https://youtu.be/abc", format: "mp3", name: "Clip" };
    const consumeRedownload = vi.fn().mockReturnValueOnce(req);
    mockUseDownload.mockReturnValue(makeHookReturn({ state: "idle", start }));

    render(<DownloadPage consumeRedownload={consumeRedownload} />);

    expect(consumeRedownload).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(req);
  });

  it("does not start when consumeRedownload returns null", () => {
    const start = vi.fn();
    const consumeRedownload = vi.fn().mockReturnValue(null);
    mockUseDownload.mockReturnValue(makeHookReturn({ state: "idle", start }));

    render(<DownloadPage consumeRedownload={consumeRedownload} />);

    expect(consumeRedownload).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("does not start when already downloading and preserves the redownload request", () => {
    const start = vi.fn();
    const req = { link: "https://youtu.be/abc", format: "mp3", name: "Clip" };
    const consumeRedownload = vi.fn().mockReturnValue(req);
    mockUseDownload.mockReturnValue(
      makeHookReturn({ state: "downloading", start }),
    );

    render(<DownloadPage consumeRedownload={consumeRedownload} />);

    expect(start).not.toHaveBeenCalled();
    // The request must NOT be drained mid-download — it should still be available
    // when state returns to "idle" so the redownload eventually fires.
    expect(consumeRedownload).not.toHaveBeenCalled();
  });
});
