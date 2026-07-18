/**
 * Everyday trust-surface + domain routing tests — PLATFORM-004.
 *
 * Pins that each domain gets its OWN trust surface: Everyday tools show the
 * Everyday surface and never the finance disclaimer/reviewer; finance tools are
 * unchanged (still show CalculatorTrust); and the surfaces never cross.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EverydayTrust } from "@/features/tool/EverydayTrust";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { getEverydayStandard } from "@/content/everydayStandards";
import { getToolBySlug } from "@/registry";
import type { Tool } from "@/types/tool";

const ageTool = getToolBySlug("age-calculator")!;

describe("EverydayTrust", () => {
  it("states where it runs, retention, algorithm, and standards", () => {
    render(<EverydayTrust tool={ageTool} />);
    expect(screen.getByText("Where it runs")).toBeInTheDocument();
    expect(screen.getByText("Your browser")).toBeInTheDocument();
    expect(
      screen.getByText(/nothing you type.*is uploaded, stored, or logged/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ISO 8601/i })).toHaveAttribute(
      "href",
      "https://www.iso.org/iso-8601-date-and-time-format.html"
    );
  });

  it("never shows finance copy (no 'not financial advice', no Finance Team)", () => {
    render(<EverydayTrust tool={ageTool} />);
    expect(screen.queryByText(/financial advice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Finance Team/i)).not.toBeInTheDocument();
  });

  it("renders nothing for a tool with no standard entry", () => {
    const unknown: Tool = { ...ageTool, slug: "no-such-everyday-tool" };
    const { container } = render(<EverydayTrust tool={unknown} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ToolLayout domain routing", () => {
  it("Age (Everyday) shows the Everyday surface and NOT the financial disclaimer", () => {
    render(<ToolLayout tool={ageTool}>content</ToolLayout>);
    expect(screen.getByText(/How this works & your privacy/i)).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: /financial disclaimer/i })).toBeNull();
  });

  it("a finance calculator is unchanged — CalculatorTrust, not the Everyday surface", () => {
    const emi = getToolBySlug("emi-calculator")!;
    render(<ToolLayout tool={emi}>content</ToolLayout>);
    expect(screen.getByRole("note", { name: /financial disclaimer/i })).toBeInTheDocument();
    expect(screen.getByText(/EasyTechLabs Finance Team/)).toBeInTheDocument();
    // Everyday surface heading must not appear on a finance tool.
    expect(screen.queryByText(/How this works & your privacy/i)).toBeNull();
  });
});

describe("everyday standards coverage", () => {
  it("every live Everyday tool has a standard entry (client, with references)", () => {
    for (const slug of ["age-calculator", "word-counter", "case-converter"]) {
      const std = getEverydayStandard(slug);
      expect(std, slug).toBeDefined();
      expect(std!.processing).toBe("client");
      expect(std!.standards.length).toBeGreaterThan(0);
      expect(std!.limitations.length).toBeGreaterThan(0);
    }
  });
});
