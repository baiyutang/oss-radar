import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import type { RepoData } from "./github"
import type { ScoreBreakdown } from "./scoring"

export async function generateComparison(
  a: RepoData,
  scoreA: ScoreBreakdown,
  b: RepoData,
  scoreB: ScoreBreakdown,
  isCloseCall = false
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

直接给出结论和理由，不要重复列举数字。`

  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      prompt,
      maxOutputTokens: 300,
    })
    return text
  } catch {
    return null
  }
}
