import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { Markdown } from "@/features/learn/Markdown";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Markdown renderer", () => {
  it("skips the body H1 and renders H2/H3 with ids", () => {
    const { container } = render(
      <Markdown source={"# Title\n\n## Section One\n\n### Sub Section\n\nBody text."} />
    );
    expect(container.querySelector("h1")).toBeNull();
    const h2 = screen.getByRole("heading", { level: 2, name: "Section One" });
    expect(h2).toHaveAttribute("id", "section-one");
    expect(screen.getByRole("heading", { level: 3, name: "Sub Section" })).toBeInTheDocument();
  });

  it("renders bold, italics and inline code", () => {
    const { container } = render(<Markdown source={"A **bold** and _italic_ and `code` run."} />);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.querySelector("code")?.textContent).toBe("code");
  });

  it("renders internal links as anchors to /tools and external links with target", () => {
    render(
      <Markdown
        source={"See the [HRA Calculator](/tools/hra-calculator) and [Google](https://google.com)."}
      />
    );
    const internal = screen.getByRole("link", { name: "HRA Calculator" });
    expect(internal).toHaveAttribute("href", "/tools/hra-calculator");
    const external = screen.getByRole("link", { name: "Google" });
    expect(external).toHaveAttribute("href", "https://google.com");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders unordered and ordered lists", () => {
    const { container } = render(<Markdown source={"- alpha\n- beta\n\n1. first\n2. second"} />);
    expect(container.querySelector("ul")?.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("ol")?.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("renders a table with header and body rows", () => {
    const { container } = render(
      <Markdown source={"| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |"} />
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table!.querySelectorAll("thead th")).toHaveLength(2);
    expect(table!.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("renders blockquotes and horizontal rules", () => {
    const { container } = render(
      <Markdown source={"> A quoted formula line.\n\n---\n\nAfter the rule."} />
    );
    expect(container.querySelector("blockquote")?.textContent).toContain("quoted formula");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders bold inside list items (nested inline)", () => {
    const { container } = render(<Markdown source={"- **Bold item** with text"} />);
    expect(container.querySelector("li strong")?.textContent).toBe("Bold item");
  });
});
