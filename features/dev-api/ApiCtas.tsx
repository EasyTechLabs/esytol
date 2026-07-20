"use client";

/**
 * Conversion CTAs — Growth Sprint 002 (Conversion + Measurement).
 *
 * Buttons that both convert AND measure: every click fires a GA event
 * (no-op unless analytics is configured), so signup/contact intent is tracked
 * from real interactions — never invented.
 */

import { trackEvent } from "@/analytics";
import { RAPIDAPI_LISTING_URL, API_DOCS_PATH } from "@/lib/api/marketplace";

type Variant = "primary" | "secondary";

const cls = (v: Variant) =>
  v === "primary"
    ? "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
    : "inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";

/** "Get API Key" / "Get Started" — sends the developer to the RapidAPI listing (keys + billing there). */
export function GetApiKeyButton({
  source,
  label = "Get API key",
  variant = "primary",
}: {
  source: string;
  label?: string;
  variant?: Variant;
}) {
  return (
    <a
      href={RAPIDAPI_LISTING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cls(variant)}
      onClick={() => trackEvent("api_key_cta_click", { source, destination: "rapidapi" })}
    >
      {label}
    </a>
  );
}

/** "Get Started (free)" — the no-signup public docs + playground path. */
export function GetStartedButton({
  source,
  variant = "secondary",
}: {
  source: string;
  variant?: Variant;
}) {
  return (
    <a
      href={API_DOCS_PATH}
      className={cls(variant)}
      onClick={() => trackEvent("get_started_click", { source, destination: "docs" })}
    >
      Get started free
    </a>
  );
}

/** "Contact Sales" / "Request Enterprise" — routes to the enterprise page. */
export function ContactSalesButton({
  source,
  label = "Contact sales",
  variant = "secondary",
}: {
  source: string;
  label?: string;
  variant?: Variant;
}) {
  return (
    <a
      href="/enterprise"
      className={cls(variant)}
      onClick={() => trackEvent("contact_sales_click", { source, destination: "enterprise" })}
    >
      {label}
    </a>
  );
}
