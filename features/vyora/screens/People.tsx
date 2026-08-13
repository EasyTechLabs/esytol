"use client";

/**
 * Vyora — People in this shop.
 *
 * ## Two screens in one file, on purpose
 *
 * An owner sees a roster they can change. Staff and viewers see one card
 * explaining what their own role means, and nothing else — no disabled buttons,
 * no "you do not have permission" rows, no empty admin panel.
 *
 * A control that is visible but refuses is worse than an absent one. The person
 * clicks it, is told no, decides the app is broken, and asks the owner to fix
 * something that is working exactly as intended.
 *
 * The server refuses either way; this file only decides what to render. A `403`
 * from the member list is not an error to apologise for — it is how the page
 * learns which of the two views to show.
 *
 * ## The last-owner rule is explained before it is hit
 *
 * A database trigger guarantees a shop always keeps one active owner, holding
 * the shop's row while it counts so two owners demoting each other at the same
 * instant cannot both succeed. That is the control. What this page adds is the
 * sentence *before* the click, so an owner is not left interpreting a 400.
 *
 * ## It needs the API, and says so
 *
 * The ledger works with no connection; that premise is untouched. Membership
 * does not — an invitation has to reach somebody who is not at this screen, and
 * a role change has to be true for everyone at once. With no API this page says
 * the list cannot be loaded rather than showing a stale roster.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { explainRefusal } from "@/lib/vyora/invitations";
import {
  shopClient,
  type MembershipRole,
  type RoleSummaries,
  type ShopInvitation,
  type ShopMember,
} from "@/lib/vyora/shop-client";

const ROLES: readonly MembershipRole[] = ["owner", "staff", "viewer"];

const ROLE_LABEL: Readonly<Record<MembershipRole, string>> = {
  owner: "Owner",
  staff: "Staff",
  viewer: "Viewer",
};

const UNREACHABLE =
  "Vyora needs a connection to show who works here. Your book still works — this list does not.";

const LAST_OWNER =
  "This shop must always have at least one owner. Make someone else an owner first, then you can change this one.";

/** A count, not a permission check — see the file comment. */
function isLastActiveOwner(members: readonly ShopMember[], personId: string): boolean {
  const target = members.find((m) => m.personId === personId);
  if (!target || target.role !== "owner" || target.status !== "active") return false;
  return members.filter((m) => m.role === "owner" && m.status === "active").length === 1;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One box for an email or a Person ID.
 *
 * An owner has "their email" or "the id they sent me"; asking them to classify
 * which first is a question about the data model, not about their shop.
 */
function readTarget(input: string): { email?: string; personId?: string } | null {
  const value = input.trim();
  if (!value) return null;
  if (UUID.test(value)) return { personId: value.toLowerCase() };
  if (EMAIL.test(value) && value.length <= 254) return { email: value.toLowerCase() };
  return null;
}

/** What somebody who cannot administer people is told, when the API said nothing. */
const NOT_AN_OWNER =
  "Only an owner can see and change who works in this shop. If something needs to change, ask an owner.";

/** And what to say when the page could not find out who works here at all. */
const LIST_UNAVAILABLE = "Vyora could not load who works in this shop just now.";

type View =
  | { readonly kind: "loading" }
  | { readonly kind: "owner" }
  /** Staff, viewer, or not a member — one explanation, no controls. */
  | {
      readonly kind: "restricted";
      readonly role: MembershipRole | null;
      readonly reason: string;
    };

export function People() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [members, setMembers] = useState<readonly ShopMember[]>([]);
  const [invitations, setInvitations] = useState<readonly ShopInvitation[]>([]);
  const [summaries, setSummaries] = useState<RoleSummaries | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("staff");

  const load = useCallback(async () => {
    const people = await shopClient.listShopMembers();

    if (people.kind !== "ok") {
      if (people.kind === "refused" && people.status === 403) {
        // Staff or viewer. Not an error — a different page.
        //
        // The API's own sentence is used when it sent one, because it is
        // written for a merchant and names the role's limit rather than the
        // status code that carried it. `explainRefusal` is the guard: anything
        // technical is replaced rather than shown.
        setView({
          kind: "restricted",
          role: null,
          reason: explainRefusal(people.message, NOT_AN_OWNER),
        });
        return;
      }
      // Not a refusal — the list could not be fetched at all. The banner says
      // what went wrong; the card below it must not claim the person is not an
      // owner, because nothing here establishes that either way.
      setProblem(people.kind === "unreachable" ? UNREACHABLE : people.message);
      setView({ kind: "restricted", role: null, reason: LIST_UNAVAILABLE });
      return;
    }

    setMembers(people.value.items);
    setSummaries(people.value.roleSummaries);
    setView({ kind: "owner" });

    const invites = await shopClient.listShopInvitations();
    if (invites.kind === "ok") setInvitations(invites.value.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = useCallback(async () => {
    const target = readTarget(invitee);
    if (!target) {
      setProblem("Enter the person's email address, or the Person ID they gave you.");
      return;
    }

    setBusy(true);
    setProblem(null);
    setNote(null);
    const res = await shopClient.createShopInvitation({ ...target, role: inviteRole });
    setBusy(false);

    if (res.kind !== "ok") {
      setProblem(res.kind === "unreachable" ? UNREACHABLE : res.message);
      return;
    }

    // Not "we have emailed them". The server answers identically whether or not
    // that address has an account, so this app does not know anybody was
    // reached and must not claim it.
    setNote(res.value.message);
    setInvitee("");
    void load();
  }, [invitee, inviteRole, load]);

  const change = useCallback(
    async (
      member: ShopMember,
      patch: { role?: MembershipRole; status?: "active" | "inactive" }
    ) => {
      const losingOwnership = patch.role !== undefined && patch.role !== "owner";
      const leaving = patch.status === "inactive";
      if ((losingOwnership || leaving) && isLastActiveOwner(members, member.personId)) {
        setProblem(LAST_OWNER);
        return;
      }

      setBusy(true);
      setProblem(null);
      const res = await shopClient.updateShopMembership(member.personId, patch);
      setBusy(false);

      if (res.kind !== "ok") {
        setProblem(res.kind === "unreachable" ? UNREACHABLE : res.message);
        return;
      }
      void load();
    },
    [members, load]
  );

  const withdraw = useCallback(
    async (invitation: ShopInvitation) => {
      setBusy(true);
      const res = await shopClient.cancelShopInvitation(invitation.invitationId);
      setBusy(false);
      if (res.kind !== "ok") {
        setProblem(res.kind === "unreachable" ? UNREACHABLE : res.message);
        return;
      }
      void load();
    },
    [load]
  );

  if (view.kind === "loading") {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }

  if (view.kind === "restricted") {
    return (
      <div className="flex flex-col gap-4">
        {problem ? <Alert>{problem}</Alert> : null}
        <Card title="Who works here">
          <p className="text-sm text-gray-700" data-testid="people-restricted">
            {view.reason}
          </p>
        </Card>
      </div>
    );
  }

  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-4">
      {problem ? <Alert>{problem}</Alert> : null}
      {note ? (
        <p
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          data-testid="people-note"
        >
          {note}
        </p>
      ) : null}

      <Card title="People in this shop">
        <p className="text-sm text-gray-600">
          Everyone here has their own account. Nobody shares a password, and every entry records who
          wrote it.
        </p>
      </Card>

      <ul className="flex flex-col gap-3" data-testid="member-list">
        {members.map((member) => {
          const last = isLastActiveOwner(members, member.personId);
          const active = member.status === "active";

          return (
            <li
              key={member.personId}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              data-testid={`member-${member.personId}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {member.displayName ?? member.emailMasked ?? "Someone"}
                  </p>
                  {member.emailMasked ? (
                    <p className="text-sm text-gray-500">{member.emailMasked}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    active ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                  )}
                >
                  {active ? ROLE_LABEL[member.role] : "No longer here"}
                </span>
              </div>

              {active ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((role) => {
                      const chosen = member.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={busy || chosen}
                          onClick={() => void change(member, { role })}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-default",
                            chosen
                              ? "border-blue-500 bg-blue-50 font-semibold text-blue-700"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                          )}
                          data-testid={`role-${member.personId}-${role}`}
                        >
                          {ROLE_LABEL[role]}
                        </button>
                      );
                    })}
                  </div>

                  {summaries ? (
                    <p className="text-xs text-gray-500">{summaries[member.role]}</p>
                  ) : null}

                  {last ? (
                    <p className="text-xs text-gray-500" data-testid="last-owner-note">
                      {LAST_OWNER}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void change(member, { status: "inactive" })}
                      className="self-start rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-55"
                      data-testid={`remove-${member.personId}`}
                    >
                      Remove from this shop
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void change(member, { status: "active" })}
                  className="self-start rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-55"
                  data-testid={`restore-${member.personId}`}
                >
                  Bring them back
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pending.length > 0 ? (
        <Card title="Waiting to be accepted">
          <ul className="flex flex-col gap-2" data-testid="pending-invitations">
            {pending.map((invitation) => (
              <li key={invitation.invitationId} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {invitation.invitedEmailMasked ?? "By Person ID"}
                  </p>
                  <p className="text-xs text-gray-500">Invited as {ROLE_LABEL[invitation.role]}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void withdraw(invitation)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 disabled:opacity-55"
                  data-testid={`cancel-${invitation.invitationId}`}
                >
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Add somebody">
        <p className="text-sm text-gray-600">
          They need their own Vyora account. Vyora will not create one for them — they sign in
          themselves and accept.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Email or Person ID
          </span>
          <input
            value={invitee}
            onChange={(e) => setInvitee(e.target.value)}
            placeholder="son@example.com"
            disabled={busy}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-50"
            data-testid="invite-target"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const chosen = inviteRole === role;
            return (
              <button
                key={role}
                type="button"
                disabled={busy}
                onClick={() => setInviteRole(role)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  chosen
                    ? "border-blue-500 bg-blue-50 font-semibold text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                )}
                data-testid={`invite-role-${role}`}
              >
                {ROLE_LABEL[role]}
              </button>
            );
          })}
        </div>

        {summaries ? <p className="text-xs text-gray-500">{summaries[inviteRole]}</p> : null}

        <button
          type="button"
          disabled={busy || invitee.trim() === ""}
          onClick={() => void invite()}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
          data-testid="invite-submit"
        >
          {busy ? "Sending…" : "Send invitation"}
        </button>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      data-testid="people-problem"
    >
      {children}
    </div>
  );
}
