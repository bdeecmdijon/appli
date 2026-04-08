export default function BdsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6 flex items-center gap-4"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/20 animate-pulse flex-shrink-0" />
        <div className="space-y-2">
          <div className="h-3 w-20 bg-white/20 rounded-full animate-pulse" />
          <div className="h-6 w-36 bg-white/30 rounded-full animate-pulse" />
          <div className="h-3 w-24 bg-white/15 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="px-5 py-5 space-y-6 pb-24">
        {/* Prochains matchs */}
        <div>
          <div className="h-5 w-36 bg-gray-200 rounded-full animate-pulse mb-3" />
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Derniers résultats */}
        <div>
          <div className="h-5 w-40 bg-gray-200 rounded-full animate-pulse mb-3" />
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Classements */}
        <div>
          <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse mb-3" />
          <div className="h-52 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
