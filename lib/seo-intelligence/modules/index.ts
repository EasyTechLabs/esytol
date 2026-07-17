/**
 * The module registry.
 *
 * Adding an SEO module means adding it here — the roadmap, reports and the
 * Marketing Agent adapters all read this list, so nothing else changes.
 */

import type { SeoModule } from "../types";
import { keywordsModule } from "./keywords";
import { contentGapModule } from "./contentGap";
import { internalLinksModule } from "./internalLinks";
import { serpModule } from "./serp";
import { clustersModule } from "./clusters";
import { ctrModule } from "./ctr";
import { freshnessModule } from "./freshness";

export const SEO_MODULES: SeoModule[] = [
  keywordsModule,
  contentGapModule,
  internalLinksModule,
  serpModule,
  clustersModule,
  ctrModule,
  freshnessModule,
];

export {
  keywordsModule,
  contentGapModule,
  internalLinksModule,
  serpModule,
  clustersModule,
  ctrModule,
  freshnessModule,
};
export { keywordOpportunities } from "./keywords";
export { linkSuggestions, inboundGraph, outboundLinks } from "./internalLinks";
export { serpOpportunities, classifyQuery } from "./serp";
export { clusterHealth } from "./clusters";
export { ctrSuggestions, ctrSuggestionFor } from "./ctr";
