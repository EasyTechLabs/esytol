import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JsonTree } from "@/features/tools/json-formatter/JsonTree";

/**
 * Tree-view tests. The tree is the JSON Formatter's new interactive surface and,
 * unlike the CodeMirror editor, is plain React — so it is tested directly here
 * (the format/validate/stats engines are covered in the lib tests). Focus: lazy
 * expand/collapse, expand-all/collapse-all, search highlighting + match count, and
 * accessible tree semantics.
 */

const VALUE = {
  name: "Esytol",
  nested: { deep: { value: 42 } },
  list: ["alpha", "beta"],
  active: true,
  empty: null,
};

const tree = () => screen.getByRole("tree");

describe("JsonTree", () => {
  it("renders accessible tree semantics", () => {
    render(<JsonTree value={VALUE} />);
    expect(tree()).toBeInTheDocument();
    expect(screen.getAllByRole("treeitem").length).toBeGreaterThan(0);
  });

  it("shows top-level keys and lazily hides deep values until expanded", () => {
    render(<JsonTree value={VALUE} />);
    // Top-level keys visible (default expands the first levels).
    expect(within(tree()).getByText("name")).toBeInTheDocument();
    // A deeply-nested value is not rendered while its branch is collapsed.
    expect(within(tree()).queryByText("42")).not.toBeInTheDocument();
  });

  it("expands everything on Expand all", () => {
    render(<JsonTree value={VALUE} />);
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(within(tree()).getByText("42")).toBeInTheDocument();
  });

  it("collapses everything on Collapse all", () => {
    render(<JsonTree value={VALUE} />);
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(within(tree()).getByText("name")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    // The root collapses, hiding its children.
    expect(within(tree()).queryByText("name")).not.toBeInTheDocument();
  });

  it("searches keys and values, showing a match count and highlighting", () => {
    render(<JsonTree value={VALUE} />);
    fireEvent.change(screen.getByLabelText(/search the json tree/i), {
      target: { value: "esy" },
    });
    // "Esytol" value matches → count reported and a <mark> rendered.
    expect(screen.getByText(/match/i)).toBeInTheDocument();
    expect(tree().querySelector("mark")).not.toBeNull();
  });

  it("force-expands matching branches while searching (deep match becomes visible)", () => {
    render(<JsonTree value={VALUE} />);
    fireEvent.change(screen.getByLabelText(/search the json tree/i), {
      target: { value: "deep" },
    });
    expect(within(tree()).getByText(/deep/)).toBeInTheDocument();
  });

  it("renders arrays with indices and typed scalars", () => {
    render(<JsonTree value={{ list: ["alpha", "beta"] }} />);
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(within(tree()).getByText("alpha")).toBeInTheDocument();
    expect(within(tree()).getByText("beta")).toBeInTheDocument();
  });
});
