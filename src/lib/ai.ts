import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { after } from "next/server"
import { redis } from "./redis"
import { checkNarrativeRateLimit } from "./ratelimit"
import type { RepoData } from "./github"
import type { ScoreBreakdown } from "./scoring"

// Defaults to Anthropic's official API. Any Anthropic-compatible endpoint
// works via env override — e.g. DeepSeek: set
//   ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic/v1
//   ANTHROPIC_API_KEY=<DeepSeek key>
//   AI_MODEL=deepseek-chat
const anthropic = createAnthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
})
const AI_MODEL = process.env.AI_MODEL || "claude-haiku-4-5"

// Narratives are cached for 6 hours — the same window as the underlying repo
// data — so repeated views of a popular comparison cost one LLM call, not one
// per visitor. Keyed on names + totals + model: if the scores shift when the
// data cache refreshes, a fresh narrative is generated automatically. Keys
// are direction-specific on purpose: the narrative labels the repos by
// position, so "A vs B" text must not be reused for "B vs A".
const NARRATIVE_TTL_SECONDS = 21_600

function narrativeCacheKey(
  a: RepoData,
  b: RepoData,
  scoreA: ScoreBreakdown,
  scoreB: ScoreBreakdown,
  isCloseCall: boolean
): string {
  return `narrative:v1:${AI_MODEL}:${a.full_name}:${scoreA.total}:${b.full_name}:${scoreB.total}:${isCloseCall ? 1 : 0}`
}

async function getCachedNarrative(key: string): Promise<string | null> {
  if (!redis) return null
  try {
    return await redis.get<string>(key)
  } catch {
    return null
  }
}

async function cacheNarrative(key: string, text: string): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, text, { ex: NARRATIVE_TTL_SECONDS })
  } catch (e) {
    console.error("[ai] cacheNarrative failed:", e)
  }
}

async function generateComparison(
  a: RepoData,
  scoreA: ScoreBreakdown,
  b: RepoData,
  scoreB: ScoreBreakdown,
  isCloseCall: boolean
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  // Keep the AI's tone consistent with the UI badge: when scores are close
  // the page shows "势均力敌", so the narrative must not flatly pick a winner.
  const stance = isCloseCall
    ? "两者综合评分接近，不要武断推荐某一方；请说明两者各自的优势维度，以及什么场景下更适合选哪个。"
    : "给出明确的选型建议。"

  const prompt = `你是一个开源项目分析师。根据以下数据，用中文写一段简洁的项目对比分析（150字以内）。${stance}

项目A: ${a.full_name}
- Stars: ${a.stars}, 近30天commits: ${a.commits_30d}, 贡献者: ${a.contributors_30d}
- 综合评分: ${scoreA.total}/100 (活跃度:${scoreA.activity} 社区健康:${scoreA.community} 响应速度:${scoreA.responsiveness} 稳定性:${scoreA.stability})
- 语言: ${a.language}, 许可证: ${a.license}

项目B: ${b.full_name}
- Stars: ${b.stars}, 近30天commits: ${b.commits_30d}, 贡献者: ${b.contributors_30d}
- 综合评分: ${scoreB.total}/100 (活跃度:${scoreB.activity} 社区健康:${scoreB.community} 响应速度:${scoreB.responsiveness} 稳定性:${scoreB.stability})
- 语言: ${b.language}, 许可证: ${b.license}

直接给出结论和理由，不要重复列举数字。输出纯文本，不要使用任何 Markdown 标记（如 ** 或 #）。`

  try {
    const { text } = await generateText({
      model: anthropic(AI_MODEL),
      prompt,
      maxOutputTokens: 300,
    })
    return text
  } catch {
    return null
  }
}

export type NarrativeResult =
  | { status: "ok"; text: string }
  | { status: "rate_limited"; retryAfterMinutes: number }
  | { status: "unavailable" }

// The full narrative pipeline: cache → rate limit → generate → cache write.
// Cache hits cost nothing and don't consume the caller's rate-limit budget;
// the cache write happens after the response so it never delays rendering.
export async function resolveNarrative(
  a: RepoData,
  scoreA: ScoreBreakdown,
  b: RepoData,
  scoreB: ScoreBreakdown,
  isCloseCall: boolean,
  ip: string
): Promise<NarrativeResult> {
  const key = narrativeCacheKey(a, b, scoreA, scoreB, isCloseCall)

  const cached = await getCachedNarrative(key)
  if (cached) return { status: "ok", text: cached }

  const { allowed, retryAfterMinutes } = await checkNarrativeRateLimit(ip)
  if (!allowed) return { status: "rate_limited", retryAfterMinutes: retryAfterMinutes ?? 1 }

  const text = await generateComparison(a, scoreA, b, scoreB, isCloseCall)
  if (!text) return { status: "unavailable" }

  after(() => cacheNarrative(key, text))
  return { status: "ok", text }
}
