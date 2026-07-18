import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { UuidGenerator } from "@/features/tools/uuid-generator/UuidGenerator";

/**
 * Component tests for the UUID Generator. The engine is vector-tested separately;
 * here we verify the wiring: bulk generation, version switching, formatting toggles,
 * name-based determinism, and the validator. Web Crypto is provided by the jsdom/Node
 * environment, so generation runs for real.
 */

const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const list = () => screen.getByLabelText("Generated UUIDs");

describe("UuidGenerator", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("generates a bulk batch on mount (default v4, qty 10)", async () => {
    render(<UuidGenerator />);
    await waitFor(() => expect(list().children.length).toBe(10));
    const first = list().children[0].querySelector("span")!.textContent!;
    expect(first).toMatch(CANONICAL);
    expect(first[14]).toBe("4"); // version 4
  });

  it("changes the batch size", async () => {
    render(<UuidGenerator />);
    await waitFor(() => expect(list().children.length).toBe(10));
    fireEvent.change(screen.getByLabelText(/how many/i), { target: { value: "50" } });
    await waitFor(() => expect(list().children.length).toBe(50));
  });

  it("switches version and reflects it in the output", async () => {
    render(<UuidGenerator />);
    await waitFor(() => expect(list().children.length).toBe(10));
    fireEvent.click(screen.getByRole("radio", { name: "v7" }));
    await waitFor(() => {
      const v = list().children[0].querySelector("span")!.textContent!;
      expect(v[14]).toBe("7");
    });
  });

  it("uppercases when the toggle is on", async () => {
    render(<UuidGenerator />);
    await waitFor(() => expect(list().children.length).toBe(10));
    fireEvent.click(screen.getByLabelText("Uppercase"));
    await waitFor(() => {
      const v = list().children[0].querySelector("span")!.textContent!;
      expect(v).toBe(v.toUpperCase());
      expect(v).toMatch(/^[0-9A-F-]+$/);
    });
  });

  it("removes hyphens when the toggle is off", async () => {
    render(<UuidGenerator />);
    await waitFor(() => expect(list().children.length).toBe(10));
    fireEvent.click(screen.getByLabelText("Hyphens"));
    await waitFor(() => {
      const v = list().children[0].querySelector("span")!.textContent!;
      expect(v).not.toContain("-");
      expect(v.length).toBe(32);
    });
  });

  it("computes a deterministic v5 UUID from a namespace + name", async () => {
    render(<UuidGenerator />);
    fireEvent.click(screen.getByRole("radio", { name: "v5" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "python.org" } });
    await waitFor(() =>
      expect(within(list()).getByText("886313e1-3b8a-5372-9b90-0c9aee199e5d")).toBeInTheDocument()
    );
  });

  it("validates a UUID and explains its version + timestamp", async () => {
    render(<UuidGenerator />);
    fireEvent.click(screen.getByRole("tab", { name: /validate/i }));
    fireEvent.change(screen.getByLabelText(/paste a uuid/i), {
      target: { value: "886313e1-3b8a-5372-9b90-0c9aee199e5d" },
    });
    await waitFor(() => expect(screen.getByText(/valid uuid/i)).toBeInTheDocument());
    expect(screen.getByText(/name-based \(SHA-1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/RFC 4122/i)).toBeInTheDocument();
  });

  it("flags an invalid UUID", async () => {
    render(<UuidGenerator />);
    fireEvent.click(screen.getByRole("tab", { name: /validate/i }));
    fireEvent.change(screen.getByLabelText(/paste a uuid/i), { target: { value: "not-a-uuid" } });
    await waitFor(() => expect(screen.getByText(/invalid/i)).toBeInTheDocument());
  });
});
