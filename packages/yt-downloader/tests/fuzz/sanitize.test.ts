import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "~/output";

function randomString(length: number): string {
  const chars = "\0\x01\x1f/\\:*?\"<>|abc123._ \t\n\r";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

describe("sanitizeFilename fuzz", () => {
  it("never returns empty string", () => {
    const inputs = ["", " ", "\0", "...", "///", "***", "<<<>>>", "\x01\x02\x03", ".hidden", "..dotdot", "   "];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("never contains path separators", () => {
    const inputs = ["a/b", "a\\b", "a/b\\c", ...Array.from({ length: 50 }, () => randomString(100))];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result).not.toContain("/");
      expect(result).not.toContain("\\");
    }
  });

  it("never exceeds 200 characters", () => {
    const inputs = ["a".repeat(500), randomString(1000)];
    for (const input of inputs) {
      expect(sanitizeFilename(input).length).toBeLessThanOrEqual(200);
    }
  });

  it("never starts with a dot", () => {
    const inputs = [".config", "..ssh", ".a", "..."];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result[0]).not.toBe(".");
    }
  });

  it("handles unicode safely", () => {
    const inputs = ["café", "naïve", "file name"];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain("/");
    }
  });
});
