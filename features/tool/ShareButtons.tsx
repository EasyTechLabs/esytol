"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface ShareButtonsProps {
  title: string;
  url: string;
  className?: string;
}

export function ShareButtons({ title, url, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Share</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          Share on X
        </a>
      </div>
    </div>
  );
}
