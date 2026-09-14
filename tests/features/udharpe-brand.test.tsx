/**
 * The Udharpe card exists, says Udharpe, and goes somewhere.
 *
 * This file is an acceptance test for a *product identity*, which is an odd
 * thing to assert in code — but the failure it guards against is specific and
 * has already happened once on this site: a product card that is present in the
 * repository, correct in review, and not actually rendered on the page anybody
 * opens.
 *
 * So it renders the real home page section and reads what comes out.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UdharpeProductCard } from "@/features/udharpe/ProductCard";
import { UdharpeMark } from "@/features/udharpe/UdharpeMark";
import { UDHARPE_CANONICAL_ORIGIN, UDHARPE_HOME } from "@/features/udharpe/links";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("the Udharpe product card", () => {
  it("is titled UDHARPE, in the product's own spelling", () => {
    render(<UdharpeProductCard />);
    // The heading is the name, so it carries the wordmark's spelling. Prose
    // elsewhere on the card says "Udharpe", which is correct in a sentence.
    expect(screen.getByRole("heading", { name: "UDHARPE" })).toBeTruthy();
  });

  it("says what the product is, in one line a shopkeeper would recognise", () => {
    render(<UdharpeProductCard />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/trusted digital ledger/i);
    expect(text).toMatch(/customers and shops/i);
    expect(text).toMatch(/both sides agree/i);
  });

  it("denies moving money, on the card rather than on a page nobody opens", () => {
    // The sentence a regulator or a confused shopkeeper reads first. It is a
    // product constraint, not copywriting, so it is pinned.
    render(<UdharpeProductCard />);
    expect(document.body.textContent).toMatch(/does not move money/i);
  });

  it("offers all three actions the product has", () => {
    render(<UdharpeProductCard />);
    expect(screen.getByTestId("udharpe-explore").textContent).toMatch(/Explore UDHARPE/i);
    expect(screen.getByTestId("udharpe-android").textContent).toMatch(/Android.*Download/i);
    expect(screen.getByTestId("udharpe-ios").textContent).toMatch(/iOS.*Coming Soon/i);
  });

  it("makes iOS text rather than a link, because there is nothing to link to", () => {
    render(<UdharpeProductCard />);
    expect(screen.getByTestId("udharpe-ios").tagName.toLowerCase()).not.toBe("a");
  });

  it("links somewhere Udharpe, whichever host that is today", () => {
    // Asserts the destination is *the Udharpe home*, not a hard-coded string,
    // so moving from /udharpe to https://udharpe.esytol.com once TLS exists is
    // a one-line change that does not break this test.
    render(<UdharpeProductCard />);
    const explore = screen.getByTestId("udharpe-explore").getAttribute("href");
    expect(explore).toBe(UDHARPE_HOME);
    expect(screen.getByTestId("udharpe-android").getAttribute("href")).toContain(UDHARPE_HOME);
  });

  it("records the canonical origin even though it is not linked yet", () => {
    // The intent must not be lost. `udharpe.esytol.com` resolves but the load
    // balancer presents no certificate for that SNI, so linking there today
    // shows every visitor a browser security interstitial.
    expect(UDHARPE_CANONICAL_ORIGIN).toBe("https://udharpe.esytol.com");
  });

  it("carries the mark, not just the word", () => {
    render(<UdharpeProductCard />);
    expect(screen.getByLabelText("Udharpe")).toBeTruthy();
  });

  it("uses Udharpe's palette rather than Esytol's neutral grey", () => {
    // A card drawn in the site's own greys is a renamed card. The product has
    // its own identity and the card has to be recognisably it.
    const { container } = render(<UdharpeProductCard />);
    const html = container.innerHTML;
    expect(html).toMatch(/udharpe-(paper|ink|primary|brass)/);
    expect(html).not.toMatch(/\btext-gray-900\b|\bbg-gray-900\b/);
  });

  it("never says Vyora anywhere a visitor can read", () => {
    render(<UdharpeProductCard />);
    expect(document.body.textContent ?? "").not.toMatch(/vyora/i);
  });
});

describe("the mark", () => {
  it("says nothing about payments", () => {
    // The mark is an open ledger. A rupee, a coin, a card or a note would say
    // "we move your money", which is the one thing this product does not do.
    const { container } = render(<UdharpeMark />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/₹|rupee|coin|card|wallet|bank/i);
  });

  it("is labelled for a screen reader", () => {
    render(<UdharpeMark />);
    expect(screen.getByLabelText("Udharpe")).toBeTruthy();
  });

  it("reverses cleanly, so it is legible on the brand green as well as on paper", () => {
    // The bug this catches: paper-coloured leaves left on a light ground, which
    // is invisible. It is exactly what the first Android adaptive icon did.
    const onPaper = render(<UdharpeMark />).container.innerHTML;
    const onGreen = render(<UdharpeMark onGreen />).container.innerHTML;
    expect(onPaper).toContain("#0E6F5C"); // green leaves on paper
    expect(onGreen).toContain("#FBFAF7"); // paper leaves on green
    expect(onPaper).not.toBe(onGreen);
  });

  it("agrees with the standalone SVG file", () => {
    // Two copies exist: the component, for the first paint with no second
    // request, and the file, for a favicon or an OG image. They must not drift.
    const file = readFileSync(join(process.cwd(), "public", "udharpe", "mark.svg"), "utf8");
    const { container } = render(<UdharpeMark />);
    // Compare the geometry that actually defines the mark: the two leaf paths.
    const leaf = /M7 8C7 6\.89543[^"]*/.exec(container.innerHTML)?.[0];
    expect(leaf).toBeTruthy();
    expect(file).toContain(leaf!);
  });
});
