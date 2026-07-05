import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ToolLayout } from "@/features/tool/ToolLayout";
import type { Tool } from "@/types/tool";

const baseTool: Tool = {
  id: "test-tool",
  name: "Test Tool",
  slug: "test-tool",
  description: "A tool for testing the framework.",
  category: "developer",
  tags: ["test"],
  icon: "🧪",
  url: "/tools/test-tool",
  version: "1.0.0",
  lastUpdated: "Jan 2025",
  relatedTools: [],
};

describe("ToolLayout", () => {
  it("renders the tool name in an h1 heading", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByRole("heading", { level: 1, name: "Test Tool" })).toBeInTheDocument();
  });

  it("renders the tool description", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByText("A tool for testing the framework.")).toBeInTheDocument();
  });

  it("renders children inside the tool container", () => {
    render(
      <ToolLayout tool={baseTool}>
        <p>Tool content here</p>
      </ToolLayout>
    );
    expect(screen.getByText("Tool content here")).toBeInTheDocument();
  });

  it("renders breadcrumb with Home and Tools navigation links", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tools" })).toBeInTheDocument();
  });

  it("renders version and lastUpdated in the header", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Updated Jan 2025")).toBeInTheDocument();
  });

  it("does not render FAQ section when faq is absent", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.queryByRole("heading", { name: /frequently asked questions/i })).toBeNull();
  });

  it("renders FAQ section when faq items are provided", () => {
    const toolWithFaq: Tool = {
      ...baseTool,
      faq: [{ question: "What does this tool do?", answer: "It is a test tool." }],
    };
    render(<ToolLayout tool={toolWithFaq}>content</ToolLayout>);
    expect(
      screen.getByRole("heading", { name: /frequently asked questions/i })
    ).toBeInTheDocument();
    expect(screen.getByText("What does this tool do?")).toBeInTheDocument();
  });

  it("renders the sidebar report issue link", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByRole("link", { name: "Report an issue" })).toBeInTheDocument();
  });

  it("renders share section label", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("does NOT show the financial disclaimer for non-calculator tools", () => {
    render(<ToolLayout tool={baseTool}>content</ToolLayout>);
    expect(screen.queryByRole("note", { name: /financial disclaimer/i })).toBeNull();
  });

  it("shows the financial disclaimer for calculator tools", () => {
    const calc: Tool = { ...baseTool, category: "calculator" };
    render(<ToolLayout tool={calc}>content</ToolLayout>);
    const note = screen.getByRole("note", { name: /financial disclaimer/i });
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/estimates for educational purposes only/i);
  });
});
