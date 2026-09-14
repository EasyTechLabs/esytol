import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Udharpe — a trusted ledger for customers and merchants",
  description:
    "Udharpe records credit and repayments that both the shop and the customer have agreed to. It does not move money. Android alpha.",
  path: "/udharpe",
});

/**
 * The Udharpe product page.
 *
 * Written to answer three questions in the order a shopkeeper asks them: what
 * is it, what does it not do, and how do I get it. The second question is not
 * defensive throat-clearing — "is this a payment app" is the first thing anyone
 * assumes about a ledger with money in it, and leaving it unanswered until the
 * FAQ means most readers never see the answer.
 */
export default function UdharpePage() {
  return (
    <main className="container-page">
      <section className="section-gap">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Esytol product · Alpha
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Udharpe</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          A trusted digital ledger for customers and merchants. Every entry is agreed by both sides
          before it counts, so the book reads the same on both phones and nobody is arguing from
          memory at the counter.
        </p>
      </section>

      <section className="section-gap border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Someone proposes",
              body: "The shop or the customer records what happened — goods taken on credit, or a repayment.",
            },
            {
              title: "The other side reviews",
              body: "They see the amount and what it is for. Nothing is in the book yet.",
            },
            {
              title: "Both agree",
              body: "Only agreement writes the entry. Disagree, and it becomes a dispute rather than a number somebody won.",
            },
            {
              title: "The book updates",
              body: "On both phones, identically. An agreed entry is never quietly edited afterwards.",
            },
          ].map((step, i) => (
            <li key={step.title} className="rounded-lg border border-gray-200 p-5">
              <span className="text-sm font-semibold text-gray-400">{i + 1}</span>
              <h3 className="mt-1 font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-gap border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">What Udharpe is not</h2>
        <p className="mt-4 max-w-2xl text-gray-600">
          Udharpe is <strong>not</strong> a bank, a wallet, a payment gateway or a UPI app. It holds
          no money and moves none. When a customer pays, they pay the way they already do — cash,
          UPI, bank transfer — and Udharpe records that it happened and what it settled.
        </p>
        <p className="mt-3 max-w-2xl text-gray-600">
          A repayment goes against what is outstanding overall, not against one purchase, which is
          how credit actually works in a shop. The split is worked out, shown to both sides, and
          written down.
        </p>
      </section>

      <section id="android" className="section-gap border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Get the app</h2>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900">Android</h3>
            <p className="mt-1 text-sm text-gray-600">
              Alpha build, by invitation. Ask for the current APK and its checksum.
            </p>
            <Link
              href="/contact"
              className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Request access
            </Link>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 p-5">
            <h3 className="font-semibold text-gray-500">iOS</h3>
            <p className="mt-1 text-sm text-gray-500">Coming soon.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
