import type { NextResponse } from "next/server";
import { forwardToApi } from "@/lib/udharpe/admin-forward";

export async function GET(request: Request): Promise<NextResponse> {
  return forwardToApi({ path: "/api/v1/admin/disputes", method: "GET", request });
}
