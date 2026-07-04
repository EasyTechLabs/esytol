"use client";

import { useState } from "react";
import type { FAQ } from "@/types/tool";
import { cn } from "@/lib/cn";

interface FAQSectionProps {
  items: FAQ[];
}

export function FAQSection({ items }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-4 text-xl font-bold text-gray-900">
        Frequently Asked Questions
      </h2>
      <dl className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-white">
            <dt>
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900"
              >
                {item.question}
                <svg
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                    openIndex === index && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </dt>
            {openIndex === index && (
              <dd className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{item.answer}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
