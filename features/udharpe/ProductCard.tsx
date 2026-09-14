import Link from "next/link";

/**
 * The Udharpe card, at the top of the product section.
 *
 * Everything else on Esytol is a calculator that runs in the browser and keeps
 * nothing. Udharpe is a product with accounts, so the card has to say what it
 * is in one line without sounding like the finance apps it is not.
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
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Esytol product
          </p>
          <h2 id="udharpe-heading" className="mt-1 text-2xl font-bold text-gray-900">
            Udharpe
          </h2>
          <p className="mt-2 max-w-xl text-gray-600">
            A trusted digital ledger for customers and merchants. Both sides agree an entry before
            it is recorded, so the book says the same thing on both phones.
          </p>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Udharpe records what was agreed. It does not move money — that happens between you, in
            cash or however you already pay.
          </p>
        </div>

        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          Alpha
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/udharpe"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Explore Udharpe
        </Link>

        <Link
          href="/udharpe#android"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Download for Android
        </Link>

        {/* Not a link, because there is nothing to link to. A disabled-looking
            button that navigates nowhere is worse than plain text. */}
        <span className="rounded-lg px-4 py-2 text-sm text-gray-500">iOS — coming soon</span>
      </div>
    </section>
  );
}
