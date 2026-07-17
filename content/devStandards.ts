/**
 * Developer-tool trust data — PLATFORM-003.
 *
 * The developer-category analogue of content/methodology.ts. Finance tools are
 * judged on regulator-cited methodology; developer tools are judged on where the
 * work happens (browser vs server), what is retained, the standard they
 * implement, and their limits. Same idea — a trust surface beside the tool —
 * with fields that fit the domain instead of contorting finance ones.
 *
 * Keyed by tool slug, exactly like getMethodology(). Rendered by DeveloperTrust.
 */

export interface StandardRef {
  label: string;
  url?: string;
}

export interface DevStandard {
  /** Where the tool runs. V1 developer tools are all "client". */
  processing: "client" | "server";
  /** One line on data retention — for client tools, that nothing is retained. */
  dataRetention: string;
  /** Plain-language "how it works". */
  howItWorks: string;
  /** Honest limits — encoding≠encryption, engine quirks, size caveats. */
  limitations: string[];
  /** Standards / RFCs the tool implements. Clickable when a url is present. */
  references: StandardRef[];
  /** Who maintains the tool. */
  maintainedBy: string;
}

const MAINTAINER = "EasyTechLabs Engineering";

const CLIENT_ONLY =
  "Nothing you paste, type, or drop is uploaded, stored, or logged. All processing happens in your browser and the data never leaves your device — close the tab and it is gone.";

export const DEV_STANDARDS: Record<string, DevStandard> = {
  "json-formatter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Your input is parsed with the browser's native JSON parser and re-serialised with your chosen indentation (2, 4, tab, or minified). Optional key-sorting produces canonical output. Invalid JSON is reported with the parser's message and, where the engine provides it, the line and column of the error.",
    limitations: [
      "Formatting normalises whitespace and (optionally) key order; it never changes values, so numbers keep their exact JSON representation.",
      "Extremely large documents (10 MB+) format in-browser and may be slower on low-powered devices.",
      "Comments and trailing commas are not valid JSON and are reported as errors — this is a strict RFC 8259 parser, not JSON5.",
    ],
    references: [
      {
        label: "RFC 8259 — The JSON Data Interchange Format",
        url: "https://www.rfc-editor.org/rfc/rfc8259",
      },
      {
        label: "ECMA-404 — The JSON Data Interchange Syntax",
        url: "https://ecma-international.org/publications-and-standards/standards/ecma-404/",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "base64-encoder": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Text is encoded to UTF-8 bytes and then to Base64, so non-ASCII characters (₹, é, emoji) survive a round trip. Decoding reverses this and accepts both standard and URL-safe input, restoring padding automatically. An optional URL-safe mode swaps +/ for -_ and drops padding.",
    limitations: [
      "Base64 is encoding, not encryption — anyone can decode a Base64 string. It provides no confidentiality.",
      "Base64 grows data by roughly one third; it is for safe transport over text channels, not compression.",
      "Decoding invalid Base64 (wrong length or non-alphabet characters) is reported as an error rather than producing garbage.",
    ],
    references: [
      {
        label: "RFC 4648 — The Base16, Base32, and Base64 Data Encodings",
        url: "https://www.rfc-editor.org/rfc/rfc4648",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "url-encoder": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Component mode uses encodeURIComponent to percent-encode reserved characters (& ? = / #), which is correct for query-parameter and path-segment values. Full mode uses encodeURI, preserving URL structure for encoding a whole URL. Decoding reverses either mode and flags malformed percent-sequences.",
    limitations: [
      "Component mode escapes URL-reserved characters; full mode deliberately does not — choose the mode that matches whether you are encoding a value or a whole URL.",
      "A lone '%' or an invalid '%zz' sequence cannot be decoded and is reported as an error.",
      "Percent-encoding operates on UTF-8 bytes, matching modern browsers and the WHATWG URL standard.",
    ],
    references: [
      {
        label: "RFC 3986 — Uniform Resource Identifier (URI): Generic Syntax",
        url: "https://www.rfc-editor.org/rfc/rfc3986",
      },
      { label: "WHATWG URL Standard", url: "https://url.spec.whatwg.org/" },
    ],
    maintainedBy: MAINTAINER,
  },
};

export function getDevStandard(slug: string): DevStandard | undefined {
  return DEV_STANDARDS[slug];
}
