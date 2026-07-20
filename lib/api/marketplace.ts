/**
 * Marketplace links — Growth Sprint 002.
 *
 * The RapidAPI listing URL is the buyer-facing entry (RapidAPI supplies keys,
 * metering, and billing). It is env-overridable so the exact slug can be set once
 * the listing is published, without a code change. Until then it points at the
 * intended listing path.
 */
export const RAPIDAPI_LISTING_URL =
  process.env.NEXT_PUBLIC_RAPIDAPI_URL ?? "https://rapidapi.com/easytechlabs/api/esytol-income-tax";

/** The public docs + live playground (works today, no signup). */
export const API_DOCS_PATH = "/developers/income-tax-api";
