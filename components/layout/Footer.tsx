import Link from "next/link";
import { siteConfig } from "@/config/site";
import { footerNav } from "@/config/nav";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="font-bold text-gray-900" aria-label="Esytol home">
              <Logo />
            </Link>
            <p className="mt-3 text-sm text-gray-500">{siteConfig.tagline}</p>
          </div>

          {/* Calculators */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Calculators
            </h3>
            <ul className="space-y-2">
              {footerNav.tools.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-600 transition hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Company
            </h3>
            <ul className="space-y-2">
              {footerNav.company.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-600 transition hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* GitHub */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Open Source
            </h3>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 transition hover:text-gray-900"
            >
              GitHub ↗
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} EasyTechLabs. All tools are free and run in your browser.
          </p>
        </div>
      </div>
    </footer>
  );
}
