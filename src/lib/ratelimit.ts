import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./redis"

// Only guards the LLM narrative call, not GitHub data fetching or scoring.
const narrativeLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "ratelimit:narrative",
    })
  : null

export interface RateLimitResult {
  allowed: boolean
  retryAfterMinutes?: number
}

export async function checkNarrativeRateLimit(ip: string): Promise<RateLimitResult> {
  // Upstash not configured yet (no env vars) — treat as unlimited so the app
  // works today and rate limiting turns on the moment credentials are added.
  if (!narrativeLimiter) return { allowed: true }

  const { success, reset } = await narrativeLimiter.limit(ip)
  if (success) return { allowed: true }

  const retryAfterMinutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000))
  return { allowed: false, retryAfterMinutes }
}
