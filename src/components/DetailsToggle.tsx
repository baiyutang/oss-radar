"use client"

import { useState } from "react"

export function DetailsToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
      >
        {open ? "收起详细数据" : "查看详细数据"}
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>↓</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
