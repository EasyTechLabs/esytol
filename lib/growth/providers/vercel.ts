import type { ProviderResult, VercelData, VercelBuildRow } from "../types";
import { sampleVercel } from "../sample";
import { getJson, asObj, asArr, asNum, asStr, errMsg } from "./http";

/**
 * Vercel provider (REST API v6 deployments).
 *
 * Live when VERCEL_TOKEN and VERCEL_PROJECT_ID are set. Fetches recent
 * deployments/builds; Core Web Vitals are merged from the sample baseline until a
 * Speed Insights export is wired.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export async function fetchVercel(now: Date): Promise<ProviderResult<VercelData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "sample",
      data: sampleVercel(now),
      note: "Sample data — set VERCEL_TOKEN and VERCEL_PROJECT_ID to load live deployment data.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await fetchDeployments(now), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: sampleVercel(now),
      note: `Live Vercel fetch failed (${errMsg(err)}). Showing sample data.`,
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

  const baseline = sampleVercel(now);
  const first = builds[0];
  const productionUrl = baseline.productionUrl;

  return {
    project,
    productionUrl,
    latest: first
      ? { state: first.state, target: first.target, createdAt: first.createdAt, url: productionUrl }
      : baseline.latest,
    builds: builds.length ? builds : baseline.builds,
    performance: baseline.performance,
  };
}
