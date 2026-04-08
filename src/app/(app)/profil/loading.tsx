export default function ProfilLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header gradient */}
      <div className="h-52 animate-pulse" style={{ backgroundColor: '#1D355080' }} />

      <div className="px-5 mt-4 space-y-4">
        {/* Profile card */}
        <div className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
        {/* QR / points block */}
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        {/* Settings */}
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}
