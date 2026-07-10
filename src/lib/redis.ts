import { Redis } from "@upstash/redis"

// Shared by leaderboard.ts and ratelimit.ts. null when Upstash isn't
// configured — both features degrade gracefully in that case.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null
