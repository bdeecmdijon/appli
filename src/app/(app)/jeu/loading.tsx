export default function JeuLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0F1E38 100%)' }}
    >
      {/* Spinner aux couleurs de la marque */}
      <div
        className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: '#E8622A40', borderTopColor: '#E8622A' }}
      />
      <div className="h-4 w-32 bg-white/15 rounded-full animate-pulse" />
    </div>
  )
}
