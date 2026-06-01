import { describe, expect, it } from "vitest";
import type { VkAccess } from "@/main/vkCookies";
import { buildLinkConfigFields, resolveVkCookieFields } from "@/main/vkCookies";

const VK_URL = "https://vk.com/video-22822305_165372104";
const YT_URL = "https://www.youtube.com/watch?v=abc";
const SC_URL = "https://soundcloud.com/artist/track";

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

describe("resolveVkCookieFields", () => {
  it("returns no cookies when mode is off", () => {
    expect(resolveVkCookieFields(off)).toEqual({
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });

  it("returns the browser when mode is browser and browser is allow-listed", () => {
    expect(resolveVkCookieFields(browser)).toEqual({
      cookiesFromBrowser: "firefox",
      cookiesFile: undefined,
    });
  });

  it("rejects an unsupported browser (no cookies)", () => {
    expect(resolveVkCookieFields({ ...browser, browser: "netscape" })).toEqual({
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });

  it("returns the file (trimmed) when mode is file and a path is set", () => {
    expect(
      resolveVkCookieFields({ ...file, cookiesFile: "  /tmp/c.txt  " }),
    ).toEqual({ cookiesFromBrowser: undefined, cookiesFile: "/tmp/c.txt" });
  });

  it("returns no cookies for file mode with an empty path", () => {
    expect(resolveVkCookieFields({ ...file, cookiesFile: "   " })).toEqual({
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });
});

describe("buildLinkConfigFields — VK-only cookie application", () => {
  it("attaches browser cookies to a VK link", () => {
    expect(buildLinkConfigFields(VK_URL, undefined, browser)).toEqual({
      proxy: undefined,
      cookiesFromBrowser: "firefox",
      cookiesFile: undefined,
    });
  });

  it("attaches file cookies to a VK link", () => {
    expect(buildLinkConfigFields(VK_URL, undefined, file)).toEqual({
      proxy: undefined,
      cookiesFromBrowser: undefined,
      cookiesFile: "/tmp/cookies.txt",
    });
  });

  it("never attaches cookies to a YouTube link, even with VK browser configured", () => {
    expect(buildLinkConfigFields(YT_URL, undefined, browser)).toEqual({
      proxy: undefined,
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });

  it("never attaches cookies to a SoundCloud link, even with VK file configured", () => {
    expect(buildLinkConfigFields(SC_URL, undefined, file)).toEqual({
      proxy: undefined,
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });

  it("preserves the proxy for any link while keeping non-VK cookies off", () => {
    expect(
      buildLinkConfigFields(YT_URL, "socks5://127.0.0.1:2080", browser),
    ).toEqual({
      proxy: "socks5://127.0.0.1:2080",
      cookiesFromBrowser: undefined,
      cookiesFile: undefined,
    });
  });

  it("normalizes an empty/whitespace proxy to undefined", () => {
    expect(buildLinkConfigFields(VK_URL, "   ", browser).proxy).toBeUndefined();
  });
});
