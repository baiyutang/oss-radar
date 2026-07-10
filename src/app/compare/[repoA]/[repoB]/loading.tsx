export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">正在拉取仓库数据并分析...</p>
        <p className="text-xs text-gray-300 mt-1">通常需要 5–15 秒</p>
      </div>
    </main>
  )
}
