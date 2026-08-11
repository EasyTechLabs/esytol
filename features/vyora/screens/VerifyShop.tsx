"use client";

/**
 * Vyora — the verification window.
 *
 * ## What this screen is for
 *
 * A code that has been typed or pasted is a **claim** about which shop it
 * names. This is where the claim stops being a claim: the code is resolved, and
 * the person is asked to say yes to what came back.
 *
 * The check symbol in a Vyora code proves it was not mistyped. It proves
 * nothing about *which shop* it belongs to — anyone can compute one — so a
 * well-formed code is not a confirmation, and this screen exists because that
 * difference matters.
 *
 * ## Nothing is created before Continue
 *
 * Reaching this screen performs one read and no writes. No membership, no
 * request to join, no record that a lookup happened, nothing cached. Cancel
 * leaves the app exactly as it was, and the copy says so plainly — someone
 * checking an unfamiliar shop's code has every reason to wonder what they just
 * set in motion.
 *
 * ## Both codes are shown, and compared
 *
 * The code that was entered and the code that came back are rendered together,
 * and a difference between them is refused rather than reconciled. "Confirm
 * this shop" over the wrong shop's details is the single outcome this screen
 * exists to prevent.
 */

import { useCallback, useState } from "react";
import { shopClient } from "@/lib/vyora/shop-client";
import { explainParseFailure, parsePublicId, parseQrPayload } from "@/lib/vyora/identity";
import {
  describeLocality,
  describeMaskedAddress,
  interpretLookup,
  type VerificationOutcome,
} from "@/lib/vyora/shops";

export function VerifyShop({ onConfirm }: { onConfirm?: (shopId: string) => void }) {
  const [typed, setTyped] = useState("");
  const [entered, setEntered] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (raw: string) => {
    // A pasted `vyora:shop/…` payload is accepted as readily as the bare code:
    // that string is what a phone's scanner produces, and someone forwarding it
    // should not have to strip the prefix by hand.
    const parsed = raw.trim().toLowerCase().startsWith("vyora:")
      ? parseQrPayload(raw, "shop")
      : parsePublicId(raw, "shop");

    if (!parsed.ok) {
      // Refused locally, before a request. Offline this is the only check there
      // is, and online it saves a round trip on a typo.
      setProblem(explainParseFailure(parsed.reason, "shop"));
      setOutcome(null);
      setEntered(null);
      return;
    }

    setProblem(null);
    setEntered(parsed.canonical);
    setBusy(true);

    const result = await shopClient.lookupShop(parsed.canonical);
    setBusy(false);

    setOutcome(
      interpretLookup(
        parsed.canonical,
        result.kind === "ok"
          ? { kind: "ok", value: result.value }
          : result.kind === "unreachable"
            ? { kind: "unreachable" }
            : { kind: "refused", status: result.status }
      )
    );
  }, []);

  const reset = useCallback(() => {
    setOutcome(null);
    setEntered(null);
    setProblem(null);
    setTyped("");
  }, []);

  if (outcome?.kind === "confirmed") {
    const shop = outcome.shop;
    return (
      <div className="flex flex-col gap-4">
        <section
          className="flex flex-col gap-3 rounded-2xl border-2 border-blue-500 bg-white p-4"
          data-testid="verify-shop"
        >
          <p className="text-xs uppercase tracking-wide text-gray-500">Is this the right shop?</p>
          <h2 className="text-xl font-bold text-gray-900">{shop.name}</h2>

          <dl className="flex flex-col gap-2">
            <Row label="Shop code" value={shop.shopId} mono />
            <Row label="Area" value={describeLocality(shop)} />
            <Row label="Address" value={describeMaskedAddress(shop)} />
          </dl>

          {/*
            Stated, not implied. `interpretLookup` has already refused a
            mismatch, so reaching this line means the two codes agree — and
            saying so is what lets someone trust the details above without
            re-reading the code themselves.
          */}
          <p
            className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
            data-testid="verify-shop-match"
          >
            The code you entered and the shop above are the same code.
          </p>

          <p className="text-xs text-gray-500">
            Only the start of this shop&rsquo;s address is shown. Vyora has not told this shop
            anything about you, and nothing has been created or joined.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
          <button
            type="button"
            onClick={() => onConfirm?.(shop.shopId)}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            data-testid="verify-shop-confirm"
          >
            Yes, continue with {shop.name}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            data-testid="verify-shop-cancel"
          >
            No, cancel
          </button>
          <p className="text-xs text-gray-400">Cancelling leaves everything exactly as it was.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {problem ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="verify-shop-problem"
        >
          {problem}
        </div>
      ) : null}

      {/* The confirmed case returned above, so anything still here is a failure. */}
      {outcome ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="verify-shop-failed"
        >
          <span>{outcome.message}</span>
          {entered ? (
            <span className="font-mono tabular-nums tracking-widest">{entered}</span>
          ) : null}
          <span className="text-xs">Nothing has been created, joined or sent.</span>
          {/* Retrying is offered only when trying again could change the answer. */}
          {outcome.kind === "unreachable" && entered ? (
            <button
              type="button"
              onClick={() => void check(entered)}
              disabled={busy}
              className="self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
              data-testid="verify-shop-retry"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Check a shop code</h2>
        <p className="text-sm text-gray-600">
          Type the code from the shop&rsquo;s card, or paste what a scanner read. It looks like
          VYR-7K2M-4Q — capitals, spaces and dashes do not matter.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Shop code
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void check(typed)}
            placeholder="VYR-7K2M-4Q"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base uppercase tracking-widest text-gray-900 outline-none focus:border-blue-500"
            data-testid="verify-shop-input"
          />
        </label>
        <button
          type="button"
          onClick={() => void check(typed)}
          disabled={busy || typed.trim() === ""}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
          data-testid="verify-shop-submit"
        >
          {busy ? "Checking this code…" : "Check this code"}
        </button>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={
          mono
            ? "text-base font-semibold tabular-nums tracking-widest text-gray-900"
            : "text-base text-gray-900"
        }
        aria-label={mono ? value.split("").join(" ") : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
