import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadForm } from "@/components/download/DownloadForm";

vi.mock("@/hooks/useFormats", () => ({
  useFormats: () => ({
    formats: [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useMetadata", () => ({
  useMetadata: () => ({
    metadata: null,
    loading: false,
    error: null,
  }),
}));

const mockUseSettings = vi.fn();
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => mockUseSettings(),
}));

describe("DownloadForm", () => {
  beforeEach(() => {
    mockUseSettings.mockReturnValue({
      settings: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
      },
      updateSetting: vi.fn(),
    });
  });

  it("renders the link input, format select, and name input", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("YouTube Link")).toBeInTheDocument();
    expect(screen.getByLabelText("Format")).toBeInTheDocument();
    expect(screen.getByLabelText("File Name")).toBeInTheDocument();
  });

  it("renders format options from useFormats hook", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("MP3 audio");
    expect(options[1]).toHaveTextContent("MP4 video");
  });

  it("renders a Download button", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
  });

  it("disables the submit button when fields are empty", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Download" });
    expect(button).toBeDisabled();
  });

  it("enables the submit button when all fields have values", async () => {
    const user = userEvent.setup();
    render(<DownloadForm onSubmit={vi.fn()} />);

    await user.type(
      screen.getByLabelText("YouTube Link"),
      "https://www.youtube.com/watch?v=abc",
    );
    await user.type(screen.getByLabelText("File Name"), "My Video");

    const button = screen.getByRole("button", { name: "Download" });
    expect(button).not.toBeDisabled();
  });

  it("link input has aria-required", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("YouTube Link")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("link input gets autofocus", () => {
    render(<DownloadForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("YouTube Link")).toHaveFocus();
  });

  it("calls onSubmit with link, format, and name when form is submitted", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DownloadForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("YouTube Link"),
      "https://www.youtube.com/watch?v=abc",
    );
    await user.type(screen.getByLabelText("File Name"), "My Video");
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(onSubmit).toHaveBeenCalledWith({
      link: "https://www.youtube.com/watch?v=abc",
      format: "mp4",
      name: "My Video",
    });
  });

  it("preselects the format from Settings when it exists in the formats list", () => {
    mockUseSettings.mockReturnValue({
      settings: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
      },
      updateSetting: vi.fn(),
    });
    render(<DownloadForm onSubmit={vi.fn()} />);

    const select = screen.getByLabelText("Format") as HTMLSelectElement;
    expect(select.value).toBe("mp4");
  });

  it("falls back to first format when defaultFormat is not in the server list", () => {
    mockUseSettings.mockReturnValue({
      settings: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "flac",
      },
      updateSetting: vi.fn(),
    });
    render(<DownloadForm onSubmit={vi.fn()} />);

    const select = screen.getByLabelText("Format") as HTMLSelectElement;
    expect(select.value).toBe("mp3");
  });

  it("does not overwrite an explicit user format choice when settings change mid-session", async () => {
    const user = userEvent.setup();
    mockUseSettings.mockReturnValue({
      settings: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
      },
      updateSetting: vi.fn(),
    });
    const { rerender } = render(<DownloadForm onSubmit={vi.fn()} />);

    const select = screen.getByLabelText("Format") as HTMLSelectElement;
    await user.selectOptions(select, "mp3");
    expect(select.value).toBe("mp3");

    mockUseSettings.mockReturnValue({
      settings: {
        theme: "system",
        defaultDownloadDir: null,
        defaultFormat: "mp4",
      },
      updateSetting: vi.fn(),
    });
    rerender(<DownloadForm onSubmit={vi.fn()} />);

    expect((screen.getByLabelText("Format") as HTMLSelectElement).value).toBe(
      "mp3",
    );
  });
});
