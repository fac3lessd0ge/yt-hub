import { describe, it, expect } from "vitest";
import { BackendRegistry } from "~/download";
import type { IDownloadBackend } from "~/download";

function fakeBackend(name: string): IDownloadBackend {
  return {
    name,
    supportedFormats: () => [{ id: "mp3", label: "MP3" }],
    requiredDependencies: () => [],
    download: async () => {},
  };
}

describe("BackendRegistry", () => {
  it("registers and retrieves a backend", () => {
    const registry = new BackendRegistry();
    const backend = fakeBackend("test");
    registry.register(backend);
    expect(registry.get("test")).toBe(backend);
  });

  it("returns undefined for unknown backend", () => {
    const registry = new BackendRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("names returns all registered backend names", () => {
    const registry = new BackendRegistry();
    registry.register(fakeBackend("alpha"));
    registry.register(fakeBackend("beta"));
    expect(registry.names()).toContain("alpha");
    expect(registry.names()).toContain("beta");
    expect(registry.names().length).toBe(2);
  });

  it("register overwrites existing backend with same name", () => {
    const registry = new BackendRegistry();
    const first = fakeBackend("test");
    const second = fakeBackend("test");
    registry.register(first);
    registry.register(second);
    expect(registry.get("test")).toBe(second);
    expect(registry.names().length).toBe(1);
  });
});
