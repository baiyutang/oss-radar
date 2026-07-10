import { unstable_cache } from "next/cache"
import { clamp } from "./utils"

const GITHUB_API = "https://api.github.com"
const FETCH_TIMEOUT_MS = 10_000

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
}

export class GitHubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "GitHubApiError"
    this.status = status
  }
}

export interface RepoData {
  full_name: string
  description: string
  stars: number
  forks: number
  open_issues: number
  watchers: number
  created_at: string
  updated_at: string
  pushed_at: string
  language: string
  license: string | null
  topics: string[]
  size: number
  // activity
  commits_30d: number
  contributors_30d: number
  merged_prs_30d: number
  open_prs: number
  pr_closure_ratio: number   // CHAOSS: Change Request Closure Ratio
  // community
  top_contributors: { login: string; contributions: number }[]
  elephant_score: number     // CHAOSS: Organizational Diversity (0-100, higher=more diverse)
  // responsiveness
  issue_response_days: number | null  // CHAOSS: Time to First Response (median, days)
  // stability
  releases: { tag: string; date: string }[]
  has_security_policy: boolean
  // adoption
  npm_downloads?: number
}

async function get<T>(path: string, optional = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${GITHUB_API}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    if (optional) return null as T
    throw new GitHubApiError(0, "GitHub API request timed out or failed")
  }
  if (!res.ok) {
    if (optional) return null as T
    throw new GitHubApiError(res.status, res.statusText || String(res.status))
  }
  try {
    return await res.json()
  } catch {
    if (optional) return null as T
    throw new GitHubApiError(res.status, "GitHub API returned an invalid response")
  }
}

async function getIssueFirstResponseDays(owner: string, repo: string): Promise<number | null> {
  try {
    // Use issues-only filter to avoid fetching PRs and then discarding them
    const issues = await get<any[]>(
      `/repos/${owner}/${repo}/issues?state=closed&per_page=10&sort=updated&direction=desc&pulls=false`
    )
    const realIssues = issues.filter((i) => !i.pull_request).slice(0, 5)
    if (realIssues.length === 0) return null

    const responseTimes = await Promise.all(
      realIssues.map(async (issue) => {
        try {
          const comments = await get<any[]>(
            `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=5`
          )
          const firstExternal = comments.find((c) => c.user?.login !== issue.user?.login)
          if (!firstExternal) return null
          const ms = new Date(firstExternal.created_at).getTime() - new Date(issue.created_at).getTime()
          return ms >= 0 ? ms / 86400000 : null
        } catch {
          return null
        }
      })
    )

    const valid = responseTimes.filter((v): v is number => v !== null)
    if (valid.length === 0) return null
    valid.sort((a, b) => a - b)
    return valid[Math.floor(valid.length / 2)]
  } catch {
    return null
  }
}

async function getElephantScore(contributors: any[]): Promise<number> {
  if (contributors.length === 0) return 50
  try {
    const top5 = contributors.slice(0, 5)
    const totalContribs = top5.reduce((s: number, c: any) => s + c.contributions, 0)
    if (totalContribs === 0) return 50

    const profiles = await Promise.all(
      top5.map((c) => get<any>(`/users/${c.login}`, true))
    )

    // Count contributors with known org vs unknown
    const knownOrgs: Record<string, number> = {}
    let unknownContribs = 0

    top5.forEach((c, i) => {
      const company = profiles[i]?.company
      if (!company || !company.trim()) {
        unknownContribs += c.contributions
        return
      }
      const org = company.toLowerCase().replace(/^@/, "").trim()
      knownOrgs[org] = (knownOrgs[org] || 0) + c.contributions
    })

    // If we can't determine org for anyone, return neutral
    if (unknownContribs === totalContribs) return 50

    const knownTotal = totalContribs - unknownContribs
    if (knownTotal === 0) return 50

    const maxOrgShare = Math.max(...Object.values(knownOrgs)) / knownTotal
    return clamp((1 - maxOrgShare) * 130)
  } catch {
    return 50
  }
}

async function fetchRepoDataUncached(owner: string, repo: string): Promise<RepoData> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Round 1: all independent fetches in parallel (including npm)
  const npmName = repo.toLowerCase()
  const [info, commits, contributorsRaw, closedPrs, openPrs, releases, securityPolicy, npmRes] =
    await Promise.all([
      get<any>(`/repos/${owner}/${repo}`),
      get<any[]>(`/repos/${owner}/${repo}/commits?since=${since}&per_page=100`),
      get<any[]>(`/repos/${owner}/${repo}/contributors?per_page=10`, true),
      get<any[]>(`/repos/${owner}/${repo}/pulls?state=closed&per_page=50&sort=updated&direction=desc`),
      get<any[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=50`),
      get<any[]>(`/repos/${owner}/${repo}/releases?per_page=5`),
      get<any>(`/repos/${owner}/${repo}/contents/SECURITY.md`, true),
      fetch(`https://api.npmjs.org/downloads/point/last-month/${npmName}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).catch(() => null),
    ])
  // Contributors listing can come back empty/malformed while GitHub computes
  // stats for a new or very large repo — degrade to "unknown" rather than 500.
  const contributors = Array.isArray(contributorsRaw) ? contributorsRaw : []

  // Round 2: derived fetches that depend on Round 1 results
  const [elephantScore, issueResponseDays] = await Promise.all([
    getElephantScore(contributors),
    getIssueFirstResponseDays(owner, repo),
  ])

  const mergedPrs30d = closedPrs.filter(
    (p) => p.merged_at && new Date(p.merged_at) >= new Date(since)
  ).length
  const openPrsCount = openPrs.length
  const prClosureRatio =
    mergedPrs30d + openPrsCount > 0 ? mergedPrs30d / (mergedPrs30d + openPrsCount) : 0

  const uniqueAuthors = new Set(commits.map((c: any) => c.commit?.author?.name)).size

  let npm_downloads: number | undefined
  const lang = info.language
  if ((lang === "JavaScript" || lang === "TypeScript") && npmRes?.ok) {
    try {
      const d = await npmRes.json()
      if (d.downloads && d.package === npmName) npm_downloads = d.downloads
    } catch {}
  }

  return {
    full_name: info.full_name,
    description: info.description || "",
    stars: info.stargazers_count,
    forks: info.forks_count,
    open_issues: info.open_issues_count,
    watchers: info.watchers_count,
    created_at: info.created_at,
    updated_at: info.updated_at,
    pushed_at: info.pushed_at,
    language: lang || "Unknown",
    license: info.license?.spdx_id || null,
    topics: info.topics || [],
    size: info.size,
    commits_30d: commits.length,
    contributors_30d: uniqueAuthors,
    merged_prs_30d: mergedPrs30d,
    open_prs: openPrsCount,
    pr_closure_ratio: prClosureRatio,
    top_contributors: contributors.slice(0, 5).map((c: any) => ({
      login: c.login,
      contributions: c.contributions,
    })),
    elephant_score: elephantScore,
    issue_response_days: issueResponseDays,
    releases: releases.map((r: any) => ({ tag: r.tag_name, date: r.published_at })),
    has_security_policy: !!securityPolicy,
    npm_downloads,
  }
}

// Cache per owner/repo for 6 hours — 30-day activity metrics don't shift
// meaningfully hour to hour, so this trades near-zero staleness risk for a
// large cut in GitHub token usage and near-instant repeat comparisons.
export const fetchRepoData = unstable_cache(
  fetchRepoDataUncached,
  ["fetch-repo-data"],
  { revalidate: 21_600 }
)
