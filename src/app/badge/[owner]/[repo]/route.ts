import { NextRequest, NextResponse } from "next/server"
import { fetchRepoData } from "@/lib/github"
import { score, scoreBand, type ScoreBand } from "@/lib/scoring"
import { isValidRepoPart } from "@/lib/utils"

// Shields-style SVG badge: [ oss radar | 76/100 ] colored by score band.
// Embed in a README via:
//   [![OSS Radar](https://oss-radar.gokr.io/badge/OWNER/REPO)](https://oss-radar.gokr.io)
// GitHub proxies README images through camo, which honors Cache-Control, so
// the badge refreshes roughly on the same 6h cadence as the repo-data cache.

const LABEL = "oss radar"

// Thresholds live in lib/scoring.ts (scoreBand) — this only maps band → color.
const BAND_COLORS: Record<ScoreBand, string> = {
  excellent: "#34c759",
  active: "#3b82f6",
  maintained: "#f59e0b",
  attention: "#ef4444",
}

// Verdana-ish average glyph width at font-size 11 — the shields.io approach.
function textWidth(s: string): number {
  return Math.round(s.length * 6.6) + 10
}

function renderBadge(value: string, color: string): string {
  const labelW = textWidth(LABEL)
  const valueW = textWidth(value)
  const total = labelW + valueW
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${LABEL}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14" fill="#010101" fill-opacity=".3">${LABEL}</text>
    <text x="${labelW / 2}" y="13">${LABEL}</text>
    <text x="${labelW + valueW / 2}" y="14" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelW + valueW / 2}" y="13">${value}</text>
  </g>
</svg>`
}

function svgResponse(body: string, cacheSeconds: number): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params
  if (!isValidRepoPart(owner) || !isValidRepoPart(repo)) {
    return svgResponse(renderBadge("invalid", "#9ca3af"), 3600)
  }

  try {
    const data = await fetchRepoData(owner, repo)
    const s = score(data)
    return svgResponse(renderBadge(`${s.total}/100`, BAND_COLORS[scoreBand(s.total)]), 21_600)
  } catch {
    // Unknown repo or upstream failure — short cache so it recovers quickly.
    return svgResponse(renderBadge("unavailable", "#9ca3af"), 600)
  }
}
