'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CouponAssignment {
  id:             string
  emoji:          string
  title:          string
  description:    string | null
  available_from: string
  expires_at:     string
}

interface CouponFlowProps {
  assignment: CouponAssignment
  onClose:    () => void
}

type Stage = 'confirming' | 'loading' | 'qr' | 'expired' | 'error'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function CouponFlow({ assignment, onClose }: CouponFlowProps) {
  const [stage,     setStage]     = useState<Stage>('confirming')
  const [qrCode,    setQrCode]    = useState('')
  const [countdown, setCountdown] = useState(300)
  const [error,     setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (stage !== 'qr') return
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setStage('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage])

  async function handleConfirm() {
    setStage('loading')
    setError(null)
    try {
      const res  = await fetch('/api/coupons/use', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assignment_id: assignment.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        const msg =
          data.error === 'already_used'       ? 'Ce coupon a déjà été utilisé.'
          : data.error === 'expired'          ? 'Ce coupon a expiré.'
          : data.error === 'not_yet_available'? 'Ce coupon n\'est pas encore disponible.'
          : data.error === 'not_found'        ? 'Coupon introuvable.'
          : data.error === 'unauthorized'     ? 'Non autorisé.'
          : data.error === 'out_of_stock'     ? 'Le stock de ce coupon est épuisé.'
          : 'Une erreur est survenue.'
        setError(msg)
        setStage('error')
        return
      }

      setQrCode(data.qr_code)
      setCountdown(300)
      setStage('qr')
    } catch {
      setError('Impossible de contacter le serveur.')
      setStage('error')
    }
  }

  // ── Confirmation ───────────────────────────────────────────────────────

  if (stage === 'confirming') {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
        <div className="fixed inset-x-4 bottom-6 z-50 bg-white rounded-3xl shadow-2xl p-6 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{assignment.emoji}</div>
            <h3 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
              Utiliser ce coupon ?
            </h3>
            <p className="text-sm text-gray-500 mt-1">{assignment.title}</p>
            {assignment.description && (
              <p className="text-xs text-gray-400 mt-1">{assignment.description}</p>
            )}
            <div
              className="inline-flex items-center gap-1 mt-3 px-4 py-1.5 rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: '#1D3550' }}
            >
              Valable une fois
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500 transition active:scale-[0.97]"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 h-12 rounded-2xl font-bold text-white transition active:scale-[0.97]"
              style={{ backgroundColor: '#E8622A' }}
            >
              Utiliser
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Chargement ─────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full animate-spin"
            style={{ border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
          />
          <p className="text-white text-sm font-semibold">Génération du QR code…</p>
        </div>
      </div>
    )
  }

  // ── Erreur ─────────────────────────────────────────────────────────────

  if (stage === 'error') {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
        <div className="fixed inset-x-4 bottom-6 z-50 bg-white rounded-3xl shadow-2xl p-6 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80">
          <div className="text-center mb-5">
            <div className="text-4xl mb-3">❌</div>
            <h3 className="text-base font-extrabold" style={{ color: '#1D3550' }}>Coupon inutilisable</h3>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-bold text-white"
            style={{ backgroundColor: '#1D3550' }}
          >
            Fermer
          </button>
        </div>
      </>
    )
  }

  // ── QR expiré ──────────────────────────────────────────────────────────

  if (stage === 'expired') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ backgroundColor: '#1D3550' }}>
        <div className="text-center px-8">
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-extrabold text-white mb-2">QR code expiré</h2>
          <p className="text-white/60 text-sm mb-8">Le délai de 5 minutes est dépassé.</p>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-2xl font-bold text-white"
            style={{ backgroundColor: '#E8622A' }}
          >
            Retour
          </button>
        </div>
      </div>
    )
  }

  // ── QR Code plein écran ────────────────────────────────────────────────

  const urgentColor = countdown <= 60 ? '#DC2626' : countdown <= 120 ? '#F59E0B' : '#E8622A'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#1D3550' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div>
          <p className="text-white/50 text-xs font-medium">Coupon activé</p>
          <h2 className="text-lg font-extrabold text-white">
            {assignment.emoji} {assignment.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenu centré */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <p className="text-white/70 text-sm text-center font-medium">
          Montre ce QR code au bar ou à l&apos;accueil
        </p>
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <QRCodeSVG
            value={qrCode}
            size={220}
            fgColor="#1D3550"
            bgColor="#FFFFFF"
            level="M"
          />
        </div>
        <p className="text-white/40 text-xs font-mono tracking-widest">{qrCode}</p>

        {/* Compte à rebours */}
        <div
          className="flex flex-col items-center gap-1 px-8 py-3 rounded-2xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <span
            className="text-4xl font-extrabold tabular-nums transition-colors duration-300"
            style={{ color: urgentColor }}
          >
            {fmtCountdown(countdown)}
          </span>
          <span className="text-white/40 text-xs">
            {countdown <= 60 ? '⚠️ Expire bientôt !' : 'Expire dans'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-10">
        <button
          onClick={onClose}
          className="w-full rounded-2xl font-bold text-white border border-white/20 transition active:scale-[0.98]"
          style={{ height: '52px', backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
