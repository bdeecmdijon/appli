'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// ── Scanner dynamique (SSR false) ─────────────────────────────────────────

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Types ──────────────────────────────────────────────────────────────────

interface ValidationOk {
  student_name: string
  student_code: string
  reward_name:  string
  reward_emoji: string
  points_spent: number
}

type Stage = 'scanning' | 'loading' | 'success' | 'error'

// ── Page ───────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [stage,    setStage]    = useState<Stage>('scanning')
  const [ok,       setOk]       = useState<ValidationOk | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const processingRef = useRef(false)

  async function handleScan(rawValue: string) {
    if (processingRef.current) return
    const token = rawValue.trim().toUpperCase()
    if (!token) return

    processingRef.current = true
    setStage('loading')

    try {
      const res  = await fetch('/api/admin/validate-redemption', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorKey(data.error ?? 'unknown')
        setErrorMsg(
          data.error === 'not_found'    ? 'Ce QR code est introuvable dans la base.' :
          data.error === 'already_used' ? 'Ce QR code a déjà été utilisé.' :
          data.error === 'expired'      ? 'Ce QR code a expiré (délai de 5 min dépassé).' :
          data.error === 'unauthorized' ? 'Accès refusé — compte admin requis.' :
          `Erreur inconnue : ${data.error ?? 'serveur'}`
        )
        setStage('error')
        return
      }

      setOk(data as ValidationOk)
      setStage('success')
    } catch {
      setErrorKey('network')
      setErrorMsg('Impossible de joindre le serveur.')
      setStage('error')
    }
  }

  function reset() {
    setStage('scanning')
    setOk(null)
    setErrorMsg(null)
    setErrorKey(null)
    processingRef.current = false
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-4 bg-black">
        <h1 className="text-xl font-extrabold text-white">Scanner un cadeau fidélité</h1>
        <p className="text-white/50 text-sm mt-0.5">
          Scannez le QR code de l&apos;étudiant pour valider sa récompense
        </p>
      </div>

      {/* ── Caméra (toujours montée) ── */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '60vh' }}>
        <QrScanner
          onScan={(codes) => {
            const raw = codes?.[0]?.rawValue
            if (raw) handleScan(raw)
          }}
          constraints={{ facingMode: 'environment' }}
          components={{ finder: false }}
          styles={{
            container: { width: '100%', height: '100%' },
            video:     { objectFit: 'cover' },
          }}
        />
        {/* Viseur unique — coins oranges sur fond transparent */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 relative">
            <div className="absolute top-0    left-0  w-10 h-10 border-t-4 border-l-4 rounded-tl-2xl" style={{ borderColor: '#E8622A' }} />
            <div className="absolute top-0    right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-2xl" style={{ borderColor: '#E8622A' }} />
            <div className="absolute bottom-0 left-0  w-10 h-10 border-b-4 border-l-4 rounded-bl-2xl" style={{ borderColor: '#E8622A' }} />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-2xl" style={{ borderColor: '#E8622A' }} />
          </div>
        </div>
      </div>

      {/* ── Saisie manuelle ── */}
      <div className="px-5 py-6 bg-black">
        <p className="text-white/50 text-sm text-center mb-4">
          Pointe la caméra sur le QR code de l&apos;étudiant
        </p>
        <ManualInput onSubmit={handleScan} disabled={stage !== 'scanning'} />
      </div>

      {/* ── Overlay résultat (fixed = par-dessus l'admin layout) ── */}

      {/* Loading */}
      {stage === 'loading' && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
          style={{ backgroundColor: '#1D3550' }}>
          <div
            className="w-14 h-14 rounded-full animate-spin"
            style={{ border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
          />
          <p className="text-white font-bold text-lg">Validation en cours…</p>
        </div>
      )}

      {/* Succès */}
      {stage === 'success' && ok && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 gap-6"
          style={{ backgroundColor: '#16A34A' }}
        >
          {/* Icône */}
          <div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl bg-white/20">
            ✅
          </div>

          {/* Titre */}
          <div className="text-center">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest">QR CODE VALIDÉ</p>
            <h2 className="text-3xl font-extrabold text-white mt-1">{ok.student_name}</h2>
            <p className="text-white/70 text-sm font-mono mt-1">{ok.student_code}</p>
          </div>

          {/* Carte récompense */}
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ backgroundColor: '#F0FDF4' }}>
              <span className="text-4xl">{ok.reward_emoji}</span>
              <div>
                <p className="font-extrabold" style={{ color: '#1D3550' }}>{ok.reward_name}</p>
                <p className="text-sm font-bold" style={{ color: '#16A34A' }}>−{ok.points_spent} pts déduits</p>
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-gray-500">
              Remettez la récompense à l&apos;étudiant
            </p>
          </div>

          <button
            onClick={reset}
            className="w-full max-w-sm h-14 rounded-2xl font-bold text-green-700 bg-white transition active:scale-[0.98] text-base"
          >
            Scanner un autre QR code
          </button>
        </div>
      )}

      {/* Erreur */}
      {stage === 'error' && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 gap-6"
          style={{ backgroundColor: '#DC2626' }}
        >
          {/* Icône */}
          <div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl bg-white/20">
            {errorKey === 'already_used' ? '⚠️' : errorKey === 'expired' ? '⏰' : '❌'}
          </div>

          {/* Titre */}
          <div className="text-center">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest">
              {errorKey === 'already_used' ? 'Déjà utilisé'
                : errorKey === 'expired'   ? 'QR code expiré'
                : 'Validation impossible'}
            </p>
            <h2 className="text-2xl font-extrabold text-white mt-2">{errorMsg}</h2>
          </div>

          <button
            onClick={reset}
            className="w-full max-w-sm h-14 rounded-2xl font-bold text-red-600 bg-white transition active:scale-[0.98] text-base"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Saisie manuelle ────────────────────────────────────────────────────────

function ManualInput({ onSubmit, disabled }: { onSubmit: (token: string) => void; disabled: boolean }) {
  const [open,  setOpen]  = useState(false)
  const [value, setValue] = useState('')

  function handleSubmit() {
    const token = value.trim().toUpperCase()
    if (!token) return
    setOpen(false)
    setValue('')
    onSubmit(token)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full h-11 rounded-2xl text-sm font-bold border border-white/20 text-white/70 transition active:scale-[0.97] disabled:opacity-40"
      >
        Saisir un code manuellement
      </button>
    )
  }

  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Colle le code ici…"
        className="flex-1 h-11 px-3 rounded-xl text-sm font-mono outline-none bg-white/10 text-white placeholder-white/30 border border-white/20 focus:border-[#E8622A]"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="h-11 px-4 rounded-xl font-bold text-white text-sm disabled:opacity-40"
        style={{ backgroundColor: '#E8622A' }}
      >
        OK
      </button>
    </div>
  )
}
