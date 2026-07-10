export function clamp(v: number, min = 0, max = 100): number {
  return Number.isNaN(v) ? min : Math.max(min, Math.min(max, v))
}

const REPO_PART_RE = /^[a-zA-Z0-9_.-]{1,100}$/

export function isValidRepoPart(s: string): boolean {
  return REPO_PART_RE.test(s)
}
