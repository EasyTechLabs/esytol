import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { PasswordGenerator } from "@/features/tools/password-generator/PasswordGenerator";

/**
 * Component tests for the Password Generator UI. The engine is unit-tested
 * separately; here we check the wiring: an initial secret is generated on mount,
 * the controls change the output shape, and invalid configs surface an error
 * instead of a blank/crash. crypto.getRandomValues is provided by the jsdom/Node
 * environment, so generation runs for real.
 */

const output = () => screen.getByTestId("pw-output");

describe("PasswordGenerator", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.resolve() },
    });
  });

  it("generates a password on mount", async () => {
    render(<PasswordGenerator />);
    await waitFor(() => expect(output().textContent).not.toBe("—"));
    expect(output().textContent!.length).toBe(16); // default length
  });

  it("shows a strength meter with an entropy readout", async () => {
    render(<PasswordGenerator />);
    await waitFor(() => expect(output().textContent).not.toBe("—"));
    expect(screen.getByText(/bits of entropy/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /password strength/i })).toBeInTheDocument();
  });

  it("regenerates a different value on demand", async () => {
    render(<PasswordGenerator />);
    await waitFor(() => expect(output().textContent).not.toBe("—"));
    const first = output().textContent;
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    // Overwhelmingly likely to differ for a 16-char password; retry once if it collides.
    await waitFor(() => {
      if (output().textContent === first) {
        fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
      }
      expect(output().textContent).not.toBe(first);
    });
  });

  it("shows an error when no character type is selected", async () => {
    render(<PasswordGenerator />);
    await waitFor(() => expect(output().textContent).not.toBe("—"));
    for (const label of [/lowercase/i, /uppercase/i, /numbers/i, /symbols/i]) {
      const cb = screen.getByLabelText(label) as HTMLInputElement;
      if (cb.checked) fireEvent.click(cb);
    }
    await waitFor(() =>
      expect(within(output()).getByText(/select at least one character type/i)).toBeInTheDocument()
    );
  });

  it("switches to passphrase mode and produces separated words", async () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByRole("tab", { name: /passphrase/i }));
    await waitFor(() => expect(output().textContent).toContain("-"));
    // Default 5 words → 4 hyphen separators (capitalisation is on by default).
    expect(output().textContent!.split("-").length).toBe(5);
  });

  it("generates multiple passwords in bulk", async () => {
    render(<PasswordGenerator />);
    await waitFor(() => expect(output().textContent).not.toBe("—"));
    fireEvent.change(screen.getByLabelText("Generate"), { target: { value: "5" } });
    await waitFor(() =>
      expect(screen.getByLabelText("Generated passwords").children.length).toBe(5)
    );
  });
});
