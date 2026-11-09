import { describe, expect, it } from "vitest";
import { directoryPath } from "@/lib/udharpe/admin-directory";

const at = (qs: string) => `https://www.esytol.com/api/udharpe-admin/x${qs}`;

describe("the admin directory's upstream path", () => {
  it("forwards a trimmed search and a default page size", () => {
    expect(directoryPath("shops", at("?q=%20kirana%20"))).toBe(
      "/api/v1/admin/shops?q=kirana&limit=50"
    );
  });

  it("clamps the page size and caps the search length", () => {
    const path = directoryPath("people", at(`?limit=100000&q=${"a".repeat(300)}`));
    expect(path).toContain("limit=200");
    expect(new URL(`https://x${path}`).searchParams.get("q")).toHaveLength(100);
    expect(directoryPath("people", at("?limit=-4"))).toContain("limit=1");
  });

  it("passes a known relationship status, and only for relationships", () => {
    expect(directoryPath("relationships", at("?status=active"))).toContain("status=active");
    expect(directoryPath("relationships", at("?status=friends"))).not.toContain("status=");
    expect(directoryPath("shops", at("?status=active"))).not.toContain("status=");
  });

  it("drops every other parameter", () => {
    const path = directoryPath("people", at("?q=a&merchantId=x&admin=true"));
    expect(path).toBe("/api/v1/admin/people?q=a&limit=50");
  });
});
