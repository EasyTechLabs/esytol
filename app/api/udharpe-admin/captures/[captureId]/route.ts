import { NextResponse } from "next/server";
import { forwardToApi, UUID } from "@/lib/udharpe/admin-forward";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ captureId: string }> }
): Promise<NextResponse> {
  const { captureId } = await params;
  if (!UUID.test(captureId)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such endpoint." } },
      { status: 404 }
    );
  }
  return forwardToApi({
    path: `/api/v1/admin/captures/${captureId}`,
    method: "GET",
    request,
  });
}
