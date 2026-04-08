export default function PartenairesLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div className="h-3 w-28 bg-white/20 rounded-full animate-pulse mb-2" />
        <div className="h-7 w-44 bg-white/30 rounded-full animate-pulse mb-2" />
        <div className="h-3 w-56 bg-white/15 rounded-full animate-pulse" />
      </div>

      {/* Partner cards */}
      <div className="px-5 py-5 space-y-3 pb-24">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
