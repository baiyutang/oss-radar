"use client"

import { useState } from "react"

type Status = "idle" | "copied" | "failed"

export function CopyLinkButton() {
  const [status, setStatus] = useState<Status>("idle")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus("copied")
    } catch {
      setStatus("failed")
    }
    setTimeout(() => setStatus("idle"), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
    >
      {status === "copied" ? "已复制 ✓" : status === "failed" ? "复制失败，请手动复制" : "复制链接"}
    </button>
  )
}
