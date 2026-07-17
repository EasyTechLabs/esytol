import type { ProviderResult, VercelData, VercelBuildRow } from "../types";
import { emptyVercel } from "../empty";
import { getJson, asObj, asArr, asNum, asStr, errMsg } from "./http";

/**
 * Vercel provider (REST API v6 deployments).
 *
 * Live when VERCEL_TOKEN and VERCEL_PROJECT_ID are set. Fetches recent
 * deployments/builds; Core Web Vitals have no export API on this plan and stay
 * empty with a note rather than being fabricated —
 * Speed Insights export is wired.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export async function fetchVercel(now: Date): Promise<ProviderResult<VercelData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "unconfigured",
      data: emptyVercel(),
      note: "Vercel not configured — set VERCEL_TOKEN and VERCEL_PROJECT_ID.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await fetchDeployments(now), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: emptyVercel(),
      note: `Live Vercel fetch failed (${errMsg(err)}).`,
      fetchedAt,
    };
  }
}

async function fetchDeployments(now: Date): Promise<VercelData> {
  const project = process.env.VERCEL_PROJECT_ID as string;
  const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
  const headers = { authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  const url = `https://api.vercel.com/v6/deployments?projectId=${project}&limit=8${team}`;

  const json = await getJson(url, headers);
  const deployments = asArr(asObj(json).deployments);

  const builds: VercelBuildRow[] = deployments.map((d) => {
    const row = asObj(d);
    const meta = asObj(row.meta);
    const created = asNum(row.created || row.createdAt);
    return {
      id: asStr(row.uid),
      state: asStr(row.readyState || row.state) || "READY",
      target: asStr(row.target) || "production",
      createdAt: created ? new Date(created).toISOString() : now.toISOString(),
      commit: asStr(meta.githubCommitRef) || asStr(meta.githubCommitSha).slice(0, 7),
      durationSec: 0,
    };
  });

  const first = builds[0];
  const productionUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return {
    project,
    productionUrl,
    latest: first
      ? { state: first.state, target: first.target, createdAt: first.createdAt, url: productionUrl }
      : emptyVercel().latest,
    builds,
    // Core Web Vitals come from Vercel Speed Insights, which has no export API on
    // this plan — empty is the truth, not a placeholder (P0-3).
    performance: [],
  };
}
