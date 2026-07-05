import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Get in touch with the Esytol team — email hello@esytol.com for support, business inquiries, bug reports, and feature requests.",
  path: "/contact",
});

const EMAIL = "hello@esytol.com";

const channels = [
  {
    icon: "🐞",
    title: "Bug reports",
    body: "Found a wrong number or a broken control? Open a GitHub issue with the tool name, your inputs, and what you expected — or email us. Reproducible reports get fixed fastest.",
  },
  {
    icon: "💡",
    title: "Feature requests",
    body: "Want a new calculator or an option on an existing one? Tell us the use case. We prioritise requests that help the most people.",
  },
  {
    icon: "🤝",
    title: "Business inquiries",
    body: "Partnerships, licensing, embedding a calculator, or press — email us with a short description and we’ll route it to the right person.",
  },
  {
    icon: "🔒",
    title: "Privacy & data",
    body: "Questions about how Esytol handles data? Everything runs in your browser and we store no personal data — but we’re happy to answer specifics.",
  },
];

export default function ContactPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="mt-4 text-gray-600">
          We’d love to hear from you. Whether it’s a bug, an idea, or a business inquiry, the
          fastest way to reach the {siteConfig.name} team is by email.
        </p>

        {/* Primary contact */}
        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Email</p>
            <a
              href={`mailto:${EMAIL}`}
              className="mt-1 block text-xl font-semibold text-brand-600 hover:underline"
            >
              {EMAIL}
            </a>
          </div>
          <a
            href={`${siteConfig.links.github}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            Open a GitHub issue ↗
          </a>
        </div>

        {/* Response expectations */}
        <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">Response time:</span> Esytol is an
            independent, open-source project. We read every message and typically reply within{" "}
            <span className="font-medium">2–3 business days</span>. For anything code-related, a{" "}
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub
            </a>{" "}
            issue is often the quickest path.
          </p>
        </div>

        {/* Channels */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {channels.map((c) => (
            <div key={c.title} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {c.icon}
                </span>
                <h2 className="font-semibold text-gray-900">{c.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
