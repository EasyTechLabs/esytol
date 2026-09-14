/**
 * Where the Udharpe card and page point.
 *
 * ## Why this is `/udharpe` and not `https://udharpe.esytol.com`
 *
 * The founder's directive asks the card to link to `https://udharpe.esytol.com`.
 * That host is **not servable yet**, and linking to it today would ship a
 * broken link to every visitor on the Esytol home page.
 *
 * Verified on 14 September 2026, not assumed:
 *
 * - DNS has propagated. `udharpe.esytol.com` resolves to `34.14.207.219`, the
 *   same load balancer as `esytol.com` and `api.esytol.com`.
 * - TLS fails. For SNI `udharpe.esytol.com` the balancer sends a TLS
 *   `internal error` alert and presents **no certificate at all**, where
 *   `esytol.com` presents `CN=esytol.com`. A browser following that link gets
 *   a full-page "Your connection is not private" interstitial.
 *
 * Fixing it means provisioning a certificate and adding a host rule on the
 * production load balancer, which is a GATE-P2 human action and which the same
 * directive forbids doing here.
 *
 * So the constant points at the path that works today, and the switch is one
 * line. When the certificate is ACTIVE and the host rule is in place, change
 * `UDHARPE_HOME` to `UDHARPE_CANONICAL_ORIGIN` and every link moves with it —
 * the card, the page, and anything added later.
 *
 * The test in `tests/features/udharpe-brand.test.tsx` asserts the card links
 * *somewhere Udharpe*, not to a hard-coded string, so flipping this does not
 * break it.
 */

/**
 * The eventual public origin. Recorded here so the intent is not lost, and so
 * the change is a one-line edit rather than a hunt through JSX.
 *
 * Do not link to this until `openssl s_client -servername udharpe.esytol.com`
 * returns a certificate naming the host.
 */
export const UDHARPE_CANONICAL_ORIGIN = "https://udharpe.esytol.com";

/** What every Udharpe link on Esytol actually uses today. */
export const UDHARPE_HOME = "/udharpe";
