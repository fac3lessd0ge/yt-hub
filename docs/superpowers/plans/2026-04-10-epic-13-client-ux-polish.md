# Epic 13: Client UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ARIA attributes, focus management, keyboard shortcuts, aria-live regions, and error context hints to bring yt-client accessibility from C+ to B+.

**Architecture:** Enhance existing components in-place — no new component library. Add aria-* attributes, role annotations, and a useKeyboardShortcuts hook. Use aria-live regions for dynamic content (progress, status changes, errors). Autofocus link input on mount and after reset.

**Tech Stack:** React 19, Tailwind CSS 4, Vitest + RTL, @testing-library/jest-dom (already installed — provides toHaveFocus, toHaveAttribute, toHaveAccessibleName)

---

## File Map

| File | Changes |
|------|---------|
| `src/components/download/DownloadForm.tsx` | aria-required, aria-invalid, aria-describedby, autofocus, error ids |
| `src/components/download/DownloadPage.tsx` | aria-live region wrapping state transitions, role="alert" on error |
| `src/components/download/DownloadProgress.tsx` | role="progressbar" + aria-value*, aria-live for status text |
| `src/components/download/DownloadResult.tsx` | role="status" on completion |
| `src/components/layout/Sidebar.tsx` | aria-current="page" on active nav item, role="navigation" |
| `src/components/layout/OfflineBanner.tsx` | role="alert" |
| `src/hooks/useKeyboardShortcuts.ts` | NEW — Escape to cancel, Ctrl+V paste-and-focus |
| `tests/components/DownloadForm.test.tsx` | aria attribute tests |
| `tests/components/DownloadProgress.test.tsx` | progressbar role tests |
| `tests/components/DownloadPage.test.tsx` | aria-live, role="alert" tests |
| `tests/hooks/useKeyboardShortcuts.test.ts` | NEW — keyboard shortcut tests |

---

### Task 1: DownloadForm — ARIA attributes and autofocus

**Files:**
- Modify: `packages/yt-client/src/components/download/DownloadForm.tsx`
- Modify: `packages/yt-client/tests/components/DownloadForm.test.tsx`

- [ ] **Step 1: Add aria tests for form fields**

Add to `tests/components/DownloadForm.test.tsx`:

```typescript
it("link input has aria-required", () => {
  render(<DownloadForm onSubmit={vi.fn()} />);
  expect(screen.getByLabelText("YouTube Link")).toHaveAttribute("aria-required", "true");
});

it("link input gets autofocus", () => {
  render(<DownloadForm onSubmit={vi.fn()} />);
  expect(screen.getByLabelText("YouTube Link")).toHaveFocus();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: 2 new tests FAIL

- [ ] **Step 3: Add aria-required and autoFocus to DownloadForm**

In `DownloadForm.tsx`, update the link input:
```tsx
<input
  id="link"
  type="text"
  value={link}
  onChange={(e) => setLink(e.target.value)}
  placeholder="https://www.youtube.com/watch?v=..."
  aria-required="true"
  aria-invalid={!!urlError}
  aria-describedby={urlError ? "link-error" : undefined}
  autoFocus
  className="..."
/>
{urlError && <p id="link-error" className="text-xs text-destructive" role="alert">{urlError}</p>}
```

Also add `aria-required="true"` to the name input and format select.

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yt-client/src/components/download/DownloadForm.tsx packages/yt-client/tests/components/DownloadForm.test.tsx
git commit -m "feat(yt-client): add ARIA attributes and autofocus to DownloadForm"
```

---

### Task 2: DownloadProgress — progressbar role and aria-live

**Files:**
- Modify: `packages/yt-client/src/components/download/DownloadProgress.tsx`
- Modify: `packages/yt-client/tests/components/DownloadProgress.test.tsx`

- [ ] **Step 1: Add aria tests for progress bar**

Add to `tests/components/DownloadProgress.test.tsx`:

```typescript
it("progress bar has role=progressbar with aria-value attributes", () => {
  const progress = { percent: 42.5, speed: "2.50MiB/s", eta: "00:15" };
  render(<DownloadProgress progress={progress} onCancel={vi.fn()} />);

  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "42.5");
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "100");
});

it("status text is in an aria-live region", () => {
  render(<DownloadProgress progress={null} onCancel={vi.fn()} />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: 2 new tests FAIL

- [ ] **Step 3: Add progressbar role and aria-live to DownloadProgress**

In `DownloadProgress.tsx`:
```tsx
<div className="flex flex-col gap-4" role="status" aria-live="polite">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium">
      {reconnecting ? "Reconnecting..." : "Downloading..."}
    </span>
    <span className="text-muted-foreground">{percent.toFixed(1)}%</span>
  </div>

  <div
    className="h-2 w-full overflow-hidden rounded-full bg-secondary"
    role="progressbar"
    aria-valuenow={percent}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label="Download progress"
  >
    <div
      className="h-full bg-primary transition-all duration-300"
      style={{ width: `${percent}%` }}
    />
  </div>
  {/* ... rest unchanged */}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yt-client/src/components/download/DownloadProgress.tsx packages/yt-client/tests/components/DownloadProgress.test.tsx
git commit -m "feat(yt-client): add progressbar role and aria-live to DownloadProgress"
```

---

### Task 3: DownloadPage — aria-live region and error role

**Files:**
- Modify: `packages/yt-client/src/components/download/DownloadPage.tsx`
- Modify: `packages/yt-client/tests/components/DownloadPage.test.tsx`

- [ ] **Step 1: Add aria tests for state transitions and error**

Add to `tests/components/DownloadPage.test.tsx`:

```typescript
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
  expect(screen.getByText("Saving file...")).toHaveAttribute("aria-busy", "true");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: 2 new tests FAIL

- [ ] **Step 3: Add aria-live, role="alert", and aria-busy to DownloadPage**

In `DownloadPage.tsx`, wrap the dynamic content area:
```tsx
<div className="mx-auto max-w-lg">
  <h2 className="mb-6 text-xl font-semibold">Download</h2>

  <div aria-live="polite">
    {state === "idle" && <DownloadForm onSubmit={start} />}

    {state === "downloading" && (
      <DownloadProgress progress={progress} reconnecting={reconnecting} onCancel={cancel} />
    )}

    {state === "saving" && (
      <p className="text-sm text-muted-foreground" aria-busy="true">Saving file...</p>
    )}

    {state === "complete" && result && (
      <DownloadResult result={result} localPath={localPath} onReset={reset} />
    )}

    {state === "error" && error && (
      <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <h3 className="mb-1 text-sm font-medium text-destructive">Download Failed</h3>
        <p className="text-sm text-destructive/80">[{error.code}] {error.message}</p>
        <button type="button" onClick={reset} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Try Again
        </button>
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yt-client/src/components/download/DownloadPage.tsx packages/yt-client/tests/components/DownloadPage.test.tsx
git commit -m "feat(yt-client): add aria-live region and role=alert to DownloadPage"
```

---

### Task 4: DownloadResult — completion announcement

**Files:**
- Modify: `packages/yt-client/src/components/download/DownloadResult.tsx`
- Modify: `packages/yt-client/tests/components/DownloadResult.test.tsx`

- [ ] **Step 1: Add aria test for completion status**

Add to `tests/components/DownloadResult.test.tsx`:

```typescript
it("has role=status for screen reader announcement", () => {
  render(<DownloadResult result={mockResult} localPath={null} onReset={vi.fn()} />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: 1 new test FAILS

- [ ] **Step 3: Add role="status" to DownloadResult**

In `DownloadResult.tsx`, add `role="status"` to the outer div:
```tsx
<div role="status" className="rounded-lg border border-border p-4">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/yt-client/src/components/download/DownloadResult.tsx packages/yt-client/tests/components/DownloadResult.test.tsx
git commit -m "feat(yt-client): add role=status to DownloadResult for screen readers"
```

---

### Task 5: Sidebar — aria-current and navigation role

**Files:**
- Modify: `packages/yt-client/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add aria-current and role="navigation" to Sidebar**

In `Sidebar.tsx`:
```tsx
<aside className="flex h-full w-52 flex-col border-r border-border bg-sidebar p-3">
  <h1 className="mb-4 px-2 text-lg font-semibold text-sidebar-foreground">
    YT Hub
  </h1>
  <nav className="flex flex-col gap-1" aria-label="Main navigation">
    {navItems.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-current={activePage === item.id ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          activePage === item.id
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <item.icon className="h-4 w-4" aria-hidden="true" />
        {item.label}
      </button>
    ))}
  </nav>
</aside>
```

- [ ] **Step 2: Add role="alert" to OfflineBanner**

In `OfflineBanner.tsx`:
```tsx
export function OfflineBanner() {
  return (
    <div role="alert" className="bg-destructive/90 px-4 py-2 text-center text-sm font-medium text-destructive-foreground">
      You are offline. Please check your internet connection.
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS (no tests broken by additive ARIA changes)

- [ ] **Step 4: Commit**

```bash
git add packages/yt-client/src/components/layout/Sidebar.tsx packages/yt-client/src/components/layout/OfflineBanner.tsx
git commit -m "feat(yt-client): add aria-current to Sidebar, role=alert to OfflineBanner"
```

---

### Task 6: Keyboard shortcuts — Escape to cancel

**Files:**
- Create: `packages/yt-client/src/hooks/useKeyboardShortcuts.ts`
- Create: `packages/yt-client/tests/hooks/useKeyboardShortcuts.test.ts`
- Modify: `packages/yt-client/src/components/download/DownloadPage.tsx`

- [ ] **Step 1: Write keyboard shortcut tests**

Create `tests/hooks/useKeyboardShortcuts.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: 3 new tests FAIL (module not found)

- [ ] **Step 3: Implement useKeyboardShortcuts**

Create `src/hooks/useKeyboardShortcuts.ts`:

```typescript
import { useEffect } from "react";

export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      shortcuts[e.key]?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
```

- [ ] **Step 4: Wire Escape to cancel in DownloadPage**

In `DownloadPage.tsx`, add:
```typescript
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useMemo } from "react";

// Inside DownloadPage:
const shortcuts = useMemo(
  () => (state === "downloading" ? { Escape: cancel } : {}),
  [state, cancel],
);
useKeyboardShortcuts(shortcuts);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/yt-client/src/hooks/useKeyboardShortcuts.ts packages/yt-client/tests/hooks/useKeyboardShortcuts.test.ts packages/yt-client/src/components/download/DownloadPage.tsx
git commit -m "feat(yt-client): add keyboard shortcuts — Escape to cancel download"
```

---

### Task 7: Lint + typecheck + final verification

- [ ] **Step 1: Run biome lint with auto-fix**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd packages/yt-client && npx biome check --write .
```

- [ ] **Step 2: Run full affected checks**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx nx affected -t lint,test,typecheck --base=dev
```
Expected: All PASS

- [ ] **Step 3: Commit lint fixes if any**

```bash
git add -A && git commit -m "chore: fix lint"
```

- [ ] **Step 4: Run Rust tests too**

```bash
cd packages/yt-api && cargo test
```
Expected: All PASS (no Rust changes, sanity check)
