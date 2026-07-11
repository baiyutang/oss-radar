"use client"

import { useRef, useState } from "react"

type Status = "idle" | "saving" | "failed"

// Downloads the comparison's OG share card (already generated server-side
// at {pathname}/opengraph-image) as a local PNG.
export function SaveImageButton() {
  const [status, setStatus] = useState<Status>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSave() {
    if (status === "saving") return
    setStatus("saving")
    try {
      const path = window.location.pathname.replace(/\/$/, "")
      const res = await fetch(`${path}/opengraph-image`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()

      const parts = decodeURIComponent(path).split("/").filter(Boolean)
      const slug = [parts[1], parts[2]]
        .filter(Boolean)
        .map((p) => p.replace(/\//g, "-"))
        .join("-vs-")

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `oss-radar-${slug || "compare"}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      setStatus("idle")
    } catch {
      setStatus("failed")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setStatus("idle"), 1500)
    }
  }

  return (
    <button
      onClick={handleSave}
      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
    >
      {status === "saving" ? "生成中..." : status === "failed" ? "保存失败，请重试" : "保存分享图"}
    </button>
  )
}
