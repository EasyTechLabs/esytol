import type { NextResponse } from "next/server";
import { forwardToApi } from "@/lib/udharpe/admin-forward";

export async function GET(request: Request): Promise<NextResponse> {
  // Clamped here as well as upstream. A client asking for a million rows is
  // usually a mistake, and the server should not be the only thing that says so.
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 200) : 50;
  return forwardToApi({ path: `/api/v1/admin/audit?limit=${limit}`, method: "GET", request });
}
