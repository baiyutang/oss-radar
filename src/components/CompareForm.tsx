"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AutocompleteInput } from "@/components/AutocompleteInput"

function parseRepo(input: string): string {
  try {
    const url = new URL(input)
    const parts = url.pathname.replace(/^\//, "").split("/")
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch {}
  return input.trim()
}

export function CompareForm() {
  const router = useRouter()
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [error, setError] = useState("")
  const [comparing, startTransition] = useTransition()

  const handleCompare = () => {
    const ra = parseRepo(a)
    const rb = parseRepo(b)
    if (!ra.includes("/") || !rb.includes("/")) {
      setError("请输入有效的 GitHub 仓库，格式：owner/repo 或完整 URL")
      return
    }
    setError("")
    startTransition(() => {
      router.push(`/compare/${encodeURIComponent(ra)}/${encodeURIComponent(rb)}`)
    })
  }

  return (
    <>
      <div className="space-y-3 mb-4">
        <AutocompleteInput
          placeholder="项目 A：owner/repo 或 GitHub URL"
          value={a}
          onChange={setA}
          onSelect={(full_name) => setA(full_name)}
          onEnter={handleCompare}
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-medium">VS</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <AutocompleteInput
          placeholder="项目 B：owner/repo 或 GitHub URL"
          value={b}
          onChange={setB}
          onSelect={(full_name) => setB(full_name)}
          onEnter={handleCompare}
        />
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleCompare}
        disabled={comparing}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {comparing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            分析中...
          </>
        ) : "开始对比 →"}
      </button>
    </>
  )
}
