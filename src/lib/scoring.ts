/**
 * Scoring algorithm aligned with CHAOSS Framework (Linux Foundation)
 * https://chaoss.community/kb/metrics-model-starter-project-health/
 *
 * Dimensions:
 * - Activity (30%):       CHAOSS Change Request Closure Ratio + commit velocity
 * - Community (30%):      CHAOSS Contributor Absence Factor + Organizational Diversity
 * - Responsiveness (20%): CHAOSS Time to First Response
 * - Stability (15%):      CHAOSS Release Frequency + OpenSSF security policy
 * - Adoption (5%):        Stars/forks log-scaled
 */

import { clamp } from "./utils"
import type { RepoData } from "./github"

export interface ScoreBreakdown {
  activity: number
  community: number
  responsiveness: number
  stability: number
  adoption: number
  total: number
}

export interface ScoreMeta {
  activity_signal: string
  community_signal: string
  responsiveness_signal: string
  stability_signal: string
  adoption_signal: string
}

export function score(repo: RepoData): ScoreBreakdown {
  // Activity: commit velocity + merged PR rate + PR closure ratio
  const commitScore = clamp((repo.commits_30d / 60) * 100)
  const prMergeScore = clamp((repo.merged_prs_30d / 40) * 100)
  const prClosureScore = clamp(repo.pr_closure_ratio * 100)
  const activity = Math.round(commitScore * 0.5 + prMergeScore * 0.3 + prClosureScore * 0.2)

  // Community: bus factor + elephant factor + active contributor count
  const topContribs = repo.top_contributors
  const totalContribs = topContribs.reduce((s, c) => s + c.contributions, 0)
  const topShare = totalContribs > 0 && topContribs.length > 0
    ? topContribs[0].contributions / totalContribs
    : 1
  const busScore = clamp((1 - topShare) * 150)
  const contribCountScore = clamp((repo.contributors_30d / 15) * 100)
  const community = Math.round(busScore * 0.4 + repo.elephant_score * 0.35 + contribCountScore * 0.25)

  // Responsiveness: CHAOSS Time to First Response + PR closure velocity
  let responseScore = 50
  if (repo.issue_response_days !== null) {
    responseScore = clamp(100 - repo.issue_response_days * 7)
  }
  const responsiveness = Math.round(responseScore * 0.7 + prClosureScore * 0.3)

  // Stability: days since push + release frequency + security policy
  // security policy is treated as 0–100 input (true=100, false=0) so weight is meaningful
  const daysSincePush = (Date.now() - new Date(repo.pushed_at).getTime()) / 86400000
  const pushScore = clamp(100 - daysSincePush * 3)
  const releaseScore = repo.releases.some(
    (r) => Date.now() - new Date(r.date).getTime() < 90 * 86400000
  ) ? 85 : 40
  const securityScore = repo.has_security_policy ? 100 : 0
  const stability = Math.round(pushScore * 0.45 + releaseScore * 0.45 + securityScore * 0.10)

  // Adoption: log-scaled stars + forks
  const starScore = clamp(Math.log10(repo.stars + 1) * 20)
  const forkScore = clamp(Math.log10(repo.forks + 1) * 25)
  const adoption = Math.round(starScore * 0.6 + forkScore * 0.4)

  const total = Math.round(
    activity * 0.30 +
    community * 0.30 +
    responsiveness * 0.20 +
    stability * 0.15 +
    adoption * 0.05
  )

  return { activity, community, responsiveness, stability, adoption, total }
}

export function scoreMeta(repo: RepoData, s: ScoreBreakdown): ScoreMeta {
  return {
    activity_signal:
      repo.merged_prs_30d >= 30
        ? `近30天合并 ${repo.merged_prs_30d} 个 PR，非常活跃`
        : repo.merged_prs_30d >= 10
        ? `近30天合并 ${repo.merged_prs_30d} 个 PR`
        : `近30天仅合并 ${repo.merged_prs_30d} 个 PR，活跃度偏低`,

    community_signal:
      repo.elephant_score >= 70
        ? "贡献者来自多个组织，社区健康"
        : repo.elephant_score >= 40
        ? "贡献者组织多样性一般"
        : "贡献者高度集中于单一组织，存在控制风险",

    responsiveness_signal:
      repo.issue_response_days === null
        ? "响应时间数据不足"
        : repo.issue_response_days < 1
        ? "Issue 首次响应中位数 < 1天，响应极快"
        : `Issue 首次响应中位数约 ${repo.issue_response_days.toFixed(1)} 天`,

    stability_signal: repo.has_security_policy
      ? "有 SECURITY.md，具备安全漏洞响应流程"
      : "缺少 SECURITY.md，安全响应流程未公开",

    adoption_signal:
      repo.stars >= 5000
        ? `${(repo.stars / 1000).toFixed(1)}k Stars，社区认可度高`
        : `${repo.stars} Stars`,
  }
}

// Single source of truth for score bands — verdict text on the compare page
// and badge colors both derive from these thresholds.
export type ScoreBand = "excellent" | "active" | "maintained" | "attention"

export function scoreBand(total: number): ScoreBand {
  if (total >= 78) return "excellent"
  if (total >= 58) return "active"
  if (total >= 38) return "maintained"
  return "attention"
}

const VERDICT_TEXT: Record<ScoreBand, string> = {
  excellent: "非常健康",
  active: "较为活跃",
  maintained: "维护中",
  attention: "需关注",
}

export function verdict(s: ScoreBreakdown): string {
  return VERDICT_TEXT[scoreBand(s.total)]
}

// Below this gap, the two projects are close enough that calling one a clear
// "leader" would overstate the confidence the data supports. Consumers (UI
// badge, AI narrative tone) must all read the same threshold from here.
const CLOSE_SCORE_GAP = 10

export function isCloseCall(a: ScoreBreakdown, b: ScoreBreakdown): boolean {
  return Math.abs(a.total - b.total) < CLOSE_SCORE_GAP
}

export interface DimensionMeta {
  key: keyof ScoreBreakdown
  label: string
  basis: string
}

export const DIMENSIONS: DimensionMeta[] = [
  { key: "activity",       label: "活跃度",   basis: "近30天提交数 + PR合并速度 + PR关闭率（CHAOSS: Change Request Closure Ratio）" },
  { key: "community",      label: "社区健康", basis: "贡献者集中度（Bus Factor）× 企业多元性（Elephant Factor），来源：CHAOSS" },
  { key: "responsiveness", label: "响应速度", basis: "Issue 首次获得非作者回复的中位天数（CHAOSS: Time to First Response）" },
  { key: "stability",      label: "稳定性",   basis: "发布频率 + 是否有 SECURITY.md 安全策略（CHAOSS: Release Frequency）" },
  { key: "adoption",       label: "采用度",   basis: "Stars 和 Forks 数量（对数缩放），反映社区实际使用规模" },
]
