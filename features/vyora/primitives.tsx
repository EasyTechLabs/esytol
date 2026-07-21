"use client";

/**
 * Vyora — shared UI primitives (design-system layer). These replace hand-rolled
 * card / button / input / badge markup across the screens so every surface uses
 * ONE source of truth for radius, spacing, border, and colour tokens. Values map
 * exactly to the existing design system (brand + positive/negative tokens), so
 * adopting them is a centralisation, not a restyle. `className` always merges
 * last, so a caller can still fine-tune a single instance.
 */

import { cn } from "@/lib/cn";

/** A surface card: rounded-2xl, hairline border, white. `tone="danger"` for destructive sections. */
export function Card({
  children,
  className,
  tone = "default",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "danger" | "dashed";
  as?: "div" | "section";
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "dashed"
        ? "border-dashed border-gray-300 bg-white"
        : "border-gray-200 bg-white";
  return <Tag className={cn("rounded-2xl border p-4", toneCls, className)}>{children}</Tag>;
}

type ButtonVariant = "primary" | "positive" | "negative" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-700",
  positive: "bg-positive text-white hover:bg-positive-strong focus-visible:outline-positive-strong",
  negative: "bg-negative text-white hover:bg-negative-strong focus-visible:outline-negative-strong",
  secondary:
    "border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-brand-600",
  danger:
    "border-2 border-red-300 bg-white text-red-700 hover:bg-red-100 focus-visible:outline-red-500",
  ghost: "text-brand-700 hover:bg-gray-50 focus-visible:outline-brand-600",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3 py-1.5 text-sm",
  md: "rounded-xl px-4 py-3 text-base",
  lg: "rounded-2xl px-4 py-4 text-lg",
};

/** The one button. Variants + sizes cover every existing button; `className` fine-tunes an instance. */
export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  size = "md",
  block,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100",
        SIZE[size],
        VARIANT[variant],
        block && "w-full",
        className
      )}
    >
      {children}
    </button>
  );
}

/** A single-line text input matching the app's field style (rounded-2xl, 2px border, brand focus). */
export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-500 focus-visible:border-brand-500",
        className
      )}
    />
  );
}

/** A small pill label (e.g. the Alpha badge). Neutral by default. */
export function Badge({
  children,
  className,
  tone = "brand",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "brand" | "positive" | "negative" | "caution";
}) {
  const toneCls = {
    brand: "bg-brand-50 text-brand-700",
    positive: "bg-positive-tint text-positive-strong",
    negative: "bg-negative-tint text-negative-strong",
    caution: "bg-amber-50 text-amber-800",
  }[tone];
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}
