export default function JeuxLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div className="h-3 w-16 bg-white/20 rounded-full animate-pulse mb-2" />
        <div className="h-7 w-40 bg-white/30 rounded-full animate-pulse mb-2" />
        <div className="h-3 w-52 bg-white/15 rounded-full animate-pulse" />
      </div>

      <div className="px-5 py-5 space-y-4 pb-24">
        <div className="h-5 w-36 bg-gray-200 rounded-full animate-pulse" />
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-44 animate-pulse" />
        ))}
        <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse mt-4" />
        <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
      </div>
    </div>
  )
}
