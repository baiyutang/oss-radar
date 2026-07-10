"use client"

interface Props {
  label: string
  valueA: number
  valueB: number
  nameA: string
  nameB: string
  basis?: string
}

const color = (v: number) =>
  v >= 70 ? "bg-emerald-500" : v >= 45 ? "bg-amber-400" : "bg-red-400"

export function ScoreBar({ label, valueA, valueB, nameA, nameB, basis }: Props) {
  const winner = valueA > valueB ? "a" : valueB > valueA ? "b" : "tie"
  return (
    <div className="mb-5">
      <div className="flex justify-between text-sm text-gray-500 mb-1">
        <span className={winner === "a" ? "font-semibold text-gray-800" : ""}>{valueA}</span>
        <span className="flex items-center gap-1 font-medium text-gray-700">
          {label}
          {basis && (
            <span className="relative group">
              <span className="cursor-help text-gray-300 hover:text-gray-500 text-xs select-none">ⓘ</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center leading-relaxed whitespace-normal">
                {basis}
              </span>
            </span>
          )}
        </span>
        <span className={winner === "b" ? "font-semibold text-gray-800" : ""}>{valueB}</span>
      </div>
      <div className="flex gap-1 items-center">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full transition-all ${color(valueA)}`}
            style={{ width: `${valueA}%` }}
          />
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color(valueB)}`}
            style={{ width: `${valueB}%` }}
          />
        </div>
      </div>
    </div>
  )
}
