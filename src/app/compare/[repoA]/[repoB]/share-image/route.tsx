import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextRequest } from "next/server"
import { ImageResponse } from "next/og"
import QRCode from "qrcode"
import { fetchRepoData } from "@/lib/github"
import { score, isCloseCall, DIMENSIONS, type ScoreBreakdown } from "@/lib/scoring"
import { resolveNarrative } from "@/lib/ai"
import { isValidRepoPart, getClientIp } from "@/lib/utils"

// The rich, downloadable share card (portrait, dimension bars + AI narrative).
// The auto OG card next door stays minimal because platforms shrink it.

const WIDTH = 1200
const HEIGHT = 1600

function decodePart(raw: string): [string, string] | null {
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

// Satori has no built-in fonts. Full CJK fonts are ~10MB, so the repo ships
// a GB2312-subset Noto Sans SC (~2MB, 6881 common chars) — enough for any
// narrative text, with no runtime network dependency for font loading.

const barColor = (v: number) => (v >= 70 ? "#3b82f6" : v >= 45 ? "#d1d5db" : "#fb7185")

function DimensionRow({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#4b5563" }}>
        <span style={{ width: 80 }}>{a}</span>
        <span style={{ color: "#111827" }}>{label}</span>
        <span style={{ width: 80, textAlign: "right", display: "flex", justifyContent: "flex-end" }}>{b}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", flex: 1, height: 12, background: "#f3f4f6", borderRadius: 6, justifyContent: "flex-end" }}>
          <div style={{ width: `${a}%`, height: 12, background: barColor(a), borderRadius: 6 }} />
        </div>
        <div style={{ width: 2, height: 20, background: "#e5e7eb" }} />
        <div style={{ display: "flex", flex: 1, height: 12, background: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ width: `${b}%`, height: 12, background: barColor(b), borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

function ScoreCard({ name, s, highlight }: { name: string; s: ScoreBreakdown; highlight: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "36px 40px",
        borderRadius: 24,
        background: "#ffffff",
        border: highlight ? "4px solid #34d399" : "4px solid #f3f4f6",
        flex: 1,
      }}
    >
      <div style={{ fontSize: 32, color: "#111827", textAlign: "center" }}>{name}</div>
      <div style={{ fontSize: 84, color: highlight ? "#059669" : "#374151", display: "flex", alignItems: "baseline" }}>
        {s.total}
        <span style={{ fontSize: 28, color: "#9ca3af", marginLeft: 8 }}>/100</span>
      </div>
    </div>
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoA: string; repoB: string }> }
) {
  const { repoA, repoB } = await params
  const parsedA = decodePart(repoA)
  const parsedB = decodePart(repoB)
  if (!parsedA || !parsedB) {
    return new Response("invalid repo", { status: 400 })
  }

  const [dataA, dataB] = await Promise.all([
    fetchRepoData(parsedA[0], parsedA[1]),
    fetchRepoData(parsedB[0], parsedB[1]),
  ])
  const sA = score(dataA)
  const sB = score(dataB)
  const close = isCloseCall(sA, sB)
  const leaderA = !close && sA.total > sB.total
  const leaderB = !close && sB.total > sA.total

  const ip = getClientIp(req.headers)
  const narrativeResult = await resolveNarrative(dataA, sA, dataB, sB, close, ip)
  const narrative = narrativeResult.status === "ok" ? narrativeResult.text : null

  // QR points back to this comparison so WeChat users can long-press the
  // saved image and scan straight through to the live page.
  const host = req.headers.get("host") ?? "oss-radar.gokr.io"
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"
  const pageUrl = `${proto}://${host}/compare/${repoA}/${repoB}`
  const [latinFont, cjkFont, qrDataUrl] = await Promise.all([
    readFile(join(process.cwd(), "assets/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/NotoSansSC-Medium-Subset.ttf")),
    QRCode.toDataURL(pageUrl, { width: 280, margin: 1, color: { dark: "#111827", light: "#ffffff" } }),
  ])

  const fonts = [
    { name: "Geist", data: latinFont, weight: 600 as const, style: "normal" as const },
    { name: "Noto Sans SC", data: cjkFont, weight: 500 as const, style: "normal" as const },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#f9fafb",
          padding: "56px 64px",
          gap: 36,
          fontFamily: "Geist, 'Noto Sans SC'",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#10b981" }} />
          <div style={{ fontSize: 30, color: "#059669" }}>OSS Radar</div>
          <div style={{ fontSize: 26, color: "#9ca3af", marginLeft: 8 }}>开源项目健康度对比</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, width: "100%" }}>
          <ScoreCard name={dataA.full_name} s={sA} highlight={leaderA} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 36, color: "#d1d5db" }}>VS</div>
            {close && (
              <div style={{ fontSize: 20, color: "#6b7280", background: "#f3f4f6", padding: "4px 16px", borderRadius: 999 }}>
                势均力敌
              </div>
            )}
          </div>
          <ScoreCard name={dataB.full_name} s={sB} highlight={leaderB} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            width: "100%",
            background: "#ffffff",
            borderRadius: 24,
            padding: "36px 44px",
            border: "1px solid #f3f4f6",
          }}
        >
          <div style={{ fontSize: 24, color: "#6b7280", display: "flex" }}>维度评分</div>
          {DIMENSIONS.map((d) => (
            <DimensionRow key={d.key} label={d.label} a={sA[d.key]} b={sB[d.key]} />
          ))}
        </div>

        {narrative && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              width: "100%",
              background: "#ffffff",
              borderRadius: 24,
              padding: "36px 44px",
              border: "1px solid #f3f4f6",
            }}
          >
            <div style={{ fontSize: 24, color: "#2563eb", display: "flex" }}>AI 综合分析</div>
            <div style={{ fontSize: 26, color: "#374151", lineHeight: 1.7, display: "flex" }}>{narrative}</div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: "auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: "24px 44px",
            border: "1px solid #f3f4f6",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 26, color: "#374151", display: "flex" }}>长按识别二维码，查看实时对比</div>
            <div style={{ fontSize: 22, color: "#9ca3af", display: "flex" }}>oss-radar.gokr.io · 数据每 6 小时更新</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="" width={140} height={140} style={{ borderRadius: 12 }} />
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts }
  )
}
