import Link from "next/link"
import { CompareForm } from "@/components/CompareForm"
import { getTopComparisons } from "@/lib/leaderboard"

const FALLBACK_EXAMPLES: [string, string][] = [
  ["prisma/prisma", "drizzle-team/drizzle-orm"],
  ["envoyproxy/ai-gateway", "higress-group/higress"],
  ["gin-gonic/gin", "gofiber/fiber"],
]

const LEADERBOARD_SIZE = 5

export default async function Home() {
  const leaderboard = await getTopComparisons(LEADERBOARD_SIZE)
  const examples: [string, string][] =
    leaderboard.length > 0
      ? leaderboard.map((e) => [e.a, e.b] as [string, string])
      : FALLBACK_EXAMPLES

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-sm text-emerald-600 font-medium mb-4 bg-emerald-50 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />
            OSS Radar
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            开源项目健康度对比
          </h1>
          <p className="text-gray-500 text-lg">
            基于 GitHub 真实数据，AI 辅助分析，帮你做更好的技术选型决策
          </p>
        </div>

        <CompareForm />

        <div className="mt-10">
          <p className="text-xs text-gray-400 mb-3 text-center">
            {leaderboard.length > 0 ? "大家都在对比" : "试试这些热门对比"}
          </p>
          <div className="flex flex-col gap-2">
            {examples.map(([ra, rb]) => (
              <Link
                key={`${ra}-${rb}`}
                href={`/compare/${encodeURIComponent(ra)}/${encodeURIComponent(rb)}`}
                className="text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors text-left"
              >
                {ra} <span className="text-gray-300 mx-1">vs</span> {rb}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
