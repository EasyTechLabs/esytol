"use client";

/**
 * Vyora — Invitations for you.
 *
 * Rendered on the shop chooser, because that already answers "which shops can I
 * work in" and a pending invitation is a shop you could work in. A separate
 * page would put the offer somewhere a person has to know to look for.
 *
 * ## Accepting does not move you
 *
 * After accepting, this offers **Open this shop** rather than switching. Someone
 * may be mid-shift in another shop when they accept; silently changing which
 * book is open is how an entry lands in the wrong one.
 *
 * ## What it shows
 *
 * Shop name, Shop ID, confirmed locality, the role offered, and how long is
 * left. Nothing else — the recipient is a stranger to that shop until they
 * accept.
 */

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import {
  EXPIRED_EXPLANATION,
  UNREACHABLE,
  canAccept,
  explainRefusal,
  presentAll,
  type PresentedInvitation,
} from "@/lib/vyora/invitations";
import {
  shopClient,
  type IncomingInvitation,
  type MembershipRole,
  type RoleSummaries,
} from "@/lib/vyora/shop-client";

const ROLE_LABEL: Readonly<Record<MembershipRole, string>> = {
  owner: "Owner",
  staff: "Staff",
  viewer: "Viewer",
};

interface Joined {
  readonly merchantId: string;
  readonly shopId: string | null;
  readonly name: string;
  readonly role: MembershipRole;
}

export function InvitationInbox({
  invitations,
  roleSummaries,
  onChanged,
  onOpenShop,
}: {
  invitations: readonly IncomingInvitation[];
  roleSummaries: RoleSummaries | null;
  onChanged: () => void;
  onOpenShop: (merchantId: string, shopId: string | null, name: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);

  const accept = useCallback(
    async (invitation: PresentedInvitation) => {
      if (!canAccept(invitation)) {
        setProblem(EXPIRED_EXPLANATION);
        return;
      }
      // Guarded rather than merely disabled: a double click on a slow
      // connection fires twice before the first response lands. The API is
      // idempotent and would answer the same either way, but sending the second
      // request at all is avoidable.
      if (busy) return;

      setBusy(invitation.invitationId);
      setProblem(null);

      const res = await shopClient.acceptInvitation(invitation.invitationId);
      setBusy(null);

      if (res.kind !== "ok") {
        setProblem(res.kind === "unreachable" ? UNREACHABLE : explainRefusal(res.message));
        onChanged();
        return;
      }

      setJoined({
        merchantId: res.value.merchantId,
        shopId: res.value.shopId,
        name: res.value.name,
        role: res.value.role,
      });
      onChanged();
    },
    [busy, onChanged]
  );

  const decline = useCallback(
    async (invitation: PresentedInvitation) => {
      if (busy) return;
      setBusy(invitation.invitationId);
      setProblem(null);

      const res = await shopClient.declineInvitation(invitation.invitationId);
      setBusy(null);

      if (res.kind !== "ok") {
        setProblem(res.kind === "unreachable" ? UNREACHABLE : explainRefusal(res.message));
      }
      onChanged();
    },
    [busy, onChanged]
  );

  const presented = presentAll(invitations);
  if (presented.length === 0 && !joined) return null;

  return (
    <>
      {joined ? (
        <section
          className="flex flex-col gap-3 rounded-2xl border-2 border-blue-500 bg-white p-4"
          data-testid="invitation-joined"
        >
          <h2 className="text-base font-semibold text-gray-900">You are now in {joined.name}</h2>
          <p className="text-sm text-gray-600">
            You joined as {ROLE_LABEL[joined.role]}.
            {joined.shopId ? ` Shop code ${joined.shopId}.` : ""}
          </p>
          {/*
            Offered, not done. Switching without being asked is how an entry
            lands in the wrong book.
          */}
          <p className="text-sm text-gray-600">
            You are still working in whichever shop you had open. Open this one when you are ready.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenShop(joined.merchantId, joined.shopId, joined.name)}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              data-testid="invitation-open-shop"
            >
              Open {joined.name}
            </button>
            <button
              type="button"
              onClick={() => setJoined(null)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
              data-testid="invitation-dismiss"
            >
              Not now
            </button>
          </div>
        </section>
      ) : null}

      {presented.length > 0 ? (
        <section
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          data-testid="invitation-inbox"
        >
          <h2 className="text-base font-semibold text-gray-900">Invitations for you</h2>
          <p className="text-sm text-gray-600">
            A shop has asked you to work with them. Nothing happens until you accept.
          </p>

          {problem ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              data-testid="invitation-problem"
            >
              {problem}
            </p>
          ) : null}

          <ul className="flex flex-col gap-4">
            {presented.map((invitation) => {
              const open = canAccept(invitation);
              const working = busy === invitation.invitationId;

              return (
                <li
                  key={invitation.invitationId}
                  className={cn(
                    "flex flex-col gap-1 border-t border-gray-100 pt-4",
                    !open && "opacity-70"
                  )}
                  data-testid={`invitation-${invitation.invitationId}`}
                >
                  <p className="text-base font-semibold text-gray-900">{invitation.shopName}</p>
                  <p className="text-sm tabular-nums text-gray-500">
                    {invitation.shopId ?? "No shop code"}
                    {invitation.locality ? ` · ${invitation.locality}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-blue-700">
                    Invited as {ROLE_LABEL[invitation.role]}
                  </p>
                  {roleSummaries ? (
                    <p className="text-xs text-gray-500">{roleSummaries[invitation.role]}</p>
                  ) : null}
                  <p
                    className={cn("text-xs", open ? "text-gray-500" : "font-semibold text-red-600")}
                  >
                    {invitation.expiry}
                  </p>

                  {open ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void accept(invitation)}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                        data-testid={`accept-${invitation.invitationId}`}
                      >
                        {working ? "Joining…" : `Accept and join ${invitation.shopName}`}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void decline(invitation)}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 disabled:opacity-55"
                        data-testid={`decline-${invitation.invitationId}`}
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-xs text-gray-500">{EXPIRED_EXPLANATION}</p>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void decline(invitation)}
                        className="self-start rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-55"
                        data-testid={`decline-${invitation.invitationId}`}
                      >
                        Remove from this list
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
