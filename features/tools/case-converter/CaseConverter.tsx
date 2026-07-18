"use client";

/**
 * Case Converter — PLATFORM-004 Everyday reference tool.
 *
 * Only its own logic lives here (textCase); layout, input panel, copy, and trust
 * surface are shared platform components. Shows every case at once so the user
 * copies whichever they need.
 */

import { useMemo, useState } from "react";
import { toAllCases } from "@/lib/everyday/textCase";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EverydayInput } from "@/features/everyday/EverydayInput";
import { CopyButton } from "@/features/tool/CopyButton";

const SAMPLE = "the quick brown fox";

export function CaseConverter() {
  const [input, setInput] = useState("");
  const cases = useMemo(() => toAllCases(input), [input]);

  return (
    <DevToolLayout
      input={
        <EverydayInput
          value={input}
          onChange={setInput}
          label="Text to convert"
          placeholder="Type any text — spaces, camelCase, snake_case all work…"
          sample={SAMPLE}
          rows={6}
          ariaLabel="Text to convert"
        />
      }
      output={
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
            All cases
          </span>
          <ul className="flex flex-col gap-2">
            {cases.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium uppercase tracking-widest text-gray-400">
                    {c.name}
                  </span>
                  <span className="block truncate font-mono text-sm text-gray-800">
                    {c.value || "—"}
                  </span>
                </span>
                <CopyButton value={c.value} disabled={c.value === ""} />
              </li>
            ))}
          </ul>
        </div>
      }
      examples={[
        { label: "Sentence", value: "the quick brown fox" },
        { label: "camelCase in", value: "myVariableName" },
        { label: "snake_case in", value: "user_first_name" },
      ]}
      onExample={setInput}
    />
  );
}
