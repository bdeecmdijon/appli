'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

// ── Scanner importé dynamiquement (browser only) ──────────────────────────

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Validation du QR code ─────────────────────────────────────────────────

async function validateCode(code: string): Promise<{ valid: boolean; gameId?: string }> {
  if (!code || code.trim().length < 4) return { valid: false }
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, is_active, expires_at')
      .eq('id', code.trim())
      .single()

    if (error || !data) {
      if (error?.code === 'PGRST116' || error?.code === '42P01') {
        return { valid: true, gameId: code.trim() }
      }
      return { valid: false }
    }
    if (!data.is_active) return { valid: false }
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false }
    return { valid: true, gameId: data.id }
  } catch {
    return { valid: true, gameId: code.trim() }
  }
}

// ── Vérification "déjà joué" ──────────────────────────────────────────────

async function hasAlreadyPlayed(userId: string, gameId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('game_plays')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle()
    return !!data
  } catch {
    return false // table absente → laisser jouer
  }
}

// ── Enregistrement + attribution des points ───────────────────────────────
// Insère d'abord dans game_plays (contrainte unique user+game).
// Si l'insert échoue (déjà joué), on skip les points.

async function recordPlayAndAward(userId: string, gameId: string, pts: number): Promise<void> {
  try {
    const { error: playErr } = await supabase
      .from('game_plays')
      .insert({ user_id: userId, game_id: gameId, prize_won: pts })
    if (playErr) return // déjà joué ou erreur → pas de points

    if (pts > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('points_balance')
        .eq('id', userId)
        .single()
      const newBalance = (profile?.points_balance ?? 0) + pts
      await supabase
        .from('profiles')
        .update({ points_balance: newBalance })
        .eq('id', userId)
      await supabase
        .from('points_history')
        .insert({ user_id: userId, amount: pts, reason: 'Roue de la chance' })
    }
  } catch {
    // silent fail
  }
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

const TOTAL         = SEGMENTS.length
const SLICE_ANGLE   = (2 * Math.PI) / TOTAL
const SPIN_DURATION = 4000

function easeOut(t: number) { return 1 - Math.pow(1 - t, 4) }

function drawWheel(canvas: HTMLCanvasElement, rotation: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width
  const cx = size / 2, cy = size / 2, r = cx - 6
  ctx.clearRect(0, 0, size, size)
  SEGMENTS.forEach((seg, i) => {
    const startAngle = rotation + i * SLICE_ANGLE - Math.PI / 2
    const endAngle   = startAngle + SLICE_ANGLE
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.closePath(); ctx.fillStyle = seg.color; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(startAngle + SLICE_ANGLE / 2)
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size < 300 ? 11 : 13}px system-ui, sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4
    ctx.fillText(seg.label, r - 14, 5); ctx.restore()
  })
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#E8622A'; ctx.fill()
}

// ── Bandeau résultat (fixé en haut) ───────────────────────────────────────

function ResultBanner({ pts, label }: { pts: number; label: string }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-5 pb-5 shadow-xl"
      style={{ backgroundColor: '#E8622A', paddingTop: 'max(3.5rem, env(safe-area-inset-top, 3.5rem))' }}
    >
      <span className="text-3xl flex-shrink-0">{pts > 0 ? '🎉' : '😅'}</span>
      <p className="text-white font-extrabold text-base leading-snug">
        {pts > 0
          ? `Bravo ! Tu as gagné ${label} !`
          : 'Pas de chance cette fois... À la prochaine !'}
      </p>
    </div>
  )
}

// ── Écran Scanner ─────────────────────────────────────────────────────────

type ScanStep = 'idle' | 'scanning' | 'validating' | 'error_camera'

function ScannerScreen({
  userId,
  onUnlock,
}: {
  userId: string
  onUnlock: (gameId: string) => void
}) {
  const [step, setStep] = useState<ScanStep>('idle')
  const cooldownRef     = useRef(false)

  const handleScan = useCallback(async (codes: { rawValue: string }[]) => {
    const raw = codes?.[0]?.rawValue
    if (!raw || cooldownRef.current || step !== 'scanning') return
    cooldownRef.current = true
    setStep('validating')

    const { valid, gameId } = await validateCode(raw)
    if (!valid || !gameId) {
      setStep('idle'); cooldownRef.current = false; return
    }
    const played = await hasAlreadyPlayed(userId, gameId)
    if (played) {
      setStep('idle'); cooldownRef.current = false; return
    }
    onUnlock(gameId)
  }, [step, userId, onUnlock])

  function handleScannerError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('notallowed') ||
      msg.toLowerCase().includes('denied')
    ) setStep('error_camera')
    console.warn('[Scanner]', msg)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}
    >
      {/* Déco */}
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full opacity-10" style={{ backgroundColor: '#E8622A' }} />

      {/* ── Vue caméra ── */}
      {(step === 'scanning' || step === 'validating') && (
        <div className="fixed inset-0 z-40 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <h2 className="text-lg font-extrabold text-white">Scanner le QR code</h2>
            <button
              onClick={() => { setStep('idle'); cooldownRef.current = false }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {step === 'scanning' && (
              <QrScanner
                onScan={handleScan}
                onError={handleScannerError}
                constraints={{ facingMode: 'environment' }}
                styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
              />
            )}
            {/* Viseur */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-60 h-60 relative">
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#E8622A' }} />
                ))}
              </div>
            </div>
            {step === 'validating' && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-white font-semibold">Vérification…</p>
              </div>
            )}
          </div>

          <div className="px-5 py-6 bg-black">
            <p className="text-white/50 text-sm text-center">Scanne le QR code affiché à l&apos;entrée de la soirée BDE</p>
          </div>
        </div>
      )}

      {/* ── Erreur caméra ── */}
      {step === 'error_camera' && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-8 gap-5"
          style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}>
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-extrabold text-lg mb-2">Caméra non autorisée</p>
            <p className="text-white/50 text-sm leading-relaxed">
              L&apos;accès à la caméra a été refusé. Autorise la caméra dans les réglages de ton navigateur puis recharge la page.
            </p>
          </div>
          <button onClick={() => setStep('idle')} className="mt-2 px-6 py-3 rounded-2xl font-bold text-white" style={{ backgroundColor: '#E8622A' }}>
            Retour
          </button>
        </div>
      )}

      {/* ── Vue principale ── */}
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.5} className="w-12 h-12">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      </div>

      <h1 className="text-2xl font-extrabold text-white text-center leading-tight mb-3">
        Roue de la chance
      </h1>
      <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed mb-8">
        Scanne le QR code à l&apos;entrée de la soirée pour déverrouiller la roue et tenter ta chance.
      </p>

      <button
        onClick={() => { setStep('scanning'); cooldownRef.current = false }}
        disabled={step === 'validating'}
        className="w-full max-w-xs h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-3 shadow-lg transition active:scale-[0.97] disabled:opacity-50"
        style={{ backgroundColor: '#E8622A' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
        Scanner le QR code
      </button>
    </div>
  )
}

// ── Roue de la fortune ─────────────────────────────────────────────────────

function WheelGame({ onResult }: { onResult: (seg: typeof SEGMENTS[number]) => void }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const rotationRef  = useRef(0)
  const hasSpun      = useRef(false)

  const [spinning, setSpinning] = useState(false)
  const [size,     setSize]     = useState(280)

  useEffect(() => {
    function resize() { setSize(Math.min(window.innerWidth - 80, 320)) }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = size; canvas.height = size
    drawWheel(canvas, rotationRef.current)
  }, [size])

  function spin() {
    if (spinning || hasSpun.current) return
    hasSpun.current = true

    const winIndex    = Math.floor(Math.random() * TOTAL)
    const targetAngle = -(winIndex * SLICE_ANGLE + SLICE_ANGLE / 2) + Math.PI / 2
    const extraSpins  = (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI
    const finalRot    = rotationRef.current + extraSpins + targetAngle - (rotationRef.current % (2 * Math.PI))
    const startRot    = rotationRef.current
    setSpinning(true); startTimeRef.current = null

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
        onResult(SEGMENTS[winIndex])
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
        <p className="text-white/40 text-sm mt-1">Une seule tentative — bonne chance !</p>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-10" style={{
          width: 0, height: 0,
          borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
          borderTop: '20px solid #E8622A', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }} />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        <canvas
          ref={canvasRef} width={size} height={size} className="rounded-full"
          style={{ cursor: spinning || hasSpun.current ? 'not-allowed' : 'pointer' }}
          onClick={!spinning && !hasSpun.current ? spin : undefined}
        />
      </div>

      <button
        onClick={spin}
        disabled={spinning || hasSpun.current}
        className="mt-8 w-full max-w-xs rounded-2xl font-bold text-white text-base transition active:scale-[0.97] flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-50"
        style={{ backgroundColor: '#E8622A', height: '56px' }}
      >
        {spinning ? (
          <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />En cours…</>
        ) : (
          <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>Tourner la roue</>
        )}
      </button>
    </div>
  )
}

// ── Machine à états principale ─────────────────────────────────────────────

type Screen = 'loading' | 'scanner' | 'wheel' | 'result'

function JeuPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [screen, setScreen] = useState<Screen>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [result, setResult] = useState<typeof SEGMENTS[number] | null>(null)

  // Initialisation : récupère l'utilisateur + gère le ?code= dans l'URL
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      if (uid) setUserId(uid)

      const code = searchParams.get('code')
      if (code && uid) {
        const { valid, gameId: gid } = await validateCode(code)
        if (valid && gid) {
          const played = await hasAlreadyPlayed(uid, gid)
          if (!played) {
            setGameId(gid)
            router.replace('/jeu')
            setScreen('wheel')
            return
          }
        }
        router.replace('/jeu')
      }
      setScreen('scanner')
    }
    init()
  }, [searchParams, router])

  const handleUnlock = useCallback((gid: string) => {
    setGameId(gid)
    setScreen('wheel')
  }, [])

  const handleResult = useCallback(async (seg: typeof SEGMENTS[number]) => {
    setResult(seg)
    setScreen('result')

    if (seg.pts > 0) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ['#E8622A', '#FFD700', '#ffffff'] })
      })
    }

    if (userId && gameId) {
      recordPlayAndAward(userId, gameId, seg.pts)
    }

    setTimeout(() => {
      setScreen('scanner')
      setGameId(null)
      setResult(null)
    }, 3000)
  }, [userId, gameId])

  // ── Écran de chargement ──
  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  // ── Roue ──
  if (screen === 'wheel' && userId) {
    return <WheelGame onResult={handleResult} />
  }

  // ── Scanner + bandeau résultat (screen = 'scanner' ou 'result') ──
  return (
    <div className="relative">
      {screen === 'result' && result && (
        <ResultBanner pts={result.pts} label={result.label} />
      )}
      {userId && (
        <ScannerScreen userId={userId} onUnlock={handleUnlock} />
      )}
    </div>
  )
}

// ── Export principal ───────────────────────────────────────────────────────

export default function JeuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0A0F1A 100%)' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <JeuPageInner />
    </Suspense>
  )
}
