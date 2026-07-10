import { unstable_cache } from "next/cache"
import { redis } from "./redis"

const LEADERBOARD_KEY = "leaderboard:compares"
const DEDUP_WINDOW_SECONDS = 86_400

// Sorting the pair alphabetically merges "A vs B" and "B vs A" into a single
// leaderboard entry, at the cost of always displaying it in alphabetical
// order rather than whichever order a given visitor typed it in — a purely
// cosmetic tradeoff we accept since the vote count is what matters here.
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::")
}

// Counts one comparison per IP per pair per day, so a single visitor
// refreshing the page repeatedly can't inflate the leaderboard.
//
// The SET (dedup check) and ZINCRBY (count) are two sequential Redis calls
// rather than one pipelined round trip, because ZINCRBY must only run when
// the SET actually claims a new dedup window — pipelining would run both
// unconditionally and double-count repeat visitors within the window.
export async function recordComparison(a: string, b: string, ip: string): Promise<void> {
  if (!redis) return
  try {
    const pair = pairKey(a, b)
    const dedupKey = `leaderboard:dedup:${pair}:${ip}`
    const isNew = await redis.set(dedupKey, "1", { nx: true, ex: DEDUP_WINDOW_SECONDS })
    if (isNew !== "OK") return
    await redis.zincrby(LEADERBOARD_KEY, 1, pair)
  } catch (e) {
    console.error("[leaderboard] recordComparison failed:", e)
  }
}

export interface LeaderboardEntry {
  a: string
  b: string
  count: number
}

async function getTopComparisonsUncached(limit: number): Promise<LeaderboardEntry[]> {
  if (!redis) return []
  try {
    const raw = await redis.zrange<string[]>(LEADERBOARD_KEY, 0, limit - 1, {
      rev: true,
      withScores: true,
    })
    const entries: LeaderboardEntry[] = []
    for (let i = 0; i < raw.length; i += 2) {
      const [a, b] = String(raw[i]).split("::")
      if (!a || !b) continue
      entries.push({ a, b, count: Number(raw[i + 1]) })
    }
    return entries
  } catch (e) {
    console.error("[leaderboard] getTopComparisons failed:", e)
    return []
  }
}

// Cached for 60s so a homepage traffic spike doesn't turn into a Redis read
// per visitor; a comparison's count can lag up to a minute behind reality.
export const getTopComparisons = unstable_cache(
  getTopComparisonsUncached,
  ["leaderboard-top"],
  { revalidate: 60 }
)
