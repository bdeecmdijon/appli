'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Game {
  id: string
  name: string
  description: string | null
  event_name: string | null
}

interface PlayResult {
  result: string
  prizeName: string
  emoji: string
  color: string
  generatesCoupon: boolean
  couponId: string | null
  creditsRemaining: number
  error?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIZES_PREVIEW = [
  { zone: 'jackpot', emoji: '🟡', prize: 'Sandwich + boisson offerts' },
  { zone: 'gros',    emoji: '🟣', prize: '1 pinte offerte' },
  { zone: 'super',   emoji: '🟢', prize: '1 bière 25cl ou Ricard offert(e)' },
  { zone: 'bon',     emoji: '🔵', prize: '1 soda offert' },
  { zone: 'petit',   emoji: '🟠', prize: '-1€ sur ta prochaine commande' },
]

// Sections de la roue, dans l'ordre horaire à partir du haut
// prob% × 3.6 = degrés de balayage
const WHEEL_SECTIONS = (() => {
  const raw = [
    { id: 'perdu',   prob: 50, color: '#DC2626', textColor: '#fff',    label: 'Perdu 😢'   },
    { id: 'petit',   prob: 25, color: '#F97316', textColor: '#fff',    label: '-1€'        },
    { id: 'bon',     prob: 10, color: '#3B82F6', textColor: '#fff',    label: 'Soda 🥤'   },
    { id: 'super',   prob:  8, color: '#22C55E', textColor: '#fff',    label: 'Bière 🍺'  },
    { id: 'gros',    prob:  5, color: '#A855F7', textColor: '#fff',    label: 'Pinte 🍻'  },
    { id: 'jackpot', prob:  2, color: '#EAB308', textColor: '#1D3550', label: 'JACKPOT 🎉' },
  ]
  let cum = 0
  return raw.map(s => {
    const sweep = s.prob * 3.6
    const start = cum
    cum += sweep
    return { ...s, start, sweep, mid: start + sweep / 2 }
  })
})()

const SPIN_DURATION = 4200 // ms
const CX = 150, CY = 150, R = 138, R_INNER = 34

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

// ── Wheel helpers ──────────────────────────────────────────────────────────────

// 0° = top, sens horaire
function p2c(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function piePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = p2c(cx, cy, r, startDeg)
  const e = p2c(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${cx} ${cy} L${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}Z`
}

// Calcule la rotation totale (cumulative) pour atterrir dans la section resultId
function getTargetRotation(resultId: string, currentRotation: number): number {
  const sec = WHEEL_SECTIONS.find(s => s.id === resultId) ?? WHEEL_SECTIONS[0]
  const margin = Math.max(sec.sweep * 0.12, 1.5)
  const offset = margin + Math.random() * (sec.sweep - margin * 2)
  const target = sec.start + offset
  const cur = ((currentRotation % 360) + 360) % 360
  let delta = target - cur
  if (delta < 0) delta += 360
  const spins = 5 + Math.floor(Math.random() * 3)
  return currentRotation + delta + spins * 360
}

// ── WheelSVG ───────────────────────────────────────────────────────────────────

function WheelSVG() {
  return (
    <svg width="300" height="300" viewBox="0 0 300 300" style={{ display: 'block' }}>
      <defs>
        <filter id="wh-sh" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <filter id="wh-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Anneau extérieur navy */}
      <circle cx={CX} cy={CY} r={R + 8} fill="#1D3550" filter="url(#wh-sh)" />

      {/* Tranches */}
      {WHEEL_SECTIONS.map(sec => (
        <path
          key={sec.id}
          d={piePath(CX, CY, R, sec.start, sec.start + sec.sweep)}
          fill={sec.color}
        />
      ))}

      {/* Séparateurs blancs entre tranches */}
      {WHEEL_SECTIONS.map(sec => (
        <line
          key={`sep-${sec.id}`}
          x1={CX} y1={CY}
          x2={p2c(CX, CY, R, sec.start).x}
          y2={p2c(CX, CY, R, sec.start).y}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.5}
        />
      ))}

      {/* Texte radial dans chaque tranche */}
      {WHEEL_SECTIONS.map(sec => {
        if (sec.sweep < 5) return null
        const tR   = sec.sweep < 18 ? R * 0.70 : R * 0.63
        const pos  = p2c(CX, CY, tR, sec.mid)
        const fs   = sec.sweep >= 100 ? 14 : sec.sweep >= 36 ? 12 : sec.sweep >= 18 ? 9.5 : 7.5
        return (
          <text
            key={`lbl-${sec.id}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs}
            fontWeight="bold"
            fontFamily="Arial, Helvetica, sans-serif"
            fill={sec.textColor}
            transform={`rotate(${sec.mid}, ${pos.x}, ${pos.y})`}
          >
            {sec.label}
          </text>
        )
      })}

      {/* Picots décoratifs sur l'anneau extérieur */}
      {Array.from({ length: 24 }, (_, i) => {
        const deg = i * 15
        const pos = p2c(CX, CY, R + 4, deg)
        return (
          <circle
            key={`pin-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={4.5}
            fill="#fff"
            stroke="#E8622A"
            strokeWidth={1.5}
          />
        )
      })}

      {/* Rebord chromé */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />

      {/* Hub central (laisse de la place pour le logo) */}
      <circle cx={CX} cy={CY} r={R_INNER + 4} fill="#1D3550" />
      <circle cx={CX} cy={CY} r={R_INNER}     fill="#fff" />
    </svg>
  )
}

// ── HubView ────────────────────────────────────────────────────────────────────

function HubView({
  games, credits, onPlay,
}: {
  games: Game[]; credits: Record<string, number>; onPlay: (game: Game) => void
}) {
  const hasAnyCredits = games.some(g => (credits[g.id] ?? 0) > 0)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <p className="text-sm text-white/50 font-medium">Mini-jeux</p>
        <h1 className="text-2xl font-extrabold text-white mt-0.5">🎮 Jeux BDE</h1>
        <p className="text-sm text-white/60 mt-1">Joue et gagne des lots à la buvette !</p>
      </div>
      <div className="px-5 py-5 space-y-6 pb-24">
        {hasAnyCredits && (
          <section>
            <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>🎟️ Mes crédits</h2>
            <div className="space-y-2">
              {games.map(g => {
                const c = credits[g.id] ?? 0
                if (c === 0) return null
                return (
                  <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1D3550' }}>{g.name}</p>
                      {g.event_name && <p className="text-xs text-gray-400">{g.event_name}</p>}
                    </div>
                    <span className="text-2xl font-extrabold px-3 py-1 rounded-xl"
                      style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}>{c}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Jeux disponibles</h2>
          {games.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
              Aucun jeu disponible pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {games.map(game => {
                const c = credits[game.id] ?? 0
                return (
                  <div key={game.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 pb-3 border-b border-gray-50">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: '#1D355010' }}>🎡</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-extrabold" style={{ color: '#1D3550' }}>🎡 {game.name}</h3>
                          {game.event_name && (
                            <p className="text-xs font-semibold mt-0.5" style={{ color: '#E8622A' }}>📍 {game.event_name}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            Tous les 5€ d&apos;achat à la buvette = 1 crédit pour jouer !<br />
                            Tente ta chance et gagne des lots 🎁
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Crédits disponibles</p>
                        <p className="text-2xl font-extrabold leading-none mt-0.5"
                          style={{ color: c > 0 ? '#E8622A' : '#D1D5DB' }}>{c}</p>
                      </div>
                      <button
                        onClick={() => c > 0 && onPlay(game)}
                        disabled={c === 0}
                        className="h-12 px-6 rounded-2xl font-bold text-sm text-white transition active:scale-[0.97] disabled:cursor-not-allowed"
                        style={{ backgroundColor: c > 0 ? '#E8622A' : '#D1D5DB' }}>
                        {c > 0 ? '🎡 Jouer !' : 'Pas de crédit'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Comment jouer ?</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {[
              { icon: '🛒', text: 'Dépense 5€ à la buvette' },
              { icon: '📱', text: 'Montre ton QR code' },
              { icon: '🎮', text: 'Reçois 1 crédit de jeu' },
              { icon: '🎡', text: 'Tourne la roue et gagne !' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0">
                <span className="text-2xl flex-shrink-0">{step.icon}</span>
                <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Lots à gagner 🏆</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {PRIZES_PREVIEW.map(item => (
              <div key={item.zone} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>{item.prize}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── GameView — Roue de la Fortune ──────────────────────────────────────────────

type WheelPhase = 'idle' | 'loading' | 'spinning' | 'result'

function GameView({
  game, initialCredits, onBack,
}: {
  game: Game; initialCredits: number; onBack: (remaining: number) => void
}) {
  const [phase,   setPhase]   = useState<WheelPhase>('idle')
  const [result,  setResult]  = useState<PlayResult | null>(null)
  const [credits, setCredits] = useState(initialCredits)
  const [rotation, setRotation] = useState(0)
  const rotRef     = useRef(0)
  const spinningRef = useRef(false)

  const handleSpin = useCallback(async () => {
    if (spinningRef.current || credits < 1) return
    spinningRef.current = true
    setResult(null)
    setPhase('loading')

    // ─── 1. Appel API avant l'animation ──────────────────────────────────
    const apiResult = await fetch('/api/games/play', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gameId: game.id }),
    }).then(r => r.json() as Promise<PlayResult>)

    if (!apiResult.error) setCredits(apiResult.creditsRemaining)
    setResult(apiResult)

    // ─── 2. Calcul angle de destination puis lancement ────────────────────
    const targetRot = getTargetRotation(apiResult.result ?? 'perdu', rotRef.current)
    rotRef.current = targetRot
    setRotation(targetRot)
    setPhase('spinning')

    // ─── 3. Attente fin de rotation ───────────────────────────────────────
    await sleep(SPIN_DURATION + 300)

    // ─── 4. Confettis ─────────────────────────────────────────────────────
    if (!apiResult.error && ['jackpot', 'gros', 'super'].includes(apiResult.result)) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: apiResult.result === 'jackpot' ? 240 : apiResult.result === 'gros' ? 160 : 110,
          spread:        90,
          origin:        { y: 0.45 },
          colors:        ['#E8622A', '#FFD700', '#ffffff', '#a855f7', '#22c55e'],
        })
      })
    }

    setPhase('result')
    spinningRef.current = false
  }, [game.id, credits])

  function handlePlayAgain() {
    setPhase('idle')
    setResult(null)
  }

  const winSection = result ? WHEEL_SECTIONS.find(s => s.id === result.result) : null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 112px)', position: 'relative', overflow: 'hidden' }}>

      {/* ─── EN-TÊTE ──────────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-5 pt-12 pb-3 z-20"
        style={{ background: 'rgba(6,14,30,0.92)', backdropFilter: 'blur(16px)' }}>
        <button onClick={() => onBack(credits)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-white font-extrabold text-sm">🎡 {game.name}</h1>
          {game.event_name && <p className="text-white/40 text-xs mt-0.5">{game.event_name}</p>}
        </div>
        <div className="px-3 py-1.5 rounded-xl min-w-[60px] text-center"
          style={{ backgroundColor: credits > 0 ? '#E8622A' : 'rgba(255,255,255,0.14)' }}>
          <p className="text-white text-xs font-bold">{credits} crédit{credits !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ─── ZONE SCROLLABLE : roue + lots ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#EDEEF2' }}>
        <div className="flex flex-col items-center px-5 pt-7 pb-8 gap-5">

          {/* Conteneur de la roue */}
          <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>

            {/* ── Pointeur fixe au sommet ────────────────────────────────── */}
            <div style={{
              position: 'absolute',
              top: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
            }}>
              <svg width="26" height="22" viewBox="0 0 26 22">
                <polygon points="13,22 0,0 26,0" fill="#1D3550" />
                <polygon points="13,22 0,0 26,0" fill="none" stroke="#E8622A" strokeWidth={2} />
              </svg>
            </div>

            {/* ── Roue (rotation CSS) ───────────────────────────────────── */}
            <div style={{
              width:  300,
              height: 300,
              transform: `rotate(${rotation}deg)`,
              transition: phase === 'spinning'
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.05, 0.75, 0.2, 1.0)`
                : 'none',
              willChange: 'transform',
            }}>
              <WheelSVG />
            </div>

            {/* ── Logo BDE (ne tourne PAS) ──────────────────────────────── */}
            <div style={{
              position:     'absolute',
              top:          '50%',
              left:         '50%',
              transform:    'translate(-50%, -50%)',
              width:        62,
              height:       62,
              borderRadius: '50%',
              overflow:     'hidden',
              border:       '3px solid #E8622A',
              background:   '#fff',
              zIndex:       10,
              boxShadow:    '0 2px 14px rgba(0,0,0,0.28)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logobde.PNG"
                alt="BDE ECM Dijon"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>

          {/* ── Liste des lots ─────────────────────────────────────────── */}
          <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1D3550' }}>
                Lots à gagner
              </p>
            </div>
            {[...WHEEL_SECTIONS].reverse().filter(s => s.id !== 'perdu').map(s => {
              const prize = PRIZES_PREVIEW.find(p => p.zone === s.id)
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <p className="text-sm font-semibold flex-1 leading-snug" style={{ color: '#1D3550' }}>
                    {prize?.prize ?? s.label}
                  </p>
                  <span className="text-xs font-semibold" style={{ color: s.color }}>{s.prob}%</span>
                </div>
              )
            })}
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: '#DC2626' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#9CA3AF' }}>Rien cette fois</p>
              <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>50%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ZONE BASSE : bouton ─────────────────────────────────────────── */}
      <div className="flex-none px-6 pb-8 pt-4 flex flex-col items-center justify-center z-10"
        style={{ minHeight: 92, background: 'rgba(6,14,30,0.88)', backdropFilter: 'blur(14px)' }}>

        {phase === 'idle' && (
          <button
            onClick={handleSpin}
            disabled={credits < 1}
            className="w-full h-16 rounded-2xl font-extrabold text-white text-xl active:scale-[0.97] disabled:opacity-50 btn-pulse"
            style={{ backgroundColor: '#E8622A' }}>
            🎡 TOURNER !
          </button>
        )}

        {phase === 'loading' && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: 'white' }} />
            <p className="text-white/70 font-semibold text-sm">Préparation...</p>
          </div>
        )}

        {phase === 'spinning' && (
          <p className="text-white/85 font-bold text-base tracking-wide">🎡 La roue tourne...</p>
        )}
      </div>

      {/* ─── OVERLAY RÉSULTAT ────────────────────────────────────────────── */}
      {phase === 'result' && result && (
        <div className="absolute inset-0 z-30 flex items-end px-5 pb-8"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full bg-white rounded-3xl p-6 shadow-2xl result-in">

            {result.error ? (
              <div className="text-center">
                <p className="text-4xl mb-3">❌</p>
                <p className="text-lg font-bold text-red-600">Erreur</p>
                <p className="text-sm text-gray-400 mt-1">{result.error}</p>
                <button onClick={handlePlayAgain}
                  className="mt-4 w-full h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500">
                  Retour
                </button>
              </div>
            ) : (
              <>
                {/* Bande de couleur de section */}
                {winSection && (
                  <div className="h-2 rounded-full mb-5" style={{ background: winSection.color }} />
                )}

                <div className="text-center mb-5">
                  <p className="text-5xl mb-2">{result.emoji}</p>
                  <h2 className="text-2xl font-extrabold"
                    style={{ color: result.result === 'perdu' ? '#DC2626' : (winSection?.color ?? result.color) }}>
                    {result.result === 'perdu' ? 'Raté ! 😢'
                      : result.result === 'jackpot' ? '🎉 JACKPOT !'
                      : 'Bravo !'}
                  </h2>
                  <p className="text-base font-semibold text-gray-700 mt-1.5">{result.prizeName}</p>
                </div>

                {result.generatesCoupon && result.couponId && (
                  <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
                    style={{ backgroundColor: '#E8622A0E', border: '1px solid #E8622A25' }}>
                    <span className="text-2xl">🎟️</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#E8622A' }}>Coupon ajouté à ton compte !</p>
                      <p className="text-xs text-gray-400 mt-0.5">Montre-le à la buvette pour profiter de ton lot.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {result.generatesCoupon && result.couponId && (
                    <Link href="/profil"
                      className="flex items-center justify-center w-full h-12 rounded-2xl font-bold text-white text-sm"
                      style={{ backgroundColor: '#E8622A' }}>
                      Voir mes coupons →
                    </Link>
                  )}
                  {credits > 0 ? (
                    <button onClick={handlePlayAgain}
                      className="w-full h-12 rounded-2xl font-bold text-sm border-2 transition active:scale-[0.97]"
                      style={{ borderColor: '#E8622A', color: '#E8622A' }}>
                      Rejouer ({credits} crédit{credits !== 1 ? 's' : ''})
                    </button>
                  ) : (
                    <button onClick={() => onBack(0)}
                      className="w-full h-12 rounded-2xl font-semibold text-sm border border-gray-200"
                      style={{ color: '#1D3550' }}>
                      ← Retour aux jeux
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function JeuxPage() {
  const [screen,     setScreen]     = useState<'loading' | 'hub' | 'game'>('loading')
  const [games,      setGames]      = useState<Game[]>([])
  const [credits,    setCredits]    = useState<Record<string, number>>({})
  const [activeGame, setActiveGame] = useState<Game | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: gamesData } = await supabase
      .from('games')
      .select('id, name, description, event_name')
      .eq('is_active', true)
      .not('name', 'is', null)
      .order('created_at', { ascending: false })

    const gamesList = gamesData ?? []
    setGames(gamesList)

    if (user && gamesList.length > 0) {
      const { data: creditsData } = await supabase
        .from('game_credits')
        .select('game_id, credits')
        .eq('user_id', user.id)
        .in('game_id', gamesList.map(g => g.id))

      const map: Record<string, number> = {}
      for (const c of creditsData ?? []) map[c.game_id] = c.credits
      setCredits(map)
    }
    setScreen('hub')
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function handlePlay(game: Game) { setActiveGame(game); setScreen('game') }
  function handleBack(remaining: number) {
    if (activeGame) setCredits(prev => ({ ...prev, [activeGame.id]: remaining }))
    setActiveGame(null)
    setScreen('hub')
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0F1E38 100%)' }}>
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
      </div>
    )
  }

  if (screen === 'game' && activeGame) {
    return <GameView game={activeGame} initialCredits={credits[activeGame.id] ?? 0} onBack={handleBack} />
  }

  return <HubView games={games} credits={credits} onPlay={handlePlay} />
}
