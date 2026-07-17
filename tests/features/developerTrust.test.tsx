/**
 * Developer trust-surface tests — PLATFORM-003.
 *
 * The trust requirement for developer tools (Part 5) is different from finance:
 * where it runs, data retention, how it works, limitations, and RFC references.
 * These tests pin that the surface states all of it, and — critically — that a
 * developer tool never renders the finance E-E-A-T surface (no "reviewed by
 * Finance Team", no "not financial advice").
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeveloperTrust } from "@/features/tool/DeveloperTrust";
import { getDevStandard } from "@/content/devStandards";
import { getToolBySlug } from "@/registry";
import type { Tool } from "@/types/tool";

const jsonTool = getToolBySlug("json-formatter")!;

describe("DeveloperTrust", () => {
  it("states where it runs, retention, and privacy", () => {
    render(<DeveloperTrust tool={jsonTool} />);
    expect(screen.getByText("Where it runs")).toBeInTheDocument();
    expect(screen.getByText("Your browser")).toBeInTheDocument();
    expect(screen.getByText("Data retention")).toBeInTheDocument();
    expect(
      screen.getByText(/nothing you paste.*is uploaded, stored, or logged/i)
    ).toBeInTheDocument();
  });

  it("shows limitations and clickable RFC references", () => {
    render(<DeveloperTrust tool={jsonTool} />);
    expect(screen.getByText(/Limitations/i)).toBeInTheDocument();
    const rfc = screen.getByRole("link", { name: /RFC 8259/i });
    expect(rfc).toHaveAttribute("href", "https://www.rfc-editor.org/rfc/rfc8259");
  });

  it("renders nothing for a tool with no standard entry", () => {
    const unknown: Tool = { ...jsonTool, slug: "not-a-real-dev-tool" };
    const { container } = render(<DeveloperTrust tool={unknown} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never shows finance E-E-A-T copy (no advice, no Finance Team reviewer)", () => {
    render(<DeveloperTrust tool={jsonTool} />);
    expect(screen.queryByText(/not financial advice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Finance Team/i)).not.toBeInTheDocument();
    expect(screen.getByText("EasyTechLabs Engineering")).toBeInTheDocument();
  });
});

describe("dev standards coverage", () => {
  it("every live developer tool has a standard entry with client processing and references", () => {
    for (const slug of ["json-formatter", "base64-encoder", "url-encoder"]) {
      const std = getDevStandard(slug);
      expect(std, slug).toBeDefined();
      expect(std!.processing).toBe("client");
      expect(std!.references.length).toBeGreaterThan(0);
      expect(std!.limitations.length).toBeGreaterThan(0);
    }
  });
});
