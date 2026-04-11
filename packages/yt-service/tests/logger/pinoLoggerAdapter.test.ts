import { describe, expect, it, vi } from "vitest";
import { PinoLoggerAdapter } from "~/logger/pinoLoggerAdapter";

describe("PinoLoggerAdapter", () => {
  const mockPino = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };

  it("delegates info to pino", () => {
    const adapter = new PinoLoggerAdapter(mockPino as any);
    adapter.info("test");
    expect(mockPino.info).toHaveBeenCalledWith("test");
  });

  it("delegates error to pino", () => {
    const adapter = new PinoLoggerAdapter(mockPino as any);
    adapter.error("test");
    expect(mockPino.error).toHaveBeenCalledWith("test");
  });

  it("delegates warn to pino", () => {
    const adapter = new PinoLoggerAdapter(mockPino as any);
    adapter.warn("test");
    expect(mockPino.warn).toHaveBeenCalledWith("test");
  });

  it("delegates debug to pino", () => {
    const adapter = new PinoLoggerAdapter(mockPino as any);
    adapter.debug("test");
    expect(mockPino.debug).toHaveBeenCalledWith("test");
  });
});
