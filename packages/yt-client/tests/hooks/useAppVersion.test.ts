import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAppVersion } from "@/hooks/useAppVersion";

describe("useAppVersion", () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    if (originalElectronAPI) {
      window.electronAPI = originalElectronAPI;
    } else {
      delete (window as { electronAPI?: unknown }).electronAPI;
    }
  });

  it("returns the version exposed via electronAPI", () => {
    (window as unknown as { electronAPI: { getAppVersion: () => string } }).electronAPI = {
      getAppVersion: () => "1.3.1",
    };

    const { result } = renderHook(() => useAppVersion());

    expect(result.current).toBe("1.3.1");
  });

  it("returns empty string when electronAPI is unavailable", () => {
    delete (window as { electronAPI?: unknown }).electronAPI;

    const { result } = renderHook(() => useAppVersion());

    expect(result.current).toBe("");
  });
});
