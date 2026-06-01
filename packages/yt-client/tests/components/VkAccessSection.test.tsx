import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VkAccessSection } from "@/components/settings/VkAccessSection";
import type { VkAccess } from "@/types/electron";

const off: VkAccess = { mode: "off", browser: "firefox", cookiesFile: "" };
const browser: VkAccess = {
  mode: "browser",
  browser: "firefox",
  cookiesFile: "",
};
const file: VkAccess = {
  mode: "file",
  browser: "firefox",
  cookiesFile: "/tmp/cookies.txt",
};

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error cleanup test global
  delete window.electronAPI;
});

describe("VkAccessSection", () => {
  it("renders the three access modes", () => {
    render(<VkAccessSection value={off} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Don't download VK")).toBeInTheDocument();
    expect(screen.getByLabelText("Use my browser login")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Import cookies.txt file"),
    ).toBeInTheDocument();
  });

  it("shows the browser select only in browser mode", () => {
    const { rerender } = render(
      <VkAccessSection value={off} onChange={vi.fn()} />,
    );
    expect(
      screen.queryByLabelText("Browser to read VK login from"),
    ).not.toBeInTheDocument();

    rerender(<VkAccessSection value={browser} onChange={vi.fn()} />);
    expect(
      screen.getByLabelText("Browser to read VK login from"),
    ).toBeInTheDocument();
  });

  it("shows the path input only in file mode", () => {
    render(<VkAccessSection value={file} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Path to cookies.txt")).toHaveValue(
      "/tmp/cookies.txt",
    );
  });

  it("emits a mode change when a radio is selected", () => {
    const onChange = vi.fn();
    render(<VkAccessSection value={off} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Use my browser login"));
    expect(onChange).toHaveBeenCalledWith({ ...off, mode: "browser" });
  });

  it("hides the Test button in off mode", () => {
    render(<VkAccessSection value={off} onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /Test connection/ }),
    ).not.toBeInTheDocument();
  });

  it("shows a success message when testVkAccess resolves ok", async () => {
    const testVkAccess = vi.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error partial mock
    window.electronAPI = { testVkAccess };
    render(<VkAccessSection value={browser} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() =>
      expect(screen.getByText(/VK access works/)).toBeInTheDocument(),
    );
    expect(testVkAccess).toHaveBeenCalledWith(browser);
  });

  it("shows the returned error when testVkAccess fails", async () => {
    const testVkAccess = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Not logged in to VK." });
    // @ts-expect-error partial mock
    window.electronAPI = { testVkAccess };
    render(<VkAccessSection value={browser} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() =>
      expect(screen.getByText(/Not logged in to VK\./)).toBeInTheDocument(),
    );
  });

  it("includes the local-only privacy note", () => {
    render(<VkAccessSection value={off} onChange={vi.fn()} />);
    expect(
      screen.getByText(/read locally only for VK requests/),
    ).toBeInTheDocument();
  });
});
