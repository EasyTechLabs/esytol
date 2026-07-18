import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { JwtDecoder } from "@/features/tools/jwt-decoder/JwtDecoder";

/**
 * Component tests for the JWT Decoder. The decode/verify/insight engines are tested
 * separately; here we verify the wiring: a pasted token decodes into header/payload
 * with explanations, HS256 verification runs for real (Web Crypto), the security
 * analysis is shown, and malformed tokens surface an error. The verify flow uses the
 * canonical jwt.io token + secret so a genuine success is asserted.
 */

// jwt.io canonical HS256 token; verifies with secret "your-256-bit-secret".
const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
// alg:none token (header {"alg":"none","typ":"JWT"}, payload {"sub":"1"}, empty sig).
const NONE_TOKEN = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.";

const paste = (value: string) =>
  fireEvent.change(screen.getByLabelText("JSON Web Token"), { target: { value } });

describe("JwtDecoder", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("decodes the header and payload with claim explanations", async () => {
    render(<JwtDecoder />);
    paste(SAMPLE);
    await waitFor(() => expect(screen.getByText("Header")).toBeInTheDocument());
    expect(screen.getByText("Payload")).toBeInTheDocument();
    // A registered claim is explained.
    expect(screen.getByText(/who the token is about/i)).toBeInTheDocument();
  });

  it("verifies a correct HS256 signature", async () => {
    render(<JwtDecoder />);
    paste(SAMPLE);
    await waitFor(() => expect(screen.getByLabelText(/shared secret/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/shared secret/i), {
      target: { value: "your-256-bit-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Security analysis")).getByText(/verified/i)
      ).toBeInTheDocument()
    );
  });

  it("reports a wrong secret honestly (no false 'verified')", async () => {
    render(<JwtDecoder />);
    paste(SAMPLE);
    await waitFor(() => expect(screen.getByLabelText(/shared secret/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/shared secret/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(screen.getAllByText(/does not match/i).length).toBeGreaterThan(0));
    // And crucially, never a false success.
    expect(
      within(screen.getByLabelText("Security analysis")).queryByText(/signature verified/i)
    ).not.toBeInTheDocument();
  });

  it('flags alg:"none" as unsigned and offers no verification input', async () => {
    render(<JwtDecoder />);
    paste(NONE_TOKEN);
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("Security analysis")).getByText(/unsigned/i)
      ).toBeInTheDocument()
    );
    expect(screen.queryByLabelText(/shared secret/i)).not.toBeInTheDocument();
  });

  it("surfaces an error for a malformed token", async () => {
    render(<JwtDecoder />);
    paste("not-a-jwt");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/not a jwt/i));
  });

  it("always warns that decoding is not encryption", async () => {
    render(<JwtDecoder />);
    paste(SAMPLE);
    await waitFor(() => expect(screen.getByText(/not encryption/i)).toBeInTheDocument());
  });
});
