"use client";

/**
 * Contact / Enterprise / API-key request form — Growth Sprint 002 (Conversion).
 *
 * Posts to POST /api/v1/contact (the lead-capture seam). Fires a GA event on
 * submit so lead intent is measured from real submissions. No data is stored
 * client-side; the endpoint records the lead.
 */

import { useState } from "react";
import { trackEvent } from "@/analytics";
import type { LeadType } from "@/lib/api/leads";

export function ContactForm({ type, source }: { type: LeadType; source: string }) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    const form = new FormData(e.currentTarget);
    const payload = {
      type,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? ""),
      message: String(form.get("message") ?? ""),
      source,
    };
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        trackEvent("lead_submitted", { type, source });
        setState("done");
        setMessage(json.message ?? "Thanks — we'll be in touch.");
      } else {
        setState("error");
        setMessage(json.errors?.[0]?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        role="status"
      >
        {message}
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Name</span>
          <input name="name" required autoComplete="name" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Work email</span>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Company (optional)</span>
        <input name="company" autoComplete="organization" className={inputCls} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          {type === "enterprise" ? "What do you need? (volume, SLA, deployment)" : "Message"}
        </span>
        <textarea name="message" rows={4} className={inputCls} />
      </label>
      {state === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {state === "submitting"
          ? "Sending…"
          : type === "enterprise"
            ? "Request enterprise access"
            : "Send"}
      </button>
    </form>
  );
}
