import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import axe from "axe-core";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";

// jsdom does not support HTMLCanvasElement.getContext, which axe needs for the
// color-contrast rule. Disable that rule in the test environment; color-contrast
// must be verified in a real browser (e.g., Playwright + axe-playwright).
const AXE_OPTIONS: axe.RunOptions = {
  rules: { "color-contrast": { enabled: false } },
};

async function runAxe(container: Element) {
  return axe.run(container, AXE_OPTIONS);
}

describe("accessibility — EmptyState", () => {
  it("has no violations with title only", async () => {
    const { container } = render(<EmptyState title="No results found" />);
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("has no violations with title and description", async () => {
    const { container } = render(
      <EmptyState title="No tools" description="Try a different search term." icon="🔍" />
    );
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });
});

describe("accessibility — SearchBar", () => {
  it("has no violations in default state", async () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("has no violations with a value and clear button visible", async () => {
    const { container } = render(
      <SearchBar value="json" onChange={() => {}} onClear={() => {}} placeholder="Search…" />
    );
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("has no violations with size=lg", async () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} size="lg" />);
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });
});
