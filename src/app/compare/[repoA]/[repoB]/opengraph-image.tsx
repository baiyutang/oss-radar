import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { fetchRepoData } from "@/lib/github"
import { score, isCloseCall } from "@/lib/scoring"
import { decodeRepoPart } from "@/lib/utils"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Open source health comparison"

interface Props {
  params: Promise<{ repoA: string; repoB: string }>
}

function ScoreBlock({
  name,
  total,
  highlight,
}: {
  name: string
  total: number | null
  highlight: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "40px 48px",
        borderRadius: 24,
        background: "#ffffff",
        border: highlight ? "4px solid #34d399" : "4px solid #f3f4f6",
        maxWidth: 460,
      }}
    >
      <div style={{ fontSize: 34, color: "#111827", textAlign: "center" }}>{name}</div>
      <div
        style={{
          fontSize: 96,
          color: highlight ? "#059669" : "#374151",
          display: "flex",
          alignItems: "baseline",
        }}
      >
        {total ?? "—"}
        <span style={{ fontSize: 30, color: "#9ca3af", marginLeft: 8 }}>/100</span>
      </div>
    </div>
  )
}

export default async function OgImage({ params }: Props) {
  const { repoA, repoB } = await params
  const parsedA = decodeRepoPart(repoA)
  const parsedB = decodeRepoPart(repoB)

  let nameA = parsedA ? parsedA.join("/") : "?"
  let nameB = parsedB ? parsedB.join("/") : "?"
  let totalA: number | null = null
  let totalB: number | null = null
  let close = false

  if (parsedA && parsedB) {
    try {
      const [dataA, dataB] = await Promise.all([
        fetchRepoData(parsedA[0], parsedA[1]),
        fetchRepoData(parsedB[0], parsedB[1]),
      ])
      const sA = score(dataA)
      const sB = score(dataB)
      nameA = dataA.full_name
      nameB = dataB.full_name
      totalA = sA.total
      totalB = sB.total
      close = isCloseCall(sA, sB)
    } catch {
      // Scores stay null; the card still renders with names only.
    }
  }

  const leaderA = totalA !== null && totalB !== null && !close && totalA > totalB
  const leaderB = totalA !== null && totalB !== null && !close && totalB > totalA

  const font = await readFile(join(process.cwd(), "assets/Geist-SemiBold.ttf"))

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#10b981" }} />
          <div style={{ fontSize: 28, color: "#059669" }}>OSS Radar</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <ScoreBlock name={nameA} total={totalA} highlight={leaderA} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 40, color: "#d1d5db" }}>VS</div>
            {close && (
              <div
                style={{
                  fontSize: 20,
                  color: "#6b7280",
                  background: "#f3f4f6",
                  padding: "4px 16px",
                  borderRadius: 999,
                }}
              >
                势均力敌
              </div>
            )}
          </div>
          <ScoreBlock name={nameB} total={totalB} highlight={leaderB} />
        </div>

        <div style={{ fontSize: 24, color: "#9ca3af" }}>
          Open Source Health Score · oss-radar.gokr.io
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist", data: font, weight: 600, style: "normal" }],
    }
  )
}
