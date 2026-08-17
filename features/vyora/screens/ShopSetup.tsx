"use client";

/**
 * Vyora — sign in, choose or create a shop, and see its card.
 *
 * One screen holding the whole chain, because it is one continuous act: a
 * person arrives without an account and leaves looking at their shop's QR.
 * Splitting it across four routes would put a back button between every step of
 * something nobody wants to do twice.
 *
 * ## It never pretends
 *
 * When this build has no local API — a production build, or a non-loopback URL
 * — there is no email box at all. The alternative was tempting and wrong:
 * accept an address, say "check your email", deliver nothing, and leave someone
 * waiting for a code that does not exist.
 *
 * The same applies after a request succeeds. The API answers identically for a
 * known address, an unknown one and a rate-limited one, so the wording is "if
 * that address has an inbox, a code is on its way" — not "we sent you a code",
 * which this app does not know.
 *
 * ## The token is never here
 *
 * Nothing in this file touches a token. Signing in sets an httpOnly cookie in a
 * route handler; every call below goes to this app's own server, which attaches
 * the credential. There is deliberately no client state holding a session.
 *
 * ## The merchant does not choose the Shop ID
 *
 * There is no field for it. Identifiers are minted server-side against a unique
 * index — a client that could name its own would be inventing a code nothing
 * has agreed to.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { ShopQr } from "../ShopQr";
import { InvitationInbox } from "../InvitationInbox";
import {
  shopClient,
  type IncomingInvitation,
  type Person,
  type RoleSummaries,
  type ShopWithRole,
} from "@/lib/vyora/shop-client";
import {
  EMPTY_DRAFT,
  checkDraft,
  confirmLocality,
  isCompletePincode,
  withSuggestions,
  type ShopDraft,
  type ShopField,
} from "@/lib/vyora/shops";

type Stage =
  | { readonly step: "loading" }
  /** No local API. There is nothing to offer, and the screen says so. */
  | { readonly step: "unavailable"; readonly reason: string }
  | { readonly step: "email" }
  | { readonly step: "code"; readonly email: string }
  | { readonly step: "shops" }
  | { readonly step: "create" }
  | { readonly step: "done"; readonly shop: ShopWithRole };

const UNAVAILABLE =
  "Vyora sign-in runs against a local development API, which this build cannot reach. Your ledger still works — it lives in this browser and needs no account.";

export function ShopSetup() {
  const { enterShop, signOutLocally } = useVyora();
  const [stage, setStage] = useState<Stage>({ step: "loading" });
  const [person, setPerson] = useState<Person | null>(null);
  const [shops, setShops] = useState<readonly ShopWithRole[]>([]);
  const [invitations, setInvitations] = useState<readonly IncomingInvitation[]>([]);
  const [roleSummaries, setRoleSummaries] = useState<RoleSummaries | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState<ShopDraft>(EMPTY_DRAFT);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [fieldProblems, setFieldProblems] = useState<ReadonlyMap<ShopField, string>>(new Map());

  /** Load the shop list and decide whether to show it or the create form. */
  const loadShops = useCallback(async () => {
    const result = await shopClient.listShops();
    if (result.kind !== "ok") {
      setProblem(result.message);
      setStage({ step: "shops" });
      return;
    }
    setShops(result.value.items);

    // Invitations are fetched here because this screen already answers "which
    // shops can I work in", and an offer is a shop you could work in. A failure
    // is silent: someone with no invitations and someone whose invitation list
    // failed both see none, and an error over the shop list would suggest the
    // shops are wrong.
    const offers = await shopClient.listMyInvitations();
    const waiting = offers.kind === "ok" ? offers.value.items : [];
    if (offers.kind === "ok") {
      setInvitations(waiting);
      setRoleSummaries(offers.value.roleSummaries);
    }

    // Someone with no shops but a pending invitation must land on the inbox,
    // not on "create your first shop" — they were invited precisely so they
    // would not have to make one.
    const noShops = result.value.items.length === 0;
    setStage(noShops && waiting.length === 0 ? { step: "create" } : { step: "shops" });
  }, []);

  // One call decides everything about the opening state: signed in or not,
  // reachable or not, with shops or without.
  useEffect(() => {
    void (async () => {
      const me = await shopClient.me();

      if (me.kind === "ok") {
        setPerson(me.value.person);
        await loadShops();
        return;
      }
      // 404 is the gate: this build has no local API path at all.
      if (me.kind === "refused" && me.status === 404) {
        setStage({ step: "unavailable", reason: UNAVAILABLE });
        return;
      }
      // 401 is simply "not signed in", which is where everyone starts.
      setStage({ step: "email" });
    })();
  }, [loadShops]);

  // Suggestions follow the PIN code, and only once it could possibly match —
  // a request per keystroke would be five wasted round trips.
  useEffect(() => {
    if (stage.step !== "create" || !isCompletePincode(draft.pincode)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;

    void (async () => {
      const result = await shopClient.suggestLocalities(draft.pincode.trim());
      // Silent on failure. Suggestions are a convenience, and an error banner
      // over an optional field reads as though the shop could not be created.
      if (cancelled || result.kind !== "ok") return;
      setSuggestions(result.value.localities);
      setDraft((current) => withSuggestions(current, result.value.localities));
    })();

    return () => {
      cancelled = true;
    };
  }, [stage.step, draft.pincode]);

  const onRequestCode = useCallback(async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
      setProblem("That does not look like an email address. Check it and try again.");
      return;
    }

    setBusy(true);
    setProblem(null);
    const result = await shopClient.requestCode(address);
    setBusy(false);

    if (result.kind !== "ok") {
      setProblem(result.message);
      return;
    }
    setStage({ step: "code", email: address });
  }, [email]);

  const onVerify = useCallback(async () => {
    if (stage.step !== "code") return;
    if (!/^[0-9]{6}$/.test(code.trim())) {
      setProblem("The code is six digits.");
      return;
    }

    setBusy(true);
    setProblem(null);
    const result = await shopClient.verifyCode(stage.email, code.trim());
    setBusy(false);

    if (result.kind !== "ok") {
      // One sentence for every rejection. The API does not distinguish wrong
      // from expired from already-used, and inventing the distinction here
      // would present a guess as a fact.
      setProblem(
        "That code did not work. It may have been mistyped, or it may have expired — ask for a new one."
      );
      setCode("");
      return;
    }

    setPerson(result.value.person);
    setCode("");
    await loadShops();
  }, [stage, code, loadShops]);

  const onChoose = useCallback(
    async (shop: ShopWithRole) => {
      // A shop that predates public identifiers cannot be selected: the endpoint
      // resolves membership by `public_id`, and there is nothing to send.
      if (!shop.shopId) {
        setProblem(
          `${shop.name} was created before shop codes existed, so Vyora cannot open it yet.`
        );
        return;
      }

      setBusy(true);
      setProblem(null);

      // The **public** shop code, never the internal merchant id — sending one
      // failed every selection with a 400 until a device session caught it.
      //
      // The server re-checks the membership. A stale list is the normal case,
      // not an exception — which is what makes it safe to render one.
      const confirmed = await shopClient.selectActiveShop(shop.shopId);
      setBusy(false);

      if (confirmed.kind !== "ok") {
        setProblem(confirmed.message);
        return;
      }

      // Only after the server has agreed. Pointing the local book at a shop this
      // person turns out not to be a member of would erase the book they do have
      // for a shop they cannot reach.
      await enterShop(confirmed.value.merchantId);
      setStage({ step: "done", shop });
    },
    [enterShop]
  );

  const onCreate = useCallback(async () => {
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setFieldProblems(new Map(checked.problems.map((p) => [p.field, p.message])));
      setProblem(null);
      return;
    }
    setFieldProblems(new Map());

    setBusy(true);
    setProblem(null);
    const created = await shopClient.createShop(checked.body);

    if (created.kind !== "ok") {
      setBusy(false);
      setProblem(created.message);
      return;
    }

    // Creating a shop makes you its owner, but entering it still goes through
    // `selectActiveShop` — so there is exactly one path by which a client
    // starts working in a shop.
    const chosen = await shopClient.selectActiveShop(created.value.shopId ?? "");

    // And the local half of it, which is what lets this browser sync. Missing
    // here until WEB-SYNC-004: the choose-an-existing-shop path recorded the
    // shop and this one did not, so a merchant creating their *first* shop —
    // the commonest way anyone starts — got a working local ledger that never
    // synced, silently.
    if (chosen.kind === "ok") await enterShop(chosen.value.merchantId);
    setBusy(false);

    if (chosen.kind !== "ok") {
      // The shop exists. Saying otherwise sends the merchant to create a second
      // one with the same name.
      setProblem(
        `${created.value.name} was created, and its code is ${created.value.shopId}. Vyora could not open it just now — choose it from your shops in a moment.`
      );
      await loadShops();
      return;
    }

    setStage({ step: "done", shop: { ...created.value, role: "owner" } });
  }, [draft, loadShops, enterShop]);

  const onSignOut = useCallback(async () => {
    setBusy(true);
    await shopClient.signOut();
    // Whether or not that reached the server. A browser left holding a shop's
    // book after the person signed out is the failure worth preventing, and it
    // is the one that happens on a bad connection.
    await signOutLocally();
    setBusy(false);
    setPerson(null);
    setShops([]);
    setDraft(EMPTY_DRAFT);
    setStage({ step: "email" });
  }, [signOutLocally]);

  if (stage.step === "loading") {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }

  if (stage.step === "unavailable") {
    return (
      <Card title="This browser is working on its own">
        <p className="text-sm text-gray-700" data-testid="shop-setup-unavailable">
          {stage.reason}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {problem ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="shop-setup-problem"
        >
          {problem}
        </div>
      ) : null}

      {stage.step === "email" ? (
        <Card title="Sign in to Vyora">
          <p className="text-sm text-gray-600">
            Enter your email and we will send a six-digit code to it. There is no password to
            remember.
          </p>
          <Labelled label="Email address">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onRequestCode()}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
              className={inputClass}
              data-testid="signin-email-input"
            />
          </Labelled>
          <PrimaryButton
            onClick={() => void onRequestCode()}
            disabled={busy || email.trim() === ""}
            testId="signin-request"
          >
            {busy ? "Sending…" : "Send me a code"}
          </PrimaryButton>
        </Card>
      ) : null}

      {stage.step === "code" ? (
        <Card title="Enter the code">
          {/*
            Not "we sent a code". The API answers identically whether the
            address is known, unknown or rate-limited, so this app genuinely
            does not know that anything was sent.
          */}
          <p className="text-sm text-gray-700">
            If {stage.email} has an inbox, a six-digit code is on its way to it. The code is good
            for a short while.
          </p>
          <Labelled label="Six-digit code">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && void onVerify()}
              placeholder="123456"
              autoComplete="one-time-code"
              disabled={busy}
              className={cn(inputClass, "tabular-nums tracking-[0.35em]")}
              data-testid="signin-code-input"
            />
          </Labelled>
          <PrimaryButton
            onClick={() => void onVerify()}
            disabled={busy || code.trim() === ""}
            testId="signin-verify"
          >
            {busy ? "Checking…" : "Sign in"}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setCode("");
              setProblem(null);
              setStage({ step: "email" });
            }}
            disabled={busy}
            testId="signin-restart"
          >
            Use a different email
          </SecondaryButton>
        </Card>
      ) : null}

      {/*
        Above the shop list, because an offer needs answering and a list of
        shops you already hold does not. Rendered in the "shops" stage so it is
        the first thing after signing in.
      */}
      {stage.step === "shops" ? (
        <InvitationInbox
          invitations={invitations}
          roleSummaries={roleSummaries}
          onChanged={() => void loadShops()}
          onOpenShop={(merchantId) => {
            // Routed through the same selection as tapping a shop in the list.
            // A newly joined shop that took a shortcut would skip the server's
            // membership re-check.
            //
            // `onChanged` has already refreshed the list, so the real record is
            // here. If it somehow is not, the list is reloaded rather than a
            // shop being invented from the pieces the accept response happened
            // to carry — a fabricated role would be rendered as fact.
            const known = shops.find((s2) => s2.merchantId === merchantId);
            if (known) void onChoose(known);
            else void loadShops();
          }}
        />
      ) : null}

      {stage.step === "shops" ? (
        <Card title="Which shop are you working in?">
          <p className="text-sm text-gray-600">
            Everything you record goes into the book of the shop you choose. You can switch later.
          </p>
          <ul className="flex flex-col gap-2" data-testid="shop-list">
            {shops.map((shop) => (
              <li key={shop.merchantId}>
                <button
                  type="button"
                  onClick={() => void onChoose(shop)}
                  disabled={busy}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-500 disabled:opacity-60"
                  data-testid={`shop-choose-${shop.shopId ?? shop.merchantId}`}
                >
                  <span className="block text-base font-semibold text-gray-900">{shop.name}</span>
                  <span className="block text-sm tabular-nums text-gray-500">
                    {shop.shopId ?? "No shop code"}
                    {shop.localityConfirmed ? ` · ${shop.localityConfirmed}` : ""}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {shop.role === "owner" ? "You own this shop" : "You work here"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <SecondaryButton
            onClick={() => setStage({ step: "create" })}
            disabled={busy}
            testId="shop-create-another"
          >
            Create another shop
          </SecondaryButton>
          <SignedInAs person={person} onSignOut={() => void onSignOut()} disabled={busy} />
        </Card>
      ) : null}

      {stage.step === "create" ? (
        <>
          <Card title="Your shop">
            <p className="text-sm text-gray-600">
              This is the name customers will see on the statements you give them.
            </p>
            <Labelled label="Shop name" problem={fieldProblems.get("name")}>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Sharma General Store"
                disabled={busy}
                className={inputClass}
                data-testid="create-shop-name"
              />
            </Labelled>
          </Card>

          <Card title="Where the shop is">
            <p className="text-sm text-gray-600">
              Only the first few characters of the address are ever shown to someone checking your
              shop code. The full address stays in your own book.
            </p>
            <Labelled label="Street address" problem={fieldProblems.get("addressLine")}>
              <input
                value={draft.addressLine}
                onChange={(e) => setDraft((d) => ({ ...d, addressLine: e.target.value }))}
                placeholder="14 Nehru Road, Rampur"
                disabled={busy}
                className={inputClass}
                data-testid="create-shop-address"
              />
            </Labelled>
            <Labelled label="PIN code (optional)" problem={fieldProblems.get("pincode")}>
              <input
                inputMode="numeric"
                maxLength={6}
                value={draft.pincode}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pincode: e.target.value.replace(/[^0-9]/g, "") }))
                }
                placeholder="560001"
                disabled={busy}
                className={cn(inputClass, "tabular-nums")}
                data-testid="create-shop-pincode"
              />
            </Labelled>
          </Card>

          <Card title="Which area">
            <p className="text-sm text-gray-600">
              {suggestions.length > 0
                ? "A PIN code covers several areas, so pick the one your shop is actually in — or type it yourself."
                : "Type the area your shop is in. Customers recognise this more easily than a PIN code."}
            </p>

            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2" data-testid="locality-suggestions">
                {suggestions.map((locality) => {
                  const chosen = draft.localityConfirmed.trim() === locality;
                  return (
                    <button
                      key={locality}
                      type="button"
                      onClick={() => setDraft((d) => confirmLocality(d, locality))}
                      disabled={busy}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        chosen
                          ? "border-blue-500 bg-blue-50 font-semibold text-blue-700"
                          : "border-gray-200 bg-white text-gray-700"
                      )}
                      data-testid={`locality-${locality}`}
                    >
                      {locality}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <Labelled label="Area" problem={fieldProblems.get("localityConfirmed")}>
              <input
                value={draft.localityConfirmed}
                onChange={(e) => setDraft((d) => ({ ...d, localityConfirmed: e.target.value }))}
                placeholder="Connaught Place"
                disabled={busy}
                className={inputClass}
                data-testid="create-shop-locality"
              />
            </Labelled>
          </Card>

          <Card title="Create it">
            <p className="text-sm text-gray-600">
              Vyora will give your shop its own code and QR when you create it. You cannot choose
              the code, and it never changes.
            </p>
            <PrimaryButton
              onClick={() => void onCreate()}
              disabled={busy}
              testId="create-shop-submit"
            >
              {busy ? "Creating your shop…" : "Create my shop"}
            </PrimaryButton>
            {shops.length > 0 ? (
              <SecondaryButton
                onClick={() => setStage({ step: "shops" })}
                disabled={busy}
                testId="create-shop-back"
              >
                Back to my shops
              </SecondaryButton>
            ) : null}
            <SignedInAs person={person} onSignOut={() => void onSignOut()} disabled={busy} />
          </Card>
        </>
      ) : null}

      {stage.step === "done" ? (
        <Card title={stage.shop.name}>
          {stage.shop.localityConfirmed ? (
            <p className="text-sm text-gray-500">{stage.shop.localityConfirmed}</p>
          ) : null}

          {stage.shop.shopId ? (
            <div className="py-2">
              <ShopQr
                shopId={stage.shop.shopId}
                caption="Anyone can scan this or type the code. It shows them your shop's name and area — nothing else."
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              This shop was created before shop codes existed, so it does not have one yet.
            </p>
          )}

          <SecondaryButton
            onClick={() => {
              setProblem(null);
              void loadShops();
            }}
            disabled={busy}
            testId="shop-switch"
          >
            Switch shop
          </SecondaryButton>
          <SignedInAs person={person} onSignOut={() => void onSignOut()} disabled={busy} />
        </Card>
      ) : null}
    </div>
  );
}

// ── Local atoms ──────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-50";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Labelled({
  label,
  problem,
  children,
}: {
  label: string;
  problem?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {problem ? <span className="text-xs text-red-600">{problem}</span> : null}
    </label>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  testId,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-55"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  testId,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 disabled:opacity-55"
    >
      {children}
    </button>
  );
}

function SignedInAs({
  person,
  onSignOut,
  disabled,
}: {
  person: Person | null;
  onSignOut: () => void;
  disabled?: boolean;
}) {
  if (!person?.email) return null;
  return (
    <p className="text-xs text-gray-400">
      Signed in as {person.email}.{" "}
      <button
        type="button"
        onClick={onSignOut}
        disabled={disabled}
        className="underline underline-offset-2 disabled:opacity-55"
        data-testid="sign-out"
      >
        Sign out
      </button>
    </p>
  );
}
