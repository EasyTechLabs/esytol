import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Command palette tests (PLATFORM-006) — the global search surface.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CommandPalette, OPEN_SEARCH_EVENT } from "@/features/search/CommandPalette";
import { SearchTrigger } from "@/features/search/SearchTrigger";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const openWithHotkey = () => fireEvent.keyDown(window, { key: "k", ctrlKey: true });

describe("CommandPalette", () => {
  it("is closed until ⌘K / Ctrl+K is pressed", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openWithHotkey();
    expect(screen.getByRole("dialog", { name: /search tools/i })).toBeInTheDocument();
  });

  it("searches the registry and lists matching tools", async () => {
    render(<CommandPalette />);
    openWithHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "password generator" } });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /password generator/i })).toBeInTheDocument()
    );
  });

  it("navigates with the keyboard and opens the active result on Enter", async () => {
    render(<CommandPalette />);
    openWithHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "json formatter" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/tools/json-formatter");
  });

  it("shows an empty-state message for an unmatched query", async () => {
    render(<CommandPalette />);
    openWithHotkey();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzznope" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/no tools match/i));
  });

  it("closes on Escape", () => {
    render(<CommandPalette />);
    openWithHotkey();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the header search button's event", () => {
    render(<CommandPalette />);
    fireEvent(window, new CustomEvent(OPEN_SEARCH_EVENT));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("SearchTrigger", () => {
  it("dispatches the open-search event when clicked", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<SearchTrigger />);
    fireEvent.click(screen.getByRole("button", { name: /search tools/i }));
    expect(spy.mock.calls.some(([e]) => (e as Event).type === OPEN_SEARCH_EVENT)).toBe(true);
    spy.mockRestore();
  });
});
