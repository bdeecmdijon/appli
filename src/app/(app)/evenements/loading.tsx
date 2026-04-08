export default function EvenementsLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <div className="w-9 h-9 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
        <div className="h-6 w-52 bg-gray-200 rounded-full animate-pulse" />
      </div>

      {/* Event cards */}
      <div className="px-5 pb-10 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
