import { Redis } from "@upstash/redis"

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

const LEADERBOARD_KEY = "leaderboard:compares"
const DEDUP_WINDOW_SECONDS = 86_400

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::")
}

// Counts one comparison per IP per pair per day, so a single visitor
// refreshing the page repeatedly can't inflate the leaderboard.
export async function recordComparison(a: string, b: string, ip: string): Promise<void> {
  if (!redis) return
  const pair = pairKey(a, b)
  const dedupKey = `leaderboard:dedup:${pair}:${ip}`
  const isNew = await redis.set(dedupKey, "1", { nx: true, ex: DEDUP_WINDOW_SECONDS })
  if (isNew !== "OK") return
  await redis.zincrby(LEADERBOARD_KEY, 1, pair)
}

export interface LeaderboardEntry {
  a: string
  b: string
  count: number
}

export async function getTopComparisons(limit: number): Promise<LeaderboardEntry[]> {
  if (!redis) return []
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
}
