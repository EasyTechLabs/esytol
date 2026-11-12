import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { UDHARPE_NOTICE_VERSION } from "@/features/udharpe/legal";

export const metadata: Metadata = buildMetadata({
  title: "Udharpe privacy notice",
  description:
    "What Udharpe collects to keep a shared credit ledger between shops and customers, why, who can see it, how long it is kept, and how to ask about it.",
  path: "/udharpe/privacy",
});

/**
 * The Udharpe privacy notice.
 *
 * Every statement here describes what the service actually does today. Where
 * something is a target rather than enforced (database backup expiry), it says
 * so. Nothing here names a legal entity, officer or approval that has not been
 * confirmed; those are listed for review in the release report, not invented.
 *
 * The phone app links here from sign-in, the shop application and its
 * settings, so the URL is part of the app's contract: do not move it.
 */

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-24">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-600">{children}</div>
    </section>
  );
}

export default function UdharpePrivacyPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Udharpe privacy notice</h1>
        <p className="mt-4 text-sm text-gray-400">
          Version {UDHARPE_NOTICE_VERSION} · Invite-only pilot
        </p>

        <p className="mt-6 text-gray-600">
          Udharpe is an Esytol service that keeps a shared record of credit and repayments between a
          shop and its customers. It is <strong>not</strong> a bank, a wallet, a payment gateway or
          a money-transfer service: it holds no money and moves none. To keep that record, Udharpe
          stores personal information. This notice explains what, why, who can see it, how long it
          is kept, and how to ask about it.
        </p>

        <Section title="What we collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Your account.</strong> Your email address (used to send sign-in codes), the
              name you give, and a phone number if you add one. Sign-in codes are stored only as
              one-way hashes and expire within minutes.
            </li>
            <li>
              <strong>Your phones.</strong> An identifier for each phone you sign in on, a label,
              and when it was last used, so you can see and remove your devices.
            </li>
            <li>
              <strong>Shops.</strong> A shop&apos;s name, its address line, PIN code and locality,
              its public shop code, and who is a member of it (owner, staff or viewer).
            </li>
            <li>
              <strong>Customers and contacts.</strong> A shop may record its customers&apos; names,
              phone numbers and notes. When a customer has their own Udharpe account and connects to
              a shop, we record that relationship.
            </li>
            <li>
              <strong>The ledger.</strong> Credits, repayments, amounts, dates, due dates,
              descriptions, item lists, requests and their approvals, corrections and disputes, and
              who recorded or agreed each one.
            </li>
            <li>
              <strong>Shopkeeper applications.</strong> To open a shop, the applicant provides the
              shop&apos;s name and locality and takes two photographs in the app: one of themselves
              and one of the shop (see{" "}
              <a href="#photographs" className="text-brand-600 hover:underline">
                Photographs
              </a>
              ).
            </li>
            <li>
              <strong>Security records.</strong> An audit trail of significant actions (for example
              approvals, disputes, and every time an administrator views an application&apos;s
              photographs), and technical request data such as IP address, used to limit abuse of
              sign-in and to keep the service secure.
            </li>
          </ul>
          <p>
            Customers are not asked for photographs. Udharpe does not collect payment card, bank
            account or UPI credentials.
          </p>
        </Section>

        <Section id="photographs" title="Photographs">
          <p>
            A shopkeeper applying to open a shop takes, in the app and at that moment, one
            photograph of themselves and one of the shop. The app asks for a simple action at that
            moment (for example, turning your head or raising your eyebrows) so that a photograph of
            a photograph is less likely to pass. The photographs are used only so that a Udharpe
            administrator can check that a real person is applying for a real shop.
          </p>
          <p>
            Udharpe does <strong>not</strong> perform facial recognition, does not compare your face
            with any other photograph or database, and does not create a biometric template. The app
            removes location and other metadata from each photograph on your phone before it is
            sent.
          </p>
          <p>
            Taking these photographs is your choice. The app asks for your consent before the camera
            opens. Without them an application cannot be completed.
          </p>
        </Section>

        <Section title="Why we use it">
          <ul className="list-disc space-y-2 pl-5">
            <li>To sign you in and keep your account and phones secure.</li>
            <li>
              To keep the shared ledger, so that a shop and its customer see the same agreed record.
            </li>
            <li>To review shopkeeper applications.</li>
            <li>
              To investigate disputes, abuse and security problems, and to answer your requests.
            </li>
            <li>To meet legal obligations that apply to us.</li>
          </ul>
          <p>
            We do not sell personal information, we do not use it for advertising, and we do not
            show advertisements in Udharpe.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>The shop.</strong> Its members see the shop&apos;s customers and ledger,
              within their role: an owner manages members; staff record entries; a viewer can only
              look.
            </li>
            <li>
              <strong>The customer.</strong> A customer with an account sees their own record with
              each shop they deal with, and nothing about the shop&apos;s other customers.
            </li>
            <li>
              <strong>Udharpe administrators.</strong> A small number of authorised Esytol staff
              review applications, including their photographs, and handle disputes and support.
              Every view of an application&apos;s photographs is recorded in the audit trail.
            </li>
            <li>
              <strong>Service providers.</strong> Google Cloud hosts the service and its backups in
              India (Mumbai region). Sign-in emails are delivered through an email provider. They
              process information only to provide those services to us.
            </li>
            <li>
              <strong>Authorities.</strong> Where the law requires us to disclose information.
            </li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Ledger records</strong> are a shared record that both sides rely on, so they
              cannot be edited or deleted in the app: a mistake is corrected by a new, linked entry.
              They are kept while the account and shop exist, and as long afterwards as a dispute or
              a legal obligation requires.
            </li>
            <li>
              <strong>Accounts, shops and contacts</strong> are kept while they are in use. To close
              an account, contact us (below); deletion is handled by hand, and we will tell you what
              can be removed and what must be kept because another person relies on it.
            </li>
            <li>
              <strong>Application photographs</strong> are kept until an authorised administrator
              deletes them. There is no fixed automatic deletion period. They are deleted when they
              are no longer needed for the application or a related review, or when you ask and they
              are not needed for an open review or dispute. Each deletion is recorded with who
              deleted it and why. A failed photo attempt stores no image; the record of the attempt
              is removed after 7 days.
            </li>
            <li>
              <strong>Sign-in codes</strong> expire within minutes.{" "}
              <strong>Security records</strong> are kept as long as needed to protect the service
              and investigate problems.
            </li>
            <li>
              <strong>Backups.</strong> Encrypted backups are made every day and stored in India.
              Database backups are intended to be kept for no more than 180 days; until automatic
              expiry is configured they may be kept longer. Photographs are included in encrypted
              backups, which are deleted by hand.
            </li>
          </ul>
        </Section>

        <Section title="How it is protected">
          <p>
            Connections are encrypted. Backups are encrypted before they leave the server, with a
            key the server itself cannot read. Session tokens are stored only as hashes. The service
            account that runs Udharpe cannot rewrite or delete the ledger&apos;s history in the
            database. Access by staff is limited to those who need it.
          </p>
        </Section>

        <Section title="Your choices and requests">
          <p>
            You can ask to see the information we hold about you, to correct it, or to delete it; to
            withdraw your consent to the application photographs (an application under review then
            cannot continue); or to raise a concern about how your information is handled. Write to{" "}
            <a href="mailto:hello@esytol.com" className="text-brand-600 hover:underline">
              hello@esytol.com
            </a>{" "}
            from the email address on your account, and say which shop or account the request is
            about. We may need to confirm it is you before acting.
          </p>
          <p>
            Some requests are limited by the nature of a shared ledger: an agreed entry is part of
            another person&apos;s record too, so it may be kept while that person or the law needs
            it.
          </p>
        </Section>

        <Section title="Grievances">
          <p>
            If you are not satisfied with our answer, write to{" "}
            <a href="mailto:hello@esytol.com" className="text-brand-600 hover:underline">
              hello@esytol.com
            </a>{" "}
            with the subject &ldquo;Udharpe grievance&rdquo;. You may also have the right to
            complain to the data-protection authority that applies to you, including, in India, the
            Data Protection Board under the Digital Personal Data Protection Act, 2023, once it is
            available to you.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Udharpe keeps financial records and is intended for adults. Do not create an account for
            a child.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We will update this notice when what we collect or how we use it changes, and change the
            version above. Material changes will be shown in the app.
          </p>
        </Section>

        <p className="mt-10 text-sm text-gray-500">
          See also the{" "}
          <Link href="/udharpe/terms" className="text-brand-600 hover:underline">
            Udharpe pilot terms
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            Esytol website privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
