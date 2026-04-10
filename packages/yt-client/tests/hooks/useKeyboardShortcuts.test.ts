import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("calls handler when registered key is pressed", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: handler }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call handler for unregistered keys", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: handler }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ Escape: handler }));

    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).not.toHaveBeenCalled();
  });
});
