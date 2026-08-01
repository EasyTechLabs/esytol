"use client";

/**
 * Vyora — long-press quick actions (V2-006.1).
 *
 * Long press any customer to get the six things a merchant does with them,
 * without navigating first.
 *
 * Every action reuses what already exists: `tel:` and `wa.me` are the phone's
 * own apps, credit/payment/statement are existing routes pre-filled with the
 * contact, and delete goes through the `DeleteContact` command — validated and
 * confirmed like every other write. Nothing here re-implements a mutation.
 *
 * WhatsApp is a link the MERCHANT taps. No API, no automation, no message sent
 * by Vyora.
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Party } from "@/lib/vyora/types";
import { useVyora } from "./VyoraProvider";

/** Held this long before it counts as a long press, not a tap. */
export const LONG_PRESS_MS = 450;

/**
 * Long-press that does not steal ordinary taps.
 *
 * Movement cancels it, so scrolling a contact list never opens a sheet — the
 * failure mode that makes long-press feel broken on phones.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [clear, onLongPress]);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    // Desktop and accessibility: right-click / context menu opens it too.
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      clear();
      onLongPress();
    },
    /** True when the press became a long press, so the row can swallow the click. */
    didFire: () => fired.current,
  };
}

function Action({
  icon,
  label,
  onClick,
  href,
  tone,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "danger";
}) {
  const className = `flex w-full items-center gap-3 px-5 py-3.5 text-left text-base ${
    tone === "danger" ? "font-semibold text-red-700" : "text-gray-800"
  }`;
  const body = (
    <>
      <span className="w-6 text-lg leading-none">{icon}</span>
      {label}
    </>
  );
  return href ? (
    <a href={href} className={className}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function ContactSheet({ party, onClose }: { party: Party | null; onClose: () => void }) {
  const router = useRouter();
  const { dispatch } = useVyora();
  const [confirming, setConfirming] = useState(false);

  if (!party) return null;

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  const remove = () => {
    dispatch({ type: "DeleteContact", contactId: party.id });
    setConfirming(false);
    onClose();
  };

  // Indian numbers, digits only — wa.me rejects spaces and punctuation.
  const waNumber = (party.phone ?? "").replace(/\D/g, "");

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-label={party.name}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative mx-auto w-full max-w-lg rounded-t-3xl bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
        <h2 className="truncate px-5 py-3 text-base font-bold text-gray-900">{party.name}</h2>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {party.phone ? (
            <>
              <Action icon="📞" label="Call" href={`tel:${party.phone}`} />
              <Action icon="💬" label="WhatsApp" href={`https://wa.me/${waNumber}`} />
            </>
          ) : (
            <p className="px-5 py-3 text-sm text-gray-400">No phone number saved</p>
          )}
          <Action
            icon="📒"
            label="Record credit"
            onClick={() => go(`/vyora/credit?contact=${encodeURIComponent(party.name)}`)}
          />
          <Action
            icon="💰"
            label="Record payment"
            onClick={() => go(`/vyora/payment?contact=${encodeURIComponent(party.name)}`)}
          />
          <Action icon="📄" label="Statement" onClick={() => go(`/vyora/parties/${party.id}`)} />
          {!confirming ? (
            <Action
              icon="🗑"
              label="Delete contact"
              tone="danger"
              onClick={() => setConfirming(true)}
            />
          ) : (
            <div className="px-5 py-3">
              <p className="text-sm text-red-800">
                Delete {party.name} and every entry for them? This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
