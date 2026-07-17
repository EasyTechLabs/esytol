"use client";

/**
 * Records "you used this tool" into the local finance store (PROJECT-003).
 *
 * Renders nothing and changes nothing about the page — one additive line in
 * ToolLayout gives every tool recency tracking without touching a single
 * calculator. Local-only by construction: it writes to localStorage and to
 * nowhere else.
 */

import { useEffect } from "react";
import { recordToolUse } from "@/lib/localFinance";

export function RecentToolTracker({ slug, name }: { slug: string; name: string }) {
  useEffect(() => {
    recordToolUse(slug, name);
  }, [slug, name]);
  return null;
}
