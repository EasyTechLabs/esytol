/**
 * The UDHARPE mark, as a component.
 *
 * Inline SVG rather than an `<img src="/udharpe/mark.svg">` for two reasons
 * that both matter on this page: it paints in the first HTML response with no
 * second request, so the card never renders a blank square while the logo
 * loads; and `currentColor` is not used anywhere in it, so it cannot be
 * silently recoloured by a parent and end up invisible on a dark surface.
 *
 * The geometry is exactly what Stitch produced for project
 * 2369893755165512883 under design system assets/6728907655515493824. It is
 * duplicated in `public/udharpe/mark.svg` for anything that needs a file — a
 * favicon, an OG image, a README. If one changes, change both; the test in
 * `tests/features/udharpe-brand.test.tsx` checks they agree.
 *
 * What it is: an open ledger. Two leaves — the shop's record and the
 * customer's acknowledgement — a dark binding spine, ruled entry lines, and a
 * single brass bead where the two sides meet, which is the agreement that
 * makes an entry real.
 *
 * What it deliberately is not: a rupee, a coin, a card, a wallet, a bank.
 * Those say payments. Udharpe records what two people agreed and moves no
 * money, and the mark has to be the first place that is true.
 */
export function UdharpeMark({
  size = 36,
  onGreen = false,
  className,
}: {
  size?: number;
  /** Reversed out: paper leaves on the brand green, for an avatar or a tile. */
  onGreen?: boolean;
  className?: string;
}) {
  const leaf = onGreen ? "#FBFAF7" : "#0E6F5C";
  const rule = onGreen ? "#0E6F5C" : "#FBFAF7";
  const spine = onGreen ? "#0A5647" : "#1A1A17";
  const beadOuter = onGreen ? "#B77B2B" : "#FBFAF7";
  const beadInner = onGreen ? "#0A5647" : "#1A1A17";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Udharpe"
    >
      <title>Udharpe</title>
      {onGreen ? <rect width="36" height="36" rx="8" fill="#0E6F5C" /> : null}
      <rect x="17" y="5" width="2" height="26" rx="1" fill={spine} />
      <path d="M7 8C7 6.89543 7.89543 6 9 6H15V30H9C7.89543 30 7 29.1046 7 28V8Z" fill={leaf} />
      <path
        d="M21 6H27C28.1046 6 29 6.89543 29 8V28C29 29.1046 28.1046 30 27 30H21V6Z"
        fill={leaf}
      />
      <line x1="10" y1="12" x2="13" y2="12" stroke={rule} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="17" x2="13" y2="17" stroke={rule} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="12" x2="26" y2="12" stroke={rule} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="17" x2="26" y2="17" stroke={rule} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="23" r="2.2" fill={beadOuter} />
      <circle cx="18" cy="23" r="1.2" fill={beadInner} />
    </svg>
  );
}

/** The horizontal lockup: mark, then the wordmark set in the product's voice. */
export function UdharpeLockup({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <UdharpeMark size={size} />
      <span
        className="font-bold tracking-[0.08em] text-udharpe-ink"
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        UDHARPE
      </span>
    </span>
  );
}
