import {
  detectSource,
  isSupportedCookieBrowser,
  type YtDlpConfig,
} from "yt-downloader";

/**
 * How (if at all) the user authorizes VK downloads. Cookies are applied ONLY to
 * VK links — see ytDlpConfigForLink. "off" means VK stays gated.
 */
export interface VkAccess {
  mode: "off" | "browser" | "file";
  browser: string;
  cookiesFile: string;
}

type CookieFields = Pick<YtDlpConfig, "cookiesFromBrowser" | "cookiesFile">;

const NO_COOKIES: CookieFields = {
  cookiesFromBrowser: undefined,
  cookiesFile: undefined,
};

/**
 * Translate a VkAccess setting into the cookie fields of a YtDlpConfig. Returns
 * no cookies when no usable source is configured (mode "off", an unsupported
 * browser, or an empty file path).
 *
 * SECURITY: a browser value is only accepted after isSupportedCookieBrowser, so
 * an arbitrary string can never reach yt-dlp's --cookies-from-browser.
 */
export function resolveVkCookieFields(vkAccess: VkAccess): CookieFields {
  if (
    vkAccess.mode === "browser" &&
    isSupportedCookieBrowser(vkAccess.browser)
  ) {
    return { cookiesFromBrowser: vkAccess.browser, cookiesFile: undefined };
  }
  if (vkAccess.mode === "file" && vkAccess.cookiesFile.trim()) {
    return {
      cookiesFromBrowser: undefined,
      cookiesFile: vkAccess.cookiesFile.trim(),
    };
  }
  return NO_COOKIES;
}

/**
 * Build the cookie + proxy fields of a yt-dlp config for a specific link. The
 * proxy (when set) always applies; VK cookies are attached ONLY when the link
 * is a VK URL. Non-VK links never receive cookies even if a VK source is
 * configured.
 */
export function buildLinkConfigFields(
  link: string,
  proxy: string | undefined,
  vkAccess: VkAccess,
): Pick<YtDlpConfig, "proxy" | "cookiesFromBrowser" | "cookiesFile"> {
  const isVk = detectSource(link)?.source === "vk";
  const cookies = isVk ? resolveVkCookieFields(vkAccess) : NO_COOKIES;
  return { proxy: proxy?.trim() || undefined, ...cookies };
}
