"use client";

/**
 * Vyora — a shop's QR, and the code written out underneath it.
 *
 * ## Both, always
 *
 * The printed code is not a caption. A QR is useless over a phone call, useless
 * to somebody reading it out, and useless on a printout that has been
 * photocopied one time too many. The human-readable code covers all of those,
 * and the manual-entry path exists precisely so it can be used. This component
 * renders the two together and offers no way to render only the square.
 *
 * ## What is inside the square
 *
 * `vyora:shop/VYR-7K2M-4Q`, built by `qrPayloadFor`, which refuses anything
 * that does not parse. No name, no address, no pincode, no email, no token, no
 * membership list, no internal database id, and no URL — in particular not a
 * link back to this app, which would turn a code printed on a counter into a
 * tracker for whoever scanned it.
 *
 * ## Encoded in the browser, not fetched
 *
 * `qrcode` renders an SVG locally. An image service would put the identifier of
 * every shop that ever displayed its card into a third party's request log, and
 * would leave a blank square whenever that service was slow.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { qrPayloadFor } from "@/lib/vyora/identity";

export function ShopQr({
  shopId,
  size = 208,
  caption,
}: {
  shopId: string;
  size?: number;
  /** Optional line under the code. The code itself is never optional. */
  caption?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    void (async () => {
      try {
        const markup = await QRCode.toString(qrPayloadFor(shopId), {
          type: "svg",
          // `M` recovers about 15% — enough for a printout that picks up a
          // scuff, without inflating the module count to where a phone camera
          // struggles at arm's length.
          errorCorrectionLevel: "M",
          // Scanners need the quiet zone; a QR flush to its border reads slowly
          // or not at all.
          margin: 2,
          width: size,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setSvg(markup);
      } catch {
        // A malformed identifier can only come from a server response, so this
        // is a contract violation rather than merchant error. Say plainly that
        // the code cannot be shown, and show nothing.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shopId, size]);

  if (failed) {
    return (
      <p className="text-sm text-gray-500" data-testid="shop-qr-unavailable">
        This shop&rsquo;s code cannot be displayed.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3" data-testid="shop-qr">
      <div
        className="rounded-xl border border-gray-200 bg-white p-4"
        style={{ width: size + 32, height: size + 32 }}
      >
        {/*
          The SVG comes from `qrcode`, from a string this component built from a
          parsed identifier — never from a server response or user input.
        */}
        {svg ? <div aria-hidden dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      </div>

      {/*
        Letter-spaced and large: this is compared against a printed card
        character by character, and read aloud over a phone.
      */}
      <p
        className="select-all text-2xl font-bold tabular-nums tracking-[0.15em] text-gray-900"
        aria-label={shopId.split("").join(" ")}
        data-testid="shop-qr-code"
      >
        {shopId}
      </p>

      {caption ? <p className="max-w-xs text-center text-xs text-gray-500">{caption}</p> : null}
    </div>
  );
}
