export function useAppVersion(): string {
  return window.electronAPI?.getAppVersion?.() ?? "";
}
