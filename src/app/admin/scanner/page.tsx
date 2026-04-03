'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// ── Scanner dynamique (SSR false) ─────────────────────────────────────────

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Types ──────────────────────────────────────────────────────────────────

interface ValidationResult {
  student_name:  string
  student_code:  string
  reward_name:   string
  reward_emoji:  string
  points_spent:  number
}

type Stage = 'scanning' | 'loading' | 'success' | 'error'

// ── Page ───────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [stage,      setStage]      = useState<Stage>('scanning')
  const [result,     setResult]     = useState<ValidationResult | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [lastToken,  setLastToken]  = useState('')
  const cooldownRef = useRef(false)

  async function handleScan(rawValue: string) {
    // Token format: 16-char hex uppercase
    const token = rawValue.trim().toUpperCase()
    if (!token.match(/^[A-F0-9]{16}$/)) return
    if (token === lastToken) return
    if (cooldownRef.current) return

    cooldownRef.current = true
    setLastToken(token)
    setStage('loading')

    try {
      const res  = await fetch('/api/admin/validate-redemption', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        const msg = data.error === 'not_found'    ? 'QR code introuvable.'
          : data.error === 'already_used' ? 'QR code déjà utilisé.'
          : data.error === 'expired'      ? 'QR code expiré.'
          : data.error === 'unauthorized' ? 'Accès non autorisé.'
          : `Erreur : ${data.error ?? 'inconnue'}`
        setErrorMsg(msg)
        setStage('error')
        return
      }

      setResult(data as ValidationResult)
      setStage('success')
    } catch {
      setErrorMsg('Impossible de contacter le serveur.')
      setStage('error')
    }
  }

  function reset() {
    setStage('scanning')
    setResult(null)
    setErrorMsg(null)
    setLastToken('')
    cooldownRef.current = false
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#1D3550' }}>
        <div className="w-12 h-12 rounded-full border-white/20 border-t-white animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid' }} />
        <p className="text-white text-sm font-semibold">Validation en cours…</p>
      </div>
    )
  }

  // ── Succès ──────────────────────────────────────────────────────────────

  if (stage === 'success' && result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6" style={{ backgroundColor: '#1D3550' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          ✅
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-white">Échange validé !</h2>
          <p className="text-white/60 text-sm mt-1">La récompense a été consommée.</p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
          {/* Récompense */}
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ backgroundColor: '#FFF7F4' }}>
            <span className="text-3xl">{result.reward_emoji}</span>
            <div>
              <p className="font-extrabold text-sm" style={{ color: '#1D3550' }}>{result.reward_name}</p>
              <p className="text-xs font-bold" style={{ color: '#E8622A' }}>−{result.points_spent} pts</p>
            </div>
          </div>

          {/* Étudiant */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0" style={{ backgroundColor: '#E8622A' }}>
              {(result.student_name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#1D3550' }}>{result.student_name}</p>
              <p className="text-xs font-mono text-gray-400">{result.student_code}</p>
            </div>
          </div>
        </div>

        <button
          onClick={reset}
          className="w-full max-w-sm h-13 rounded-2xl font-bold text-white border border-white/20 transition active:scale-[0.98]"
          style={{ height: '52px', backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          Scanner un autre QR code
        </button>
      </div>
    )
  }

  // ── Erreur ──────────────────────────────────────────────────────────────

  if (stage === 'error') {
    const isAlreadyUsed = errorMsg?.includes('déjà utilisé')
    const isExpired     = errorMsg?.includes('expiré')

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6" style={{ backgroundColor: '#1D3550' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          {isAlreadyUsed ? '⚠️' : isExpired ? '⏰' : '❌'}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-white">
            {isAlreadyUsed ? 'Déjà utilisé' : isExpired ? 'QR code expiré' : 'Validation impossible'}
          </h2>
          <p className="text-white/60 text-sm mt-1">{errorMsg}</p>
        </div>

        <button
          onClick={reset}
          className="px-8 h-13 rounded-2xl font-bold text-white"
          style={{ height: '52px', backgroundColor: '#E8622A' }}
        >
          Rescanner
        </button>
      </div>
    )
  }

  // ── Scanner ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#000' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4 bg-black">
        <h1 className="text-xl font-extrabold text-white">Scanner QR récompense</h1>
        <p className="text-white/50 text-sm mt-0.5">Scanne le QR code généré par l&apos;étudiant</p>
      </div>

      {/* Caméra */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '60vh' }}>
        <QrScanner
          onScan={(codes) => {
            const raw = codes?.[0]?.rawValue
            if (raw) handleScan(raw)
          }}
          constraints={{ facingMode: 'environment' }}
          styles={{
            container: { width: '100%', height: '100%' },
            video:     { objectFit: 'cover' },
          }}
        />
        {/* Viseur */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 relative">
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-10 h-10 ${cls}`} style={{ borderColor: '#E8622A' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-6 bg-black">
        <p className="text-white/50 text-sm text-center">
          Pointe la caméra sur le QR code de l&apos;étudiant
        </p>

        {/* Saisie manuelle */}
        <ManualInput onSubmit={handleScan} />
      </div>
    </div>
  )
}

// ── Saisie manuelle ────────────────────────────────────────────────────────

function ManualInput({ onSubmit }: { onSubmit: (token: string) => void }) {
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
        className="w-full mt-4 h-11 rounded-2xl text-sm font-bold border border-white/20 text-white/70 transition active:scale-[0.97]"
      >
        Saisir un code manuellement
      </button>
    )
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Code 16 caractères…"
        maxLength={16}
        className="flex-1 h-11 px-3 rounded-xl text-sm font-mono outline-none bg-white/10 text-white placeholder-white/30 border border-white/20 focus:border-[#E8622A]"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="h-11 px-4 rounded-xl font-bold text-white text-sm disabled:opacity-40"
        style={{ backgroundColor: '#E8622A' }}
      >
        Valider
      </button>
    </div>
  )
}
