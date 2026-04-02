'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Config verrou ──────────────────────────────────────────────────────────

const LOCK_KEY      = 'jeu_unlock'
const LOCK_DURATION = 12 * 60 * 60 * 1000   // 12h en ms

interface UnlockData {
  code:       string
  unlockedAt: number
}

function getUnlockData(): UnlockData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LOCK_KEY)
  if (!raw) return null
  try {
    const data: UnlockData = JSON.parse(raw)
    if (Date.now() - data.unlockedAt > LOCK_DURATION) {
      localStorage.removeItem(LOCK_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function storeUnlock(code: string) {
  localStorage.setItem(LOCK_KEY, JSON.stringify({ code, unlockedAt: Date.now() }))
}

// ── Segments de la roue ────────────────────────────────────────────────────

const SEGMENTS = [
  { label: '50 pts',       color: '#E8622A', pts: 50  },
  { label: 'Encore !',     color: '#1D3550', pts: 0   },
  { label: '100 pts',      color: '#E8622A', pts: 100 },
  { label: 'Bonne chance', color: '#2E5A8A', pts: 0   },
  { label: '🎉 500 pts',   color: '#FFD700', pts: 500 },
  { label: '25 pts',       color: '#2E5A8A', pts: 25  },
  { label: '200 pts',      color: '#E8622A', pts: 200 },
  { label: '75 pts',       color: '#1D3550', pts: 75  },
]

const TOTAL        = SEGMENTS.length
const SLICE_ANGLE  = (2 * Math.PI) / TOTAL
const SPIN_DURATION = 4000

function easeOut(t: number) { return 1 - Math.pow(1 - t, 4) }

function drawWheel(canvas: HTMLCanvasElement, rotation: number) {
  const ctx  = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width
  const cx   = size / 2
  const cy   = size / 2
  const r    = cx - 6

  ctx.clearRect(0, 0, size, size)

  SEGMENTS.forEach((seg, i) => {
    const startAngle = rotation + i * SLICE_ANGLE - Math.PI / 2
    const endAngle   = startAngle + SLICE_ANGLE

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth   = 1.5
    ctx.stroke()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(startAngle + SLICE_ANGLE / 2)
    ctx.textAlign    = 'right'
    ctx.fillStyle    = '#ffffff'
    ctx.font         = `bold ${size < 300 ? 11 : 13}px system-ui, sans-serif`
    ctx.shadowColor  = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur   = 4
    ctx.fillText(seg.label, r - 14, 5)
    ctx.restore()
  })

  // Centre
  ctx.beginPath()
  ctx.arc(cx, cy, 20, 0, Math.PI * 2)
  ctx.fillStyle   = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur  = 8
  ctx.fill()
  ctx.shadowBlur  = 0

  ctx.beginPath()
  ctx.arc(cx, cy, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#E8622A'
  ctx.fill()
}

// ── Écran verrou ───────────────────────────────────────────────────────────

function LockScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
    >
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />

      {/* Icône cadenas */}
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.5} className="w-12 h-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <h1 className="text-2xl font-extrabold text-white text-center leading-tight mb-3">
        Accès réservé
      </h1>
      <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed mb-2">
        Scanne le QR code à l'entrée de la soirée pour déverrouiller les jeux et tenter ta chance.
      </p>

      {/* Cadre QR simulé */}
      <div
        className="mt-6 mb-10 rounded-2xl p-5 flex flex-col items-center gap-3"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="relative w-20 h-20">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/60 rounded-tl" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/60 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/60 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/60 rounded-br" />
          <div className="absolute inset-3 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-white/40 text-center">
          QR code disponible uniquement lors des soirées BDE
        </p>
      </div>

      <p className="text-xs text-white/20 text-center">
        🔒 Accès valide 12h après le scan
      </p>
    </div>
  )
}

// ── Roue de la fortune ─────────────────────────────────────────────────────

function WheelGame() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const rotationRef  = useRef(0)

  const [spinning,  setSpinning]  = useState(false)
  const [result,    setResult]    = useState<typeof SEGMENTS[number] | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [size,      setSize]      = useState(280)

  useEffect(() => {
    function resize() { setSize(Math.min(window.innerWidth - 80, 320)) }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = size
    canvas.height = size
    drawWheel(canvas, rotationRef.current)
  }, [size])

  function spin() {
    if (spinning) return
    setResult(null)
    setShowModal(false)

    const winIndex   = Math.floor(Math.random() * TOTAL)
    const targetAngle = -(winIndex * SLICE_ANGLE + SLICE_ANGLE / 2) + Math.PI / 2
    const extraSpins  = (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI
    const finalRot    = rotationRef.current + extraSpins + targetAngle - (rotationRef.current % (2 * Math.PI))
    const startRot    = rotationRef.current

    setSpinning(true)
    startTimeRef.current = null

    function frame(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const t       = Math.min(elapsed / SPIN_DURATION, 1)

      rotationRef.current = startRot + (finalRot - startRot) * easeOut(t)
      const canvas = canvasRef.current
      if (canvas) drawWheel(canvas, rotationRef.current)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rotationRef.current = finalRot
        setSpinning(false)
        setResult(SEGMENTS[winIndex])
        setShowModal(true)
        if (SEGMENTS[winIndex].pts > 0) {
          import('canvas-confetti').then(({ default: confetti }) => {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ['#E8622A', '#FFD700', '#ffffff'] })
          })
        }
      }
    }

    rafRef.current = requestAnimationFrame(frame)
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 pb-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
    >
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white">Roue de la chance</h1>
        <p className="text-white/40 text-sm mt-1">Tente ta chance et gagne des points !</p>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
        {/* Aiguille */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-3 z-10"
          style={{
            width: 0, height: 0,
            borderLeft:  '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop:   '20px solid #E8622A',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }}
        />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-full"
          style={{ cursor: spinning ? 'not-allowed' : 'pointer' }}
          onClick={!spinning ? spin : undefined}
        />
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="mt-8 w-full max-w-xs rounded-2xl font-bold text-white text-base transition active:scale-[0.97] flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-50"
        style={{ backgroundColor: '#E8622A', height: '56px' }}
      >
        {spinning ? (
          <>
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            En cours…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Tourner la roue
          </>
        )}
      </button>

      {result && !showModal && (
        <p className="mt-4 text-white/50 text-sm text-center">
          Dernier résultat : <span className="font-bold text-white/80">{result.label}</span>
        </p>
      )}

      {/* Modal résultat */}
      {showModal && result && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl px-6 pt-4 pb-10">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-extrabold text-white mb-4 shadow-lg"
                style={{ backgroundColor: result.color }}
              >
                {result.pts > 0 ? '🎉' : '😅'}
              </div>
              <h2 className="text-xl font-extrabold mb-1" style={{ color: '#1D3550' }}>
                {result.pts > 0 ? 'Félicitations !' : 'Pas de chance…'}
              </h2>
              <p className="text-2xl font-extrabold mb-1" style={{ color: result.color }}>
                {result.label}
              </p>
              <p className="text-sm text-gray-400 mb-6">
                {result.pts > 0
                  ? `${result.pts} points seront bientôt crédités sur ton compte.`
                  : 'Reviens demain pour retenter ta chance !'}
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98]"
                style={{ backgroundColor: '#1D3550' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Composant interne qui lit les searchParams ─────────────────────────────

function JeuPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [unlocked,  setUnlocked]  = useState(false)
  const [checking,  setChecking]  = useState(true)
  const [codeError, setCodeError] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')

    // Si l'user arrive via un QR code avec un token
    if (code) {
      // Validation minimale : le code doit avoir au moins 4 caractères
      if (code.trim().length >= 4) {
        storeUnlock(code.trim())
        // Nettoyer l'URL (enlever le ?code= de la barre d'adresse)
        router.replace('/jeu')
        setUnlocked(true)
      } else {
        setCodeError(true)
      }
      setChecking(false)
      return
    }

    // Vérifier si un unlock est déjà stocké (valide < 12h)
    const stored = getUnlockData()
    setUnlocked(!!stored)
    setChecking(false)
  }, [searchParams, router])

  if (checking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
      >
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (codeError) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-8"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
      >
        <p className="text-4xl">❌</p>
        <p className="text-white font-bold text-center">Code invalide</p>
        <p className="text-white/50 text-sm text-center">Ce QR code n'est pas reconnu. Scanne le bon code à l'entrée.</p>
      </div>
    )
  }

  return unlocked ? <WheelGame /> : <LockScreen />
}

// ── Export principal avec Suspense (requis par useSearchParams) ────────────

export default function JeuPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
        >
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <JeuPageInner />
    </Suspense>
  )
}
