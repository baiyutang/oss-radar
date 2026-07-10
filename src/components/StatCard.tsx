interface Props {
  label: string
  value: string | number
  sub?: string
}

export function StatCard({ label, value, sub }: Props) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}
