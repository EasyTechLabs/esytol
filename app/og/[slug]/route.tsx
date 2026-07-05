import { ImageResponse } from "next/og";
import { toolRegistry, getToolBySlug } from "@/registry";
import { getMethodology } from "@/content/methodology";

/**
 * Dynamic, production-quality Open Graph images generated with Next.js native
 * `next/og` (ImageResponse) — no static PNGs. One shared generator serves every
 * calculator (`/og/<slug>`) and the site-wide default (`/og/site`), so there is
 * no per-calculator duplication.
 */

const SIZE = { width: 1200, height: 630 };

// Only known slugs (all tools) plus the site default are generated.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...toolRegistry.map((t) => ({ slug: t.slug })), { slug: "site" }];
}

interface OgContent {
  title: string;
  subtitle: string;
  pills: string[];
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function contentFor(slug: string): OgContent | null {
  if (slug === "site") {
    return {
      title: "Free Financial Calculators",
      subtitle:
        "EMI, SIP, GST, FD, RD, PPF, home & personal loan calculators — accurate, private, and free.",
      pills: ["Free", "Made for India", "No signup"],
    };
  }
  const tool = getToolBySlug(slug);
  if (!tool) return null;
  const method = getMethodology(slug);
  const regulator = method?.sources[0]?.label ?? "Bank-grade";
  return {
    title: tool.name,
    subtitle: truncate(tool.description, 120),
    pills: ["Free", "Made for India", truncate(regulator, 22)],
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = contentFor(slug);
  if (!content) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 60%)",
        fontFamily: "sans-serif",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div
          style={{
            display: "flex",
            width: "60px",
            height: "60px",
            borderRadius: "14px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "42px",
            fontWeight: 800,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          E
        </div>
        <div style={{ fontSize: "34px", fontWeight: 700, color: "#111827" }}>Esytol</div>
      </div>

      {/* Headline */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "72px", fontWeight: 800, color: "#111827", lineHeight: 1.05 }}>
          {content.title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "24px",
            fontSize: "32px",
            color: "#4b5563",
            maxWidth: "980px",
          }}
        >
          {content.subtitle}
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "36px" }}>
          {content.pills.map((pill) => (
            <div
              key={pill}
              style={{
                display: "flex",
                alignItems: "center",
                border: "2px solid #bfdbfe",
                color: "#1d4ed8",
                borderRadius: "999px",
                padding: "10px 26px",
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "30px",
          color: "#6b7280",
        }}
      >
        <div style={{ display: "flex", fontWeight: 600, color: "#2563eb" }}>www.esytol.com</div>
        <div style={{ display: "flex" }}>Runs in your browser · No data sent</div>
      </div>
    </div>,
    SIZE
  );
}
