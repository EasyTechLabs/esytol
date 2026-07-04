import Script from "next/script";
import { analyticsConfig } from "./index";

/**
 * Provider-agnostic analytics loader.
 *
 * Renders nothing unless NEXT_PUBLIC_GA_ID is configured — no tracking ID is
 * hardcoded, so the default build ships without any analytics. When an ID is
 * present it loads Google Analytics 4 (gtag.js).
 */
export function Analytics() {
  if (!analyticsConfig.enabled) return null;
  const { gaId } = analyticsConfig;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="analytics-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
