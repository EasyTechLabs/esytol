import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { UDHARPE_TERMS_VERSION } from "@/features/udharpe/legal";

export const metadata: Metadata = buildMetadata({
  title: "Udharpe pilot terms",
  description:
    "The terms for shopkeepers and customers taking part in the invite-only Udharpe pilot: what Udharpe is, what it is not, and each side's responsibilities.",
  path: "/udharpe/terms",
});

/**
 * Terms for the invite-only Udharpe pilot. Plain statements of how the service
 * works and who is responsible for what. Pending independent legal review; the
 * open points are listed in the release report rather than guessed at here.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-600">{children}</div>
    </section>
  );
}

export default function UdharpeTermsPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Udharpe pilot terms</h1>
        <p className="mt-4 text-sm text-gray-400">
          Version {UDHARPE_TERMS_VERSION} · Invite-only pilot
        </p>

        <p className="mt-6 text-gray-600">
          These terms apply to shopkeepers and customers taking part in the Udharpe pilot, an Esytol
          service. By signing in to Udharpe you agree to them and to the{" "}
          <Link href="/udharpe/privacy" className="text-brand-600 hover:underline">
            Udharpe privacy notice
          </Link>
          .
        </p>

        <Section title="What Udharpe is">
          <p>
            Udharpe is a record-keeping service. It keeps a shared ledger of credit given by a shop
            and repayments made by its customers, so that both sides see the same agreed record.
          </p>
          <p>
            Udharpe is <strong>not</strong> a bank, a wallet, a lender, a payment gateway or a
            money-transfer service. It holds no money, moves no money, gives no credit and collects
            no debts. Payments are made between the shop and the customer by whatever means they
            already use; Udharpe records that a payment happened.
          </p>
        </Section>

        <Section title="The pilot">
          <p>
            The pilot is by invitation. Features may change, be limited or be withdrawn while it
            runs, and the service may occasionally be unavailable. Keep your own record of anything
            you cannot afford to lose access to.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            Use your own email address and keep access to it: sign-in codes are sent there. Do not
            share sign-in codes. Remove a phone from your account if it is lost. You are responsible
            for what is done with your account.
          </p>
        </Section>

        <Section title="Shopkeepers">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Opening a shop requires an application, including two photographs taken in the app at
              the time of applying: one of you and one of the shop. Applications are reviewed by
              Udharpe administrators and may be approved, refused, or suspended.
            </li>
            <li>
              Record customers and entries truthfully. Record a customer&apos;s details only for
              keeping your account with them.
            </li>
            <li>
              You decide who is a member of your shop and with what role, and you are responsible
              for what your members record.
            </li>
          </ul>
        </Section>

        <Section title="Customers">
          <p>
            Check what a shop asks you to agree to before you agree. An entry you agree to becomes
            part of both your record and the shop&apos;s. If you disagree, decline it or raise a
            dispute in the app.
          </p>
        </Section>

        <Section title="Agreed records, corrections and disputes">
          <p>
            An entry counts only when the required side has agreed to it. Agreed entries are never
            edited afterwards; a mistake is corrected with a new, linked entry. Udharpe keeps the
            record and the dispute; it does not decide who is right. Any debt, and any dispute about
            it, is between the shop and the customer.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Do not use Udharpe to record anything false, to harass anyone, for any unlawful purpose,
            or to try to access another person&apos;s records. We may suspend or close an account or
            a shop that does, and keep the records that show what happened.
          </p>
        </Section>

        <Section title="Responsibility">
          <p>
            Udharpe is provided during the pilot as it is. We work to keep it accurate, secure and
            available, but we cannot promise that it will always be so. To the extent the law
            allows, Esytol is not responsible for losses arising from how shops and customers deal
            with each other, or from relying on Udharpe in place of your own records.
          </p>
        </Section>

        <Section title="Ending">
          <p>
            You may stop using Udharpe at any time, and ask us to close your account (see the
            privacy notice for what can be deleted). We may end the pilot, and will give notice in
            the app where we can.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            We may update these terms; the version above will change and material changes will be
            shown in the app. Questions:{" "}
            <a href="mailto:hello@esytol.com" className="text-brand-600 hover:underline">
              hello@esytol.com
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
