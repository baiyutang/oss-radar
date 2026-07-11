export function clamp(v: number, min = 0, max = 100): number {
  return Number.isNaN(v) ? min : Math.max(min, Math.min(max, v))
}

const REPO_PART_RE = /^[a-zA-Z0-9_.-]{1,100}$/

export function isValidRepoPart(s: string): boolean {
  return REPO_PART_RE.test(s)
}

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export function fmtCompact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function decodeRepoPart(raw: string): [string, string] | null {
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

export function daysSince(date: string): string {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return "今天"
  if (d < 30) return `${d}天前`
  if (d < 365) return `${Math.floor(d / 30)}个月前`
  return `${Math.floor(d / 365)}年前`
}
