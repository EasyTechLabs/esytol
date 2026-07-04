"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search tools…",
  className,
  size = "md",
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Search icon */}
      <svg
        className={cn(
          "pointer-events-none absolute left-3 text-gray-400",
          size === "lg" ? "left-4 h-5 w-5" : "h-4 w-4"
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>

      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label="Search tools"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm",
          "focus:border-brand-400 focus:ring-brand-200 placeholder:text-gray-400 focus:outline-none focus:ring-2",
          size === "lg"
            ? "py-3.5 pl-12 pr-12 text-base"
            : size === "sm"
              ? "py-1.5 pl-9 pr-9 text-sm"
              : "py-2.5 pl-10 pr-10 text-sm"
        )}
      />

      {/* Clear button */}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
            inputRef.current?.focus();
          }}
          className={cn(
            "absolute right-3 flex items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600",
            size === "lg" ? "right-4 h-5 w-5" : "h-4 w-4"
          )}
        >
          <svg
            className="h-full w-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
