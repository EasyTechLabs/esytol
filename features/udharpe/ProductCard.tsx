import Link from "next/link";
import { UdharpeMark } from "./UdharpeMark";
import { UDHARPE_HOME } from "./links";

/**
 * The UDHARPE card, at the top of the product section.
 *
 * Everything else on Esytol is a calculator that runs in the browser and keeps
 * nothing. Udharpe is a product with accounts, so the card has to say what it
 * is in one line without sounding like the finance apps it is not.
 *
 * ## It is drawn in Udharpe's own language, not Esytol's
 *
 * Esytol's `brand` scale is blue and its cards are grey-on-white. This one is
 * warm paper, deep green and brass, because a visitor scrolling the home page
 * should be able to tell that Udharpe is a *product* and not another entry in
 * the tool list. Using the same greys would have made it a renamed Vyora card,
 * which is precisely what it must not look like.
 *
 * ## The wording is a product constraint, not copywriting
 *
 * Udharpe is not a bank, a wallet, a payment gateway or a UPI processor, and a
 * card that implies otherwise would be the first thing a regulator or a
 * confused shopkeeper read. So: it **records** what two people agreed. The
 * money moves somewhere else, between them, without us — and the card says so
 * in the body rather than burying it on a page nobody opens.
 */
export function UdharpeProductCard() {
  return (
    <section
      aria-labelledby="udharpe-heading"
      data-testid="udharpe-product-card"
      className="overflow-hidden rounded-xl border border-udharpe-rule bg-udharpe-paper shadow-sm"
    >
      {/* A brass hairline along the top edge. The one flourish on the card, and
          it earns its place: brass is the product's "somebody is waiting on
          somebody" colour, and this is the only surface on Esytol that carries
          it. */}
      <div className="h-1 bg-udharpe-brass" />

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <UdharpeMark size={40} onGreen />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-udharpe-primary">
                  Esytol product
                </p>
                <h2
                  id="udharpe-heading"
                  className="mt-0.5 text-2xl font-bold tracking-[0.06em] text-udharpe-ink"
                >
                  UDHARPE
                </h2>
              </div>
            </div>

            <p className="mt-4 max-w-xl text-udharpe-body">
              A trusted digital ledger for customers and shops. Both sides agree an entry before it
              is recorded, so the book says the same thing on both phones.
            </p>
            <p className="mt-2 max-w-xl text-sm text-udharpe-dim">
              Udharpe records what was agreed. It does not move money — that happens between you, in
              cash or however you already pay.
            </p>
          </div>

          <span className="rounded-lg bg-udharpe-brassSoft px-3 py-1 text-xs font-medium text-udharpe-brass">
            Alpha
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={UDHARPE_HOME}
            data-testid="udharpe-explore"
            className="rounded-lg bg-udharpe-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-udharpe-pressed"
          >
            Explore UDHARPE
          </Link>

          <Link
            href={`${UDHARPE_HOME}#android`}
            data-testid="udharpe-android"
            className="rounded-lg border border-udharpe-primary px-4 py-2 text-sm font-medium text-udharpe-primary transition-colors hover:bg-udharpe-soft"
          >
            Android — Download App
          </Link>

          {/* Not a link, because there is nothing to link to. A disabled-looking
              button that navigates nowhere is worse than plain text. */}
          <span data-testid="udharpe-ios" className="px-4 py-2 text-sm text-udharpe-dim">
            iOS — Coming Soon
          </span>
        </div>
      </div>
    </section>
  );
}
