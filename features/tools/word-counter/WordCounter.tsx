"use client";

/**
 * Word Counter — PLATFORM-004 Everyday reference tool.
 *
 * Only its own logic lives here (textStats); the layout, input panel, and
 * trust surface are all shared platform components.
 */

import { useMemo, useState } from "react";
import { textStats } from "@/lib/everyday/textStats";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EverydayInput } from "@/features/everyday/EverydayInput";

const SAMPLE =
  "Esytol is a multi-category platform of trustworthy, privacy-first, deterministic utilities. Everything runs in your browser. Nothing you type ever leaves your device.";

export function WordCounter() {
  const [input, setInput] = useState("");
  const stats = useMemo(() => textStats(input), [input]);

  const cells: { label: string; value: string }[] = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Characters", value: stats.characters.toLocaleString() },
    { label: "Characters (no spaces)", value: stats.charactersNoSpaces.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
    { label: "Lines", value: stats.lines.toLocaleString() },
    {
      label: "Reading time",
      value: stats.readingMinutes === 0 ? "—" : `${stats.readingMinutes} min`,
    },
  ];

  return (
    <DevToolLayout
      input={
        <EverydayInput
          value={input}
          onChange={setInput}
          label="Your text"
          sample={SAMPLE}
          rows={14}
          ariaLabel="Text to count"
        />
      }
      output={
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Counts
          </span>
          <dl className="grid grid-cols-2 gap-3">
            {cells.map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <dt className="text-xs font-medium uppercase tracking-widest text-gray-400">
                  {c.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      }
      examples={[
        { label: "Short paragraph", value: SAMPLE },
        { label: "Multi-line", value: "Line one.\nLine two.\n\nNew paragraph here." },
      ]}
      onExample={setInput}
    />
  );
}
