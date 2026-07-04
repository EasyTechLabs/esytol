import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Breadcrumb } from "@/features/tool/Breadcrumb";

describe("Breadcrumb", () => {
  it("always renders a Home link pointing to /", () => {
    render(<Breadcrumb items={[{ label: "Tools", href: "/tools" }]} />);
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders a nav element with aria-label Breadcrumb", () => {
    render(<Breadcrumb items={[{ label: "Tools" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders an intermediate item as a link when href is provided", () => {
    render(
      <Breadcrumb items={[{ label: "Tools", href: "/tools" }, { label: "JSON Formatter" }]} />
    );
    const toolsLink = screen.getByRole("link", { name: "Tools" });
    expect(toolsLink).toHaveAttribute("href", "/tools");
  });

  it("renders the last item without a link and marks it aria-current=page", () => {
    render(<Breadcrumb items={[{ label: "JSON Formatter" }]} />);
    const current = screen.getByText("JSON Formatter");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders multiple items correctly", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Tools", href: "/tools" },
          { label: "Developer", href: "/categories/developer" },
          { label: "JSON Formatter" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Developer" })).toBeInTheDocument();
    const current = screen.getByText("JSON Formatter");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("does not render a link for an item without href", () => {
    render(<Breadcrumb items={[{ label: "Only Item" }]} />);
    expect(screen.queryByRole("link", { name: "Only Item" })).toBeNull();
  });
});
