import { describe, it, expect } from "vitest";
import { toolSchema, breadcrumbSchema, faqSchema, organizationSchema } from "@/seo/jsonld";
import { getToolBySlug } from "@/registry";
import type { Tool } from "@/types/tool";

const emi = getToolBySlug("emi-calculator") as Tool;

describe("SoftwareApplication schema", () => {
  const schema = toolSchema(emi) as {
    "@type": string;
    offers: { price: string; priceCurrency: string };
  };

  it("is a SoftwareApplication", () => {
    expect(schema["@type"]).toBe("SoftwareApplication");
  });

  it("prices in INR (India target), free", () => {
    expect(schema.offers.priceCurrency).toBe("INR");
    expect(schema.offers.price).toBe("0");
  });

  it("no finance calculator schema uses USD", () => {
    const financeSlugs = [
      "emi-calculator",
      "home-loan-calculator",
      "personal-loan-calculator",
      "sip-calculator",
      "lumpsum-calculator",
      "fd-calculator",
      "rd-calculator",
      "ppf-calculator",
      "cagr-calculator",
      "gst-calculator",
      "income-tax-calculator",
      "hra-calculator",
      "epf-calculator",
      "gratuity-calculator",
    ];
    for (const slug of financeSlugs) {
      const tool = getToolBySlug(slug) as Tool;
      const s = toolSchema(tool) as { offers: { priceCurrency: string } };
      expect(s.offers.priceCurrency, `${slug} currency`).toBe("INR");
    }
  });
});

describe("supporting schemas", () => {
  it("breadcrumb builds an ordered ItemList", () => {
    const b = breadcrumbSchema([
      { name: "Home", url: "https://x/" },
      { name: "Tools", url: "https://x/tools" },
    ]) as { itemListElement: { position: number }[] };
    expect(b.itemListElement).toHaveLength(2);
    expect(b.itemListElement[0].position).toBe(1);
  });

  it("faq builds a FAQPage", () => {
    const f = faqSchema([{ question: "Q?", answer: "A." }]) as { "@type": string };
    expect(f["@type"]).toBe("FAQPage");
  });

  it("organization schema is present", () => {
    const o = organizationSchema() as { "@type": string };
    expect(o["@type"]).toBe("Organization");
  });
});
