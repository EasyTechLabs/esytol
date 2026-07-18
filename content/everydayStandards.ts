/**
 * Everyday-tool trust data — PLATFORM-004.
 *
 * The Everyday-domain analogue of content/methodology.ts (Finance) and
 * content/devStandards.ts (Developer). Everyday tools are neither regulator-cited
 * nor RFC-bound; they are judged on where they run, what they retain, the
 * algorithm they use, the objective standard behind them (Unicode, ISO, calendar
 * rules), and their limits. Same trust-surface pattern, fields that fit the domain.
 *
 * Keyed by tool slug, like getMethodology() / getDevStandard(). Rendered by
 * EverydayTrust. Scales to every future Everyday tool by adding one entry.
 */

export interface EverydayStandardRef {
  label: string;
  url?: string;
}

export interface EverydayStandard {
  /** Where the tool runs. V1 Everyday tools are all "client". */
  processing: "client" | "server";
  /** Data-retention statement — for client tools, that nothing is retained. */
  dataRetention: string;
  /** Plain-language algorithm explanation. */
  howItWorks: string;
  /** Honest limits. */
  limitations: string[];
  /** Objective standards the tool follows (Unicode, ISO, calendar rules…). */
  standards: EverydayStandardRef[];
  /** Who maintains the tool. */
  maintainedBy: string;
}

const MAINTAINER = "EasyTechLabs";

const CLIENT_ONLY =
  "Nothing you type, paste, or drop is uploaded, stored, or logged. Everything is computed in your browser and never leaves your device — close the tab and it is gone.";

export const EVERYDAY_STANDARDS: Record<string, EverydayStandard> = {
  "age-calculator": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Your age is the exact calendar span from your date of birth to the chosen date. The tool finds the largest whole number of months between the two dates (clamping month-ends, so 31 Jan + 1 month = 28/29 Feb), then the remaining days. Totals in weeks, days, hours, minutes and seconds come from the exact day count, so every leap day is counted.",
    limitations: [
      "Uses the proleptic Gregorian calendar; dates before its adoption are computed by extension, not historically.",
      "Day counts use UTC midnights, so daylight-saving shifts never add or drop a day.",
      "It measures elapsed calendar time, not legal age of majority (which varies by jurisdiction).",
    ],
    standards: [
      {
        label: "ISO 8601 — date and time format",
        url: "https://www.iso.org/iso-8601-date-and-time-format.html",
      },
      { label: "Gregorian calendar (leap-year rule)" },
    ],
    maintainedBy: MAINTAINER,
  },
  "word-counter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Words are runs of non-whitespace separated by spaces, tabs, or newlines. Characters are counted with and without whitespace. Sentences are counted by terminal punctuation (. ! ?), paragraphs by blank-line separation, and reading time is estimated at 200 words per minute — the widely used average adult silent-reading rate.",
    limitations: [
      "Sentence and paragraph counts are heuristic — abbreviations (e.g. 'Dr.') and unusual formatting can shift them slightly.",
      "Reading time is an estimate at 200 wpm; actual speed varies by reader and material.",
      "Word rules are whitespace-based and language-agnostic; scripts without spaces (e.g. Chinese) are not word-segmented.",
    ],
    standards: [
      { label: "Unicode whitespace definitions", url: "https://www.unicode.org/reports/tr44/" },
    ],
    maintainedBy: MAINTAINER,
  },
  "case-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Simple cases (UPPER, lower, Title, Sentence) transform the text in place. Programmer cases (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case) first split the text into word tokens — respecting spaces, punctuation, and camelCase boundaries — then rejoin them in the target style.",
    limitations: [
      "Title Case capitalises every word; it does not apply style-guide rules that lowercase short words (a, the, of).",
      "Programmer-case tokenisation keeps only letters and digits; other characters become word separators.",
      "Case mapping follows the browser's Unicode rules; locale-specific mappings (e.g. Turkish dotless ı) are not special-cased.",
    ],
    standards: [{ label: "Unicode case mapping", url: "https://www.unicode.org/reports/tr21/" }],
    maintainedBy: MAINTAINER,
  },
};

export function getEverydayStandard(slug: string): EverydayStandard | undefined {
  return EVERYDAY_STANDARDS[slug];
}
