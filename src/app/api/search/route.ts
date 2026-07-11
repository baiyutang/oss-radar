import { NextRequest, NextResponse } from "next/server"
import { githubApiHeaders } from "@/lib/github"

const QUERY_RE = /^[a-zA-Z0-9一-龥 _.\-+]{1,60}$/

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || !QUERY_RE.test(q)) {
    return NextResponse.json([])
  }

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=6`,
      { headers: githubApiHeaders, cache: "no-store" }
    )
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    const items = (data.items ?? []).map((r: any) => ({
      full_name: r.full_name,
      description: r.description ?? "",
      stars: r.stargazers_count,
      language: r.language ?? "",
    }))
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}
