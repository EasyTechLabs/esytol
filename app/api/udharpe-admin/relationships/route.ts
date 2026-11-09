import type { NextResponse } from "next/server";
import { forwardToApi } from "@/lib/udharpe/admin-forward";
import { directoryPath } from "@/lib/udharpe/admin-directory";

export async function GET(request: Request): Promise<NextResponse> {
  return forwardToApi({
    path: directoryPath("relationships", request.url),
    method: "GET",
    request,
  });
}
