import type { ProviderResult, GitHubData, CommitRow, ReleaseRow, DeploymentRow } from "../types";
import { emptyGitHub } from "../empty";
import { getJson, asObj, asArr, asStr, errMsg } from "./http";

/**
 * GitHub provider (REST API v3).
 *
 * Live when GITHUB_TOKEN is set (gated so behaviour is deterministic and avoids
 * unauthenticated rate limits). Fetches recent commits, releases, and deployments
 * for the configured repository (GITHUB_REPO, default "EasyTechLabs/esytol").
 */
const REPO = process.env.GITHUB_REPO ?? "EasyTechLabs/esytol";

export function isConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

export async function fetchGitHub(now: Date): Promise<ProviderResult<GitHubData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "unconfigured",
      data: emptyGitHub(),
      note: "GitHub not configured — set GITHUB_TOKEN and GITHUB_REPO.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await fetchRepo(), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: emptyGitHub(),
      note: `Live GitHub fetch failed (${errMsg(err)}).`,
      fetchedAt,
    };
  }
}

async function fetchRepo(): Promise<GitHubData> {
  const headers = {
    authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
  };
  const base = `https://api.github.com/repos/${REPO}`;

  const [commitsJson, releasesJson, deploymentsJson] = await Promise.all([
    getJson(`${base}/commits?per_page=8`, headers),
    getJson(`${base}/releases?per_page=5`, headers),
    getJson(`${base}/deployments?per_page=5`, headers),
  ]);

  const commits: CommitRow[] = asArr(commitsJson).map((c) => {
    const row = asObj(c);
    const commit = asObj(row.commit);
    const author = asObj(commit.author);
    return {
      sha: asStr(row.sha).slice(0, 7),
      message: asStr(commit.message).split("\n")[0],
      author: asStr(author.name),
      date: asStr(author.date),
    };
  });

  const releases: ReleaseRow[] = asArr(releasesJson).map((r) => {
    const row = asObj(r);
    return {
      tag: asStr(row.tag_name),
      name: asStr(row.name) || asStr(row.tag_name),
      date: asStr(row.published_at),
    };
  });

  const deployments: DeploymentRow[] = asArr(deploymentsJson).map((d) => {
    const row = asObj(d);
    return {
      id: asStr(row.id ? String(row.id) : ""),
      environment: asStr(row.environment) || "Production",
      state: "success",
      date: asStr(row.created_at),
      ref: asStr(row.ref),
    };
  });

  return { repo: REPO, defaultBranch: "main", commits, releases, deployments };
}
