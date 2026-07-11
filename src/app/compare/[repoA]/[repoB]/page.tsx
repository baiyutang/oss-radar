import { Fragment, Suspense } from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { after } from "next/server"
import { fetchRepoData, GitHubApiError, type RepoData } from "@/lib/github"
import { score, scoreMeta, verdict } from "@/lib/scoring"
import { generateComparison } from "@/lib/ai"
import { checkNarrativeRateLimit } from "@/lib/ratelimit"
import { recordComparison } from "@/lib/leaderboard"
import { ScoreBar } from "@/components/ScoreBar"
import { ScoreRing } from "@/components/ScoreRing"
import { StatCard } from "@/components/StatCard"
import { CopyLinkButton } from "@/components/CopyLinkButton"
import { isValidRepoPart, getClientIp } from "@/lib/utils"
import Link from "next/link"

interface Props {
  params: Promise<{ repoA: string; repoB: string }>
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function daysSince(date: string): string {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return "今天"
  if (d < 30) return `${d}天前`
  if (d < 365) return `${Math.floor(d / 30)}个月前`
  return `${Math.floor(d / 365)}年前`
}

function safeDecodeRepo(raw: string): [string, string] | null {
  try {
    const decoded = decodeURIComponent(raw)
    const slash = decoded.indexOf("/")
    if (slash <= 0 || slash === decoded.length - 1) return null
    const owner = decoded.slice(0, slash)
    const name = decoded.slice(slash + 1)
    if (!isValidRepoPart(owner) || !isValidRepoPart(name)) return null
    return [owner, name]
  } catch {
    return null
  }
}

// Built from route params only — no extra API calls, so metadata never slows
// the page down or burns GitHub quota.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { repoA, repoB } = await params
  const parsedA = safeDecodeRepo(repoA)
  const parsedB = safeDecodeRepo(repoB)
  if (!parsedA || !parsedB) {
    return { title: "OSS Radar — 开源项目健康度对比" }
  }
  const a = parsedA.join("/")
  const b = parsedB.join("/")
  const title = `${a} vs ${b} 对比 — 开源项目健康度评分 | OSS Radar`
  const description = `${a} 和 ${b} 哪个更值得选？基于 CHAOSS 框架的五维健康度对比：活跃度、社区健康、响应速度、稳定性、采用度，数据来自 GitHub API。`
  return {
    title,
    description,
    keywords: [a, b, `${a} vs ${b}`, `${parsedA[1]} vs ${parsedB[1]}`, "开源项目对比", "技术选型", "CHAOSS"],
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
}

async function Narrative({
  dataA, scoreA, dataB, scoreB,
}: {
  dataA: RepoData
  scoreA: ReturnType<typeof score>
  dataB: RepoData
  scoreB: ReturnType<typeof score>
}) {
  const ip = getClientIp(await headers())
  const { allowed, retryAfterMinutes } = await checkNarrativeRateLimit(ip)

  if (!allowed) {
    return (
      <div className="bg-amber-50 rounded-2xl p-5 mb-5 border border-amber-100">
        <div className="text-xs text-amber-600 font-medium mb-1">AI 综合分析</div>
        <p className="text-amber-700 text-sm">
          AI 分析请求较为频繁，请约 {retryAfterMinutes} 分钟后重试 — 评分数据不受影响。
        </p>
      </div>
    )
  }

  const narrative = await generateComparison(dataA, scoreA, dataB, scoreB)
  if (!narrative) return null
  return (
    <div className="bg-white rounded-2xl p-5 mb-5 border border-gray-100">
      <div className="text-xs text-blue-600 font-medium mb-2">AI 综合分析</div>
      <p className="text-gray-700 text-sm leading-relaxed">{narrative}</p>
    </div>
  )
}

function NarrativeSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 mb-5 border border-gray-100">
      <div className="text-xs text-blue-600 font-medium mb-2">AI 综合分析</div>
      <div className="space-y-2 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  )
}

const DIMENSIONS: { key: keyof ReturnType<typeof score>; label: string; basis: string }[] = [
  { key: "activity",       label: "活跃度",   basis: "近30天提交数 + PR合并速度 + PR关闭率（CHAOSS: Change Request Closure Ratio）" },
  { key: "community",      label: "社区健康", basis: "贡献者集中度（Bus Factor）× 企业多元性（Elephant Factor），来源：CHAOSS" },
  { key: "responsiveness", label: "响应速度", basis: "Issue 首次获得非作者回复的中位天数（CHAOSS: Time to First Response）" },
  { key: "stability",      label: "稳定性",   basis: "发布频率 + 是否有 SECURITY.md 安全策略（CHAOSS: Release Frequency）" },
  { key: "adoption",       label: "采用度",   basis: "Stars 和 Forks 数量（对数缩放），反映社区实际使用规模" },
]

export default async function ComparePage({ params }: Props) {
  const { repoA, repoB } = await params

  const parsedA = safeDecodeRepo(repoA)
  const parsedB = safeDecodeRepo(repoB)

  if (!parsedA || !parsedB) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">无效的仓库地址格式</p>
          <Link href="/" className="text-gray-500 underline">返回</Link>
        </div>
      </main>
    )
  }

  const [ownerA, nameA] = parsedA
  const [ownerB, nameB] = parsedB

  let dataA, dataB, scoreA, scoreB, metaA, metaB, error

  try {
    ;[dataA, dataB] = await Promise.all([
      fetchRepoData(ownerA, nameA),
      fetchRepoData(ownerB, nameB),
    ])
    scoreA = score(dataA)
    scoreB = score(dataB)
    metaA = scoreMeta(dataA, scoreA)
    metaB = scoreMeta(dataB, scoreB)

    const ip = getClientIp(await headers())
    after(() => recordComparison(dataA!.full_name, dataB!.full_name, ip))
  } catch (e: any) {
    if (e instanceof GitHubApiError && e.status === 403) {
      error = "GitHub API 请求过多，请稍后再试"
    } else if (e instanceof GitHubApiError && e.status === 404) {
      error = "仓库不存在，请检查名称是否正确"
    } else {
      error = "数据加载失败，请稍后重试"
    }
    console.error("[compare]", e?.message)
  }

  if (error || !dataA || !dataB || !scoreA || !scoreB || !metaA || !metaB) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "加载失败"}</p>
          <Link href="/" className="text-gray-500 underline">返回</Link>
        </div>
      </main>
    )
  }

  const winnerTotal = scoreA.total > scoreB.total ? "a" : scoreB.total > scoreA.total ? "b" : "tie"
  // Below this gap, the two projects are close enough that calling one a
  // clear "leader" would overstate the confidence the data supports.
  const CLOSE_SCORE_GAP = 10
  const isCloseCall = Math.abs(scoreA.total - scoreB.total) < CLOSE_SCORE_GAP

  const sides = [
    { data: dataA, s: scoreA, meta: metaA, name: nameA, side: "a" as const },
    { data: dataB, s: scoreB, meta: metaB, name: nameB, side: "b" as const },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">

        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 重新对比</Link>
          <span className="text-xs text-gray-400">基于 CHAOSS 框架 · GitHub API 实时数据</span>
        </div>

        {/* Repo cards */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center mb-6">
          {sides.map(({ data, s, side }, i) => (
            <Fragment key={data.full_name}>
              {i === 1 && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-gray-300 font-bold text-xl">VS</div>
                  {isCloseCall && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      势均力敌
                    </span>
                  )}
                </div>
              )}
              <div className={`relative bg-white rounded-2xl p-5 border-2 transition-colors ${
                winnerTotal === side && !isCloseCall ? "border-emerald-400" : "border-transparent"
              }`}>
                {winnerTotal === side && !isCloseCall && (
                  <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                    评分领先
                  </span>
                )}
                <div className="flex items-start gap-3">
                  {data.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.avatar_url}
                      alt=""
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-lg shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-400 mb-1">
                      {data.language} · {data.license || "无许可证"}
                      {data.has_security_policy && (
                        <span className="ml-2 text-blue-500">✓ SECURITY</span>
                      )}
                    </div>
                    <a
                      href={`https://github.com/${data.full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-gray-900 text-lg leading-tight hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {data.full_name}
                      <span className="text-xs text-gray-300 font-normal">↗</span>
                    </a>
                    <div className="text-sm text-gray-500 mt-1 line-clamp-2">{data.description}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-gray-400">{verdict(s)}</div>
                  <ScoreRing value={s.total} highlight={winnerTotal === side && !isCloseCall} size={72} />
                </div>
              </div>
            </Fragment>
          ))}
        </div>

        {/* AI narrative — streamed in separately so it doesn't block the scores above */}
        <Suspense fallback={<NarrativeSkeleton />}>
          <Narrative dataA={dataA} scoreA={scoreA} dataB={dataB} scoreB={scoreB} />
        </Suspense>

        {/* Score breakdown */}
        <div className="bg-white rounded-2xl p-5 mb-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-medium text-gray-600">维度评分</div>
            <div className="text-xs text-gray-400">对齐 CHAOSS 框架</div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span className="font-medium text-gray-700">{nameA}</span>
            <span className="font-medium text-gray-700">{nameB}</span>
          </div>
          {DIMENSIONS.map((d) => (
            <ScoreBar
              key={d.key}
              label={d.label}
              valueA={scoreA[d.key] as number}
              valueB={scoreB[d.key] as number}
              nameA={dataA.full_name}
              nameB={dataB.full_name}
              basis={d.basis}
            />
          ))}
        </div>

        {/* Per-repo detail cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {sides.map(({ data, meta }) => (
            <div key={data.full_name} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400 font-medium mb-3">{data.full_name}</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <StatCard label="Stars" value={fmt(data.stars)} />
                <StatCard label="Forks" value={fmt(data.forks)} />
                <StatCard label="30天提交" value={data.commits_30d} />
                <StatCard label="PR关闭率" value={`${Math.round(data.pr_closure_ratio * 100)}%`} sub="merged/(merged+open)" />
                <StatCard label="30天贡献者" value={data.contributors_30d} />
                <StatCard
                  label="首次响应"
                  value={data.issue_response_days !== null ? `${data.issue_response_days.toFixed(1)}天` : "N/A"}
                  sub="Issue中位数"
                />
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex gap-1.5">
                  <span className={data.elephant_score >= 70 ? "text-blue-500" : data.elephant_score >= 40 ? "text-amber-500" : "text-rose-400"}>●</span>
                  <span>{meta.community_signal}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className={data.has_security_policy ? "text-blue-500" : "text-amber-500"}>●</span>
                  <span>{meta.stability_signal}</span>
                </div>
                {data.releases[0] && (
                  <div className="text-gray-400">最新发布：{data.releases[0].tag} ({daysSince(data.releases[0].date)})</div>
                )}
                <div className="text-gray-400">
                  核心贡献者：{data.top_contributors.slice(0, 3).map((c) => c.login).join(" · ")}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-gray-300 space-x-2">
          <span>分享此链接即可保存对比结果</span>
          <span>·</span>
          <CopyLinkButton />
          <span>·</span>
          <span>权重基于 CHAOSS Starter Project Health Model</span>
        </div>
      </div>
    </main>
  )
}
