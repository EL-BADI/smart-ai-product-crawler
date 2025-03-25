import { URL } from "url";

export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove fragments (#)
    url.hash = "";

    // Remove language prefix from pathname
    url.pathname = removeLanguagePrefix(url.pathname);

    // Remove trailing slashes
    url.pathname = url.pathname.replace(/\/+$/, "");

    // Sort query parameters
    const searchParams = Array.from(url.searchParams.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    url.search = new URLSearchParams(searchParams).toString();

    // Convert to lowercase
    const normalized = url.toString().toLowerCase();

    return normalized;
  } catch (error) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

export function isSameDomain(url1: string, url2: string): boolean {
  try {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;
    return domain1 === domain2;
  } catch {
    return false;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Common language codes in URLs
const LANGUAGE_CODES = new Set([
  "en",
  "ar",
  "fr",
  "es",
  "de",
  "it",
  "ru",
  "zh",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt",
  "tr",
  "vi",
  "th",
  "id",
  "ms",
  "hi",
]);

function removeLanguagePrefix(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && LANGUAGE_CODES.has(parts[0].toLowerCase())) {
    return "/" + parts.slice(1).join("/");
  }
  return pathname;
}

export function isResourceUrl(url: string): boolean {
  const resourcePatterns = [
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|webp)(\?.*)?$/i,
    /\/(static|assets|images|img|fonts|css|js)\//i,
    /\/_next\/(static|image|data|chunks)/i,
    /\.(br|gz|zip|rar|7z|tar|bz2)$/i,
    /\/(cdn-cgi|__webpack|webpack)\//i,
    /\?(q=|w=|h=|quality=|size=|width=|height=)/i, // Image resize/quality parameters
  ];

  return resourcePatterns.some((pattern) => pattern.test(url));
}
