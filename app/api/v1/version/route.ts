import {
  ENGINE_VERSION,
  SUPPORTED_ASSESSMENT_YEARS,
  DEFAULT_ASSESSMENT_YEAR,
} from "@/lib/incomeTax";
import { API_VERSION } from "@/lib/incomeTaxApi";
import { jsonResponse, preflight } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/** Version metadata: engine + API version and the supported assessment years. */
export async function GET(): Promise<Response> {
  return jsonResponse({
    apiVersion: API_VERSION,
    engineVersion: ENGINE_VERSION,
    supportedAssessmentYears: SUPPORTED_ASSESSMENT_YEARS,
    defaultAssessmentYear: DEFAULT_ASSESSMENT_YEAR,
  });
}
