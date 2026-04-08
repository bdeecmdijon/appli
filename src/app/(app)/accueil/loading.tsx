export default function AccueilLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-7 w-40 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gray-100 animate-pulse" />
      </div>

      <div className="px-5 space-y-4">
        {/* Points card */}
        <div className="h-44 rounded-3xl animate-pulse" style={{ backgroundColor: '#1D355020' }} />

        {/* Section title */}
        <div className="h-5 w-44 rounded-full bg-gray-100 animate-pulse" />

        {/* Event cards */}
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
