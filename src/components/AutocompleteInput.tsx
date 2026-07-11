"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { fmtCompact } from "@/lib/utils"

interface Repo {
  full_name: string
  description: string
  stars: number
  language: string
}

interface Props {
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSelect?: (full_name: string) => void
  onEnter?: () => void
}

export function AutocompleteInput({ placeholder, value, onChange, onSelect, onEnter }: Props) {
  const [results, setResults] = useState<Repo[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
    if (!q || q.includes("/")) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        const data: Repo[] = await res.json()
        if (controller.signal.aborted) return
        setResults(data)
        setOpen(data.length > 0)
        setActiveIdx(-1)
      } catch {
        if (controller.signal.aborted) return
      }
      if (!controller.signal.aborted) setLoading(false)
    }, 300)
  }, [])

  useEffect(() => {
    search(value)
  }, [value, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function pick(full_name: string) {
    onChange(full_name)
    onSelect?.(full_name)
    setOpen(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter") {
      if (open && activeIdx >= 0) {
        e.preventDefault()
        pick(results[activeIdx].full_name)
      } else {
        setOpen(false)
        onEnter?.()
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
        spellCheck={false}
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
          {results.map((r, i) => (
            <li
              key={r.full_name}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                i === activeIdx ? "bg-emerald-50" : "hover:bg-gray-50"
              }`}
              onMouseDown={() => pick(r.full_name)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{r.full_name}</span>
                  {r.language && (
                    <span className="text-xs text-gray-400">{r.language}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto shrink-0">★ {fmtCompact(r.stars)}</span>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
