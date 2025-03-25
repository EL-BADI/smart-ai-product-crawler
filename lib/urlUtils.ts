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

// Resource file extensions to skip
const RESOURCE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".css",
  ".js",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".rar",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
]);

// Common product URL patterns
const PRODUCT_URL_PATTERNS = [
  /\/p\/|\/product\/|\/products?\//i,
  /\/item\/|\/items?\//i,
  /-p-\d+/i,
  /prod(uct)?-?id/i,
];

// Common listing URL patterns
const LISTING_URL_PATTERNS = [
  /\/c\/|\/category\/|\/categories\//i,
  /\/collections?\//i,
  /\/shop\//i,
  /\/search/i,
  /page=?\d+/i,
];

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

export async function isLikelyProductOrListingUrl(
  url: string
): Promise<{ isLikely: boolean; type: "product" | "listing" | "other" }> {
  try {
    const parsedUrl = new URL(url);
    const pathAndQuery = parsedUrl.pathname + parsedUrl.search;
    const cleanUrl = pathAndQuery.toLowerCase();

    // Multi-language product terms (English, French, Arabic)
    const PRODUCT_TERMS = [
      // English
      "product",
      "item",
      "sku",
      "prod",
      "buy",
      "detail",
      "purchase",
      "shop",
      // French
      "produit",
      "article",
      "achat",
      "détail",
      "acheter",
      "boutique",
      // Arabic (transliterated)
      "muntaj",
      "sila",
      "mahsul",
      "shira",
      "taswiq",
    ];

    // Multi-language listing terms
    const LISTING_TERMS = [
      // English
      "category",
      "categories",
      "collection",
      "shop",
      "catalog",
      "department",
      "brand",
      "search",
      "browse",
      "all",
      "sale",
      "new",
      // French
      "catégorie",
      "catégories",
      "collection",
      "magasin",
      "catalogue",
      "département",
      "marque",
      "recherche",
      "nouveautés",
      "promotion",
      // Arabic (transliterated)
      "qism",
      "majmua",
      "mutjar",
      "tasnif",
      "almarqa",
      "bahth",
    ];

    // Multi-language utility terms
    const UTILITY_TERMS = [
      // English
      "login",
      "signup",
      "account",
      "cart",
      "checkout",
      "wishlist",
      "track",
      // French
      "connexion",
      "compte",
      "panier",
      "paiement",
      "suivi",
      // Arabic (transliterated)
      "dakhil",
      "hisab",
      "sabat",
      "tawid",
    ];

    // Enhanced regex patterns with language support
    const PRODUCT_PATTERNS = [
      // Universal patterns
      /\/p\/|\/prod?\/|\/item\/|\/sku\//i,
      /\/[\w-]+-\d+[a-z]?(\/|$)/i, // Slug with ending numbers
      /[&\?](pid|product_id|itemcode)=/i,
      /(_p_|_prod_|_item_)/i,

      // Language-specific patterns
      new RegExp(`\\/(${PRODUCT_TERMS.join("|")})\\b`, "i"),
      new RegExp(`-(${PRODUCT_TERMS.join("|")})-`, "i"),
      /\/\d{6,}/i, // Long number sequences
    ];

    const LISTING_PATTERNS = [
      // Universal patterns
      /\/c\/|\/cat\/|\/col\/|\/browse\//i,
      /[&\?](page|offset|sort|filter)=/i,
      /\/[\w-]+\/[\w-]+(\/|$)/i, // Nested paths

      // Language-specific patterns
      new RegExp(`\\/(${LISTING_TERMS.join("|")})\\b`, "i"),
      new RegExp(`-(${LISTING_TERMS.join("|")})-`, "i"),
      /\/\d+-\d+(\/|$)/i, // Number ranges
    ];

    // Skip resource URLs
    if (isResourceUrl(url)) {
      return { isLikely: false, type: "other" };
    }

    // Check product patterns
    if (PRODUCT_PATTERNS.some((pattern) => pattern.test(cleanUrl))) {
      return { isLikely: true, type: "product" };
    }

    // Check listing patterns
    if (LISTING_PATTERNS.some((pattern) => pattern.test(cleanUrl))) {
      return { isLikely: true, type: "listing" };
    }

    // Enhanced parameter detection
    const params = parsedUrl.searchParams;
    const hasProductParams = ["sku", "product_id", "itemid"].some((p) =>
      params.has(p)
    );
    const hasListingParams = ["category_id", "collection_id", "page"].some(
      (p) => params.has(p)
    );

    if (hasProductParams) return { isLikely: true, type: "product" };
    if (hasListingParams) return { isLikely: true, type: "listing" };

    // Language-agnostic structural analysis
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";

    // Product indicators
    const productIndicators = [
      /\d{6,}/, // Long numbers (likely SKU)
      /[a-z]{2,}\d{4,}[a-z]?/i, // Mixed alphanumeric
      /(_prod_|_item_)/i,
      /-p-\d+/i,
    ];

    // Listing indicators
    const listingIndicators = [/^pg-\d+/i, /-c-\d+/i, /-cat-/i, /\/all(\/|$)/i];

    if (productIndicators.some((p) => p.test(lastSegment))) {
      return { isLikely: true, type: "product" };
    }

    if (listingIndicators.some((p) => p.test(lastSegment))) {
      return { isLikely: true, type: "listing" };
    }

    // Handle language-specific paths
    const langCodes = ["en", "fr", "ar", "es", "de"];
    const isLocalizedPath =
      segments.length > 0 && langCodes.includes(segments[0]);
    const contentSegments = isLocalizedPath ? segments.slice(1) : segments;

    // Analyze content path after language code
    if (contentSegments.length >= 2) {
      const pathString = contentSegments.join("/");
      const hasProductTerms = new RegExp(PRODUCT_TERMS.join("|"), "i").test(
        pathString
      );
      const hasListingTerms = new RegExp(LISTING_TERMS.join("|"), "i").test(
        pathString
      );

      if (hasProductTerms) return { isLikely: true, type: "product" };
      if (hasListingTerms) return { isLikely: true, type: "listing" };
    }

    // Final check for utility pages
    const utilityPattern = new RegExp(UTILITY_TERMS.join("|"), "i");
    if (utilityPattern.test(cleanUrl)) {
      return { isLikely: false, type: "other" };
    }

    return { isLikely: false, type: "other" };
  } catch {
    return { isLikely: false, type: "other" };
  }
}
