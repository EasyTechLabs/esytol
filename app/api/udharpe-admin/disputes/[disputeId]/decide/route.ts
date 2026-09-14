import { NextResponse } from "next/server";
import { forwardToApi, UUID } from "@/lib/udharpe/admin-forward";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ disputeId: string }> }
): Promise<NextResponse> {
  const { disputeId } = await params;
  if (!UUID.test(disputeId)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No such endpoint." } },
      { status: 404 }
    );
  }
  return forwardToApi({
    path: `/api/v1/admin/disputes/${disputeId}/decide`,
    method: "POST",
    request,
  });
}
