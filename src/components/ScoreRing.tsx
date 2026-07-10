interface Props {
  value: number
  highlight?: boolean
  size?: number
}

export function ScoreRing({ value, highlight = false, size = 88 }: Props) {
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - value / 100)
  const ringColor = highlight ? "stroke-emerald-500" : "stroke-blue-500"
  const textColor = highlight ? "text-emerald-600" : "text-gray-700"

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          className="stroke-gray-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${ringColor} transition-all duration-700`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-black ${textColor}`}>{value}</span>
        <span className="text-[10px] text-gray-400">/100</span>
      </div>
    </div>
  )
}
