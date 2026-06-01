import { describe, expect, it } from "vitest";
import { getProxyValidationError } from "@/lib/proxyValidation";

describe("getProxyValidationError", () => {
  it("accepts an empty value (no proxy)", () => {
    expect(getProxyValidationError("")).toBeNull();
    expect(getProxyValidationError("   ")).toBeNull();
  });

  it("accepts socks5 / http / https proxy URLs", () => {
    expect(getProxyValidationError("socks5://127.0.0.1:2080")).toBeNull();
    expect(getProxyValidationError("socks5h://10.0.0.1:1080")).toBeNull();
    expect(getProxyValidationError("http://127.0.0.1:8080")).toBeNull();
    expect(getProxyValidationError("https://proxy.example.com:443")).toBeNull();
    expect(getProxyValidationError("http://user:pass@host:8080")).toBeNull();
  });

  it("rejects a value with no scheme", () => {
    expect(getProxyValidationError("127.0.0.1:2080")).not.toBeNull();
  });

  it("rejects an unsupported scheme", () => {
    expect(getProxyValidationError("ftp://127.0.0.1:21")).not.toBeNull();
  });

  it("rejects a malformed URL", () => {
    expect(getProxyValidationError("not a url")).not.toBeNull();
  });

  it("rejects a scheme with no host", () => {
    expect(getProxyValidationError("socks5://")).not.toBeNull();
  });
});
