"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui/SearchBar";
import { siteConfig } from "@/config/site";
import { getToolCount } from "@/registry";

export function HeroSection() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const toolCount = getToolCount();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/tools?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <section className="border-b border-gray-200 bg-gradient-to-b from-brand-50 to-white">
      <div className="container-page py-20 text-center sm:py-28">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-brand-600">
          {toolCount}+ free tools
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          {siteConfig.tagline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-500">{siteConfig.description}</p>

        <form onSubmit={handleSearch} className="mx-auto mt-10 max-w-2xl">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search 5000+ tools — JSON formatter, word counter, Base64…"
            size="lg"
          />
          <p className="mt-3 text-xs text-gray-400">
            No signup required. Everything runs in your browser.
          </p>
        </form>

        {/* Quick category links */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {["Developer", "Text", "Security", "Converter", "Generator"].map((cat) => (
            <a
              key={cat}
              href={`/categories/${cat.toLowerCase()}`}
              className="hover:border-brand-300 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-700 shadow-sm transition hover:text-brand-700"
            >
              {cat}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
