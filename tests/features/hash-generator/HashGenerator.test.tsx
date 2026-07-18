import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HashGenerator } from "@/features/tools/hash-generator/HashGenerator";

/**
 * Component tests for the Hash Generator. The algorithms are vector-tested in the
 * crypto lib; here we verify the wiring: text hashes appear and are correct, the
 * checksum-verify box detects a match, HMAC computes, and mode switching works.
 * SubtleCrypto is provided by the jsdom/Node environment, so hashing runs for real.
 */

// SHA-256("abc") — used to assert real output and the verify flow.
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const digestList = () => screen.getByLabelText("Hash digests");

describe("HashGenerator", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("computes correct digests for typed text", async () => {
    render(<HashGenerator />);
    fireEvent.change(screen.getByLabelText("Text to hash"), { target: { value: "abc" } });
    await waitFor(() => expect(within(digestList()).getByText(SHA256_ABC)).toBeInTheDocument());
  });

  it("marks the matching algorithm when a correct checksum is pasted", async () => {
    render(<HashGenerator />);
    fireEvent.change(screen.getByLabelText("Text to hash"), { target: { value: "abc" } });
    await waitFor(() => expect(within(digestList()).getByText(SHA256_ABC)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/verify a checksum/i), {
      target: { value: SHA256_ABC },
    });
    await waitFor(() =>
      expect(screen.getByText(/matches the SHA-256 digest/i)).toBeInTheDocument()
    );
  });

  it("reports a mismatch for a wrong checksum", async () => {
    render(<HashGenerator />);
    fireEvent.change(screen.getByLabelText("Text to hash"), { target: { value: "abc" } });
    await waitFor(() => expect(within(digestList()).getByText(SHA256_ABC)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/verify a checksum/i), {
      target: { value: "deadbeef" },
    });
    await waitFor(() => expect(screen.getByText(/no match/i)).toBeInTheDocument());
  });

  it("uppercases the hex when the toggle is on", async () => {
    render(<HashGenerator />);
    fireEvent.change(screen.getByLabelText("Text to hash"), { target: { value: "abc" } });
    await waitFor(() => expect(within(digestList()).getByText(SHA256_ABC)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/uppercase hex/i));
    await waitFor(() =>
      expect(within(digestList()).getByText(SHA256_ABC.toUpperCase())).toBeInTheDocument()
    );
  });

  it("computes an HMAC in HMAC mode", async () => {
    render(<HashGenerator />);
    fireEvent.click(screen.getByRole("tab", { name: /hmac/i }));
    fireEvent.change(screen.getByLabelText("HMAC message"), {
      target: { value: "The quick brown fox jumps over the lazy dog" },
    });
    fireEvent.change(screen.getByLabelText("Secret key"), { target: { value: "key" } });
    await waitFor(() =>
      expect(
        screen.getByText("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8")
      ).toBeInTheDocument()
    );
  });

  it("switches to File mode and shows the drop zone", () => {
    render(<HashGenerator />);
    fireEvent.click(screen.getByRole("tab", { name: /file/i }));
    expect(screen.getByLabelText(/choose or drop a file to hash/i)).toBeInTheDocument();
  });
});
