import Script from "next/script";
import { analyticsConfig } from "./index";

/**
 * Provider-agnostic analytics loader.
 *
 * Renders nothing unless an ID is configured — no tracking ID is hardcoded, so
 * the default build ships with no analytics. Each provider is independent:
 *   - Google Analytics 4 (gtag.js) loads when NEXT_PUBLIC_GA_ID is set.
 *   - Microsoft Clarity loads when NEXT_PUBLIC_CLARITY_ID is set.
 */
export function Analytics() {
  const { gaId, clarityId } = analyticsConfig;
  if (!gaId && !clarityId) return null;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}

      {clarityId && (
        // Official Microsoft Clarity bootstrap snippet (no third-party wrapper).
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  );
}
