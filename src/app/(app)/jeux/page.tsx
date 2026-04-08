'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────

interface Game {
  id:          string
  name:        string
  description: string | null
  event_name:  string | null
}

interface PlayResult {
  result:           string
  prizeName:        string
  emoji:            string
  color:            string
  generatesCoupon:  boolean
  couponId:         string | null
  creditsRemaining: number
  error?:           string
}

// ── Prizes preview ────────────────────────────────────────────────────────

const PRIZES_PREVIEW = [
  { zone: 'jackpot', emoji: '🟡', prize: 'Sandwich + boisson offerts' },
  { zone: 'gros',    emoji: '🟣', prize: '1 pinte offerte'            },
  { zone: 'super',   emoji: '🟢', prize: '1 bière 25cl offerte'       },
  { zone: 'bon',     emoji: '🔵', prize: '1 soda offert'              },
  { zone: 'petit',   emoji: '🟠', prize: '-1€ sur ta prochaine commande' },
]

// ── Final ball position per result (% of scene container) ─────────────────

const RESULT_POS: Record<string, { x: number; y: number; s: number }> = {
  jackpot: { x: 50,   y: 38,   s: 0.50 },
  gros:    { x: 47.5, y: 41,   s: 0.52 },
  super:   { x: 53,   y: 44.5, s: 0.55 },
  bon:     { x: 44,   y: 49,   s: 0.58 },
  petit:   { x: 57,   y: 54,   s: 0.62 },
  perdu:   { x: 63,   y: 62,   s: 0.68 },
}

// ── SVG: Metallic pétanque ball ───────────────────────────────────────────

function MetallicBall({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="mb-g" cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor="#d6e0ed" />
          <stop offset="40%"  stopColor="#8090ac" />
          <stop offset="75%"  stopColor="#3f4f66" />
          <stop offset="100%" stopColor="#151e2d" />
        </radialGradient>
        <radialGradient id="mb-env" cx="62%" cy="72%" r="55%">
          <stop offset="0%"   stopColor="#6a9abf" stopOpacity="0.28" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="mb-sh" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="2" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#mb-g)" filter="url(#mb-sh)" />
      <circle cx="50" cy="50" r="46" fill="url(#mb-env)" />
      <path d="M16 58 Q50 74 84 58" stroke="rgba(0,0,0,0.22)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 37 Q50 22 80 37" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="34" cy="33" rx="13" ry="9" fill="rgba(255,255,255,0.38)" transform="rotate(-30 34 33)" />
      <ellipse cx="63" cy="65" rx="7" ry="4.5" fill="rgba(255,255,255,0.13)" transform="rotate(-30 63 65)" />
    </svg>
  )
}

// ── SVG: Cochonnet ────────────────────────────────────────────────────────

function Cochonnet({ glow = false }: { glow?: boolean }) {
  return (
    <svg
      width={24} height={24} viewBox="0 0 40 40"
      style={{
        display: 'block',
        filter: glow ? 'drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 16px #FFD700)' : 'none',
        transition: 'filter 0.4s ease',
      }}
    >
      <defs>
        <radialGradient id="cg" cx="38%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#FFF176" />
          <stop offset="55%"  stopColor="#F5A623" />
          <stop offset="100%" stopColor="#C47B00" />
        </radialGradient>
        <filter id="csh">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="20" cy="20" r="17" fill="url(#cg)" filter="url(#csh)" />
      <ellipse cx="14" cy="14" rx="5" ry="3" fill="rgba(255,255,255,0.42)" transform="rotate(-30 14 14)" />
    </svg>
  )
}

// ── HubView ───────────────────────────────────────────────────────────────

function HubView({
  games,
  credits,
  onPlay,
}: {
  games:   Game[]
  credits: Record<string, number>
  onPlay:  (game: Game) => void
}) {
  const hasAnyCredits = games.some(g => (credits[g.id] ?? 0) > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <p className="text-sm text-white/50 font-medium">Mini-jeux</p>
        <h1 className="text-2xl font-extrabold text-white mt-0.5">🎮 Jeux BDE</h1>
        <p className="text-sm text-white/60 mt-1">Joue et gagne des lots à la buvette !</p>
      </div>

      <div className="px-5 py-5 space-y-6 pb-24">

        {/* Crédits actuels */}
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
                    <span
                      className="text-2xl font-extrabold px-3 py-1 rounded-xl"
                      style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}
                    >
                      {c}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Jeux disponibles */}
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
                    {/* Game header */}
                    <div className="p-4 pb-3 border-b border-gray-50">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: '#1D355010' }}
                        >
                          🎱
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-extrabold" style={{ color: '#1D3550' }}>
                            🎱 {game.name}
                          </h3>
                          {game.event_name && (
                            <p className="text-xs font-semibold mt-0.5" style={{ color: '#E8622A' }}>
                              📍 {game.event_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            Tous les 5€ d&apos;achat à la buvette = 1 crédit pour jouer !<br />
                            Tente ta chance et gagne des lots 🎁
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Credits + button */}
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Crédits disponibles</p>
                        <p
                          className="text-2xl font-extrabold leading-none mt-0.5"
                          style={{ color: c > 0 ? '#E8622A' : '#D1D5DB' }}
                        >
                          {c}
                        </p>
                      </div>
                      <button
                        onClick={() => c > 0 && onPlay(game)}
                        disabled={c === 0}
                        className="h-12 px-6 rounded-2xl font-bold text-sm text-white transition active:scale-[0.97] disabled:cursor-not-allowed"
                        style={{ backgroundColor: c > 0 ? '#E8622A' : '#D1D5DB' }}
                      >
                        {c > 0 ? '🎳 Jouer !' : 'Pas de crédit'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Comment jouer */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Comment jouer ?</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {[
              { icon: '🛒', text: 'Dépense 5€ à la buvette' },
              { icon: '📱', text: 'Montre ton QR code' },
              { icon: '🎮', text: 'Reçois 1 crédit de jeu' },
              { icon: '🎱', text: 'Lance et gagne !' },
            ].map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-2xl flex-shrink-0">{step.icon}</span>
                <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lots à gagner */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Lots à gagner 🏆</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {PRIZES_PREVIEW.map(item => (
              <div
                key={item.zone}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
              >
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

// ── GameView – immersive 3D pétanque scene ────────────────────────────────

type GamePhase = 'idle' | 'windup' | 'airborne' | 'landing' | 'rolling' | 'stopped' | 'result'

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

function GameView({
  game,
  initialCredits,
  onBack,
}: {
  game:           Game
  initialCredits: number
  onBack:         (remaining: number) => void
}) {
  const [phase,    setPhase]    = useState<GamePhase>('idle')
  const [result,   setResult]   = useState<PlayResult | null>(null)
  const [credits,  setCredits]  = useState(initialCredits)
  const [showDust, setShowDust] = useState(false)

  // Ball position state
  const [bLeft,   setBLeft]   = useState('50%')
  const [bTop,    setBTop]    = useState('83%')
  const [bScale,  setBScale]  = useState(1.0)
  const [bRotate, setBRotate] = useState(0)
  const [bTrans,  setBTrans]  = useState('none')

  const throwingRef = useRef(false)

  const handleThrow = useCallback(async () => {
    if (throwingRef.current || credits < 1) return
    throwingRef.current = true
    setResult(null)

    // Start API call immediately so result is ready during rolling phase
    const apiPromise = fetch('/api/games/play', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gameId: game.id }),
    }).then(r => r.json() as Promise<PlayResult>)

    // ── WINDUP (0.35s) ──────────────────────────────────────────────────
    setPhase('windup')
    setBTrans('left 0.35s ease-out, top 0.35s ease-out, transform 0.35s ease-out')
    setBTop('89%')
    setBScale(1.14)
    await sleep(350)

    // ── AIRBORNE – up to apex (0.7s) ────────────────────────────────────
    setPhase('airborne')
    setBTrans('left 1.55s cubic-bezier(0.4,0,0.6,1), top 0.72s cubic-bezier(0.22,1,0.36,1), transform 1.55s ease-in-out')
    setBTop('7%')
    setBScale(0.34)

    await sleep(720)

    // ── AIRBORNE – down to landing zone (0.83s) ──────────────────────────
    setBTrans('left 0.85s cubic-bezier(0.55,0.06,0.68,0.19), top 0.85s cubic-bezier(0.55,0.06,0.68,0.19), transform 0.85s ease-in')
    setBTop('57%')
    setBScale(0.66)

    await sleep(850)

    // ── LANDING + dust (0.5s) ────────────────────────────────────────────
    setPhase('landing')
    setShowDust(true)
    await sleep(500)
    setShowDust(false)

    // ── ROLLING toward cochonnet (1.5s) ──────────────────────────────────
    setPhase('rolling')
    setBTrans('left 1.5s ease-in-out, top 1.5s ease-in-out, transform 1.5s ease-in-out')
    setBTop('47%')
    setBScale(0.56)
    setBRotate(720)

    // Wait for both rolling animation and API response
    const [apiResult] = await Promise.all([apiPromise, sleep(1500)])

    if (!apiResult.error) {
      setCredits(apiResult.creditsRemaining)
    }
    setResult(apiResult)

    // ── FINAL POSITION based on result (0.85s) ───────────────────────────
    const pos = RESULT_POS[apiResult.result] ?? RESULT_POS['perdu']
    setBTrans('left 0.85s cubic-bezier(0.34,1.56,0.64,1), top 0.85s cubic-bezier(0.34,1.56,0.64,1), transform 0.85s ease-out')
    setBLeft(`${pos.x}%`)
    setBTop(`${pos.y}%`)
    setBScale(pos.s)
    setBRotate(pos.x >= 50 ? 1080 : 900)

    await sleep(850)

    // ── STOPPED (0.5s) ───────────────────────────────────────────────────
    setPhase('stopped')
    // subtle settle bounce
    setBTrans('transform 0.18s ease-out')
    setBScale(pos.s * 1.08)
    await sleep(180)
    setBScale(pos.s)
    await sleep(320)

    // Confettis for good results
    if (!apiResult.error && ['jackpot', 'gros', 'super'].includes(apiResult.result)) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: apiResult.result === 'jackpot' ? 200 : 120,
          spread:        90,
          origin:        { y: 0.45 },
          colors:        ['#E8622A', '#FFD700', '#ffffff', '#a855f7', '#22c55e'],
        })
      })
    }

    setPhase('result')
    throwingRef.current = false
  }, [game.id, credits])

  function handlePlayAgain() {
    setPhase('idle')
    setResult(null)
    setBLeft('50%')
    setBTop('83%')
    setBScale(1.0)
    setBRotate(0)
    setBTrans('none')
    throwingRef.current = false
  }

  const suspenseText: Record<GamePhase, string | null> = {
    idle:     null,
    windup:   null,
    airborne: "C'est parti ! 🎱",
    landing:  'Atterrissage...',
    rolling:  'Ça roule...',
    stopped:  null,
    result:   null,
  }

  const isJackpotStop = phase === 'stopped' && result?.result === 'jackpot'

  return (
    <div
      className="flex flex-col"
      style={{
        height:   'calc(100vh - 112px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-none flex items-center justify-between px-5 pt-12 pb-3 z-10"
        style={{ background: 'rgba(8,18,38,0.88)', backdropFilter: 'blur(14px)' }}
      >
        <button
          onClick={() => onBack(credits)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-white font-extrabold text-sm">🎳 {game.name}</h1>
          {game.event_name && (
            <p className="text-white/45 text-xs mt-0.5">{game.event_name}</p>
          )}
        </div>

        <div
          className="px-3 py-1.5 rounded-xl min-w-[60px] text-center"
          style={{ backgroundColor: credits > 0 ? '#E8622A' : 'rgba(255,255,255,0.14)' }}
        >
          <p className="text-white text-xs font-bold">
            {credits} crédit{credits !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Scene ───────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Sky */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #5B9EC9 0%, #A8D5E2 28%, #C8DEB8 42%, #D4B578 50%, #C4955A 62%, #A87838 78%, #8C6028 100%)',
          }}
        />

        {/* Sun */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: '18%', top: '5%',
            width: 54, height: 54,
            background: 'radial-gradient(circle, rgba(255,245,160,0.92) 0%, rgba(255,218,80,0.45) 48%, transparent 72%)',
            borderRadius: '50%',
          }}
        />

        {/* Tree silhouette – left */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: 0, top: '22%', bottom: 0, width: '20%',
            background: 'linear-gradient(to bottom, rgba(20,48,28,0.55), rgba(20,48,28,0.82))',
            clipPath: 'polygon(0 100%, 18% 48%, 36% 62%, 52% 18%, 68% 52%, 84% 32%, 100% 0, 100% 100%)',
          }}
        />

        {/* Tree silhouette – right */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: 0, top: '20%', bottom: 0, width: '22%',
            background: 'linear-gradient(to bottom, rgba(20,48,28,0.55), rgba(20,48,28,0.82))',
            clipPath: 'polygon(0 0, 16% 28%, 32% 12%, 50% 48%, 68% 22%, 84% 42%, 100% 48%, 100% 100%, 0 100%)',
          }}
        />

        {/* Perspective lane lines on the ground */}
        <div
          className="absolute pointer-events-none"
          style={{ top: '44%', left: 0, right: 0, bottom: 0 }}
        >
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="50" y1="0" x2="28" y2="100" stroke="rgba(255,255,255,0.10)" strokeWidth="0.6" />
            <line x1="50" y1="0" x2="72" y2="100" stroke="rgba(255,255,255,0.10)" strokeWidth="0.6" />
            <line x1="50" y1="0" x2="12" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <line x1="50" y1="0" x2="88" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <line x1="33"  y1="28" x2="67"  y2="28" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <line x1="24"  y1="55" x2="76"  y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Cochonnet at far end */}
        <div
          className="absolute z-[5]"
          style={{
            left: '50%', top: '37%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Cochonnet glow={isJackpotStop} />
        </div>

        {/* Ball shadow (only when on ground) */}
        {phase !== 'airborne' && phase !== 'windup' && (
          <div
            className="absolute pointer-events-none rounded-full z-[8]"
            style={{
              left:       bLeft,
              top:        bTop,
              width:      `${bScale * 36}px`,
              height:     `${bScale * 10}px`,
              background: 'rgba(0,0,0,0.22)',
              transform:  'translate(-50%, 26px)',
              filter:     'blur(5px)',
              transition: bTrans,
            }}
          />
        )}

        {/* Dust puff on landing */}
        {showDust && (
          <div
            className="absolute pointer-events-none z-[9]"
            style={{ left: '50%', top: '57%', transform: 'translate(-50%, -50%)' }}
          >
            <div style={{
              width: 70, height: 35,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(200,162,105,0.75) 0%, rgba(200,162,105,0) 70%)',
              animation: 'dust-expand 0.55s ease-out both',
            }} />
          </div>
        )}

        {/* The Ball */}
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left:       bLeft,
            top:        bTop,
            transform:  `translate(-50%, -50%) scale(${bScale}) rotate(${bRotate}deg)`,
            transition: bTrans,
            willChange: 'left, top, transform',
          }}
        >
          <MetallicBall size={72} />
        </div>
      </div>

      {/* ── Bottom: suspense + button ────────────────────────────────────── */}
      <div
        className="flex-none px-8 pb-8 pt-4 z-10 flex flex-col items-center justify-center"
        style={{ minHeight: 100, background: 'rgba(8,18,38,0.72)', backdropFilter: 'blur(10px)' }}
      >
        {suspenseText[phase] && (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-white/85 font-semibold text-base">{suspenseText[phase]}</p>
            {phase === 'rolling' && (
              <span className="flex gap-1 ml-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: 'white',
                      animation: `dot-pulse-kf 1.1s ${i * 0.22}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        )}

        {phase === 'idle' && (
          <button
            onClick={handleThrow}
            disabled={credits < 1}
            className="w-full h-16 rounded-2xl font-extrabold text-white text-xl active:scale-[0.97] disabled:opacity-50 btn-pulse"
            style={{ backgroundColor: '#E8622A' }}
          >
            🎳 LANCER !
          </button>
        )}

        {phase !== 'idle' && phase !== 'result' && (
          <div className="h-16" />
        )}
      </div>

      {/* ── Result overlay ───────────────────────────────────────────────── */}
      {phase === 'result' && result && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-end justify-end px-5 pb-10 pt-32"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <div className="w-full bg-white rounded-3xl p-6 shadow-2xl result-in">
            {result.error ? (
              <div className="text-center">
                <p className="text-4xl mb-3">❌</p>
                <p className="text-lg font-bold text-red-600">Erreur</p>
                <p className="text-sm text-gray-400 mt-1">{result.error}</p>
                <button
                  onClick={handlePlayAgain}
                  className="mt-4 w-full h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
                >
                  Retour
                </button>
              </div>
            ) : (
              <>
                {/* Résultat principal */}
                <div className="text-center mb-5">
                  <p className="text-5xl mb-2">{result.emoji}</p>
                  <h2
                    className="text-2xl font-extrabold"
                    style={{ color: result.result === 'perdu' ? '#DC2626' : result.color }}
                  >
                    {result.result === 'perdu' ? 'Raté !' : result.result === 'jackpot' ? '🎉 JACKPOT !' : 'Bravo !'}
                  </h2>
                  <p className="text-base font-semibold text-gray-700 mt-1.5">
                    {result.prizeName}
                  </p>
                </div>

                {/* Coupon gagné */}
                {result.generatesCoupon && result.couponId && (
                  <div
                    className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
                    style={{ backgroundColor: '#E8622A0E', border: '1px solid #E8622A25' }}
                  >
                    <span className="text-2xl">🎟️</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#E8622A' }}>
                        Coupon ajouté à ton compte !
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Montre-le à la buvette pour profiter de ton lot.
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2.5">
                  {result.generatesCoupon && result.couponId && (
                    <Link
                      href="/profil"
                      className="flex items-center justify-center w-full h-12 rounded-2xl font-bold text-white text-sm"
                      style={{ backgroundColor: '#E8622A' }}
                    >
                      Voir mes coupons →
                    </Link>
                  )}

                  {credits > 0 ? (
                    <button
                      onClick={handlePlayAgain}
                      className="w-full h-12 rounded-2xl font-bold text-sm border-2 transition active:scale-[0.97]"
                      style={{ borderColor: '#E8622A', color: '#E8622A' }}
                    >
                      Rejouer ({credits} crédit{credits !== 1 ? 's' : ''} restant{credits !== 1 ? 's' : ''})
                    </button>
                  ) : (
                    <button
                      onClick={() => onBack(0)}
                      className="w-full h-12 rounded-2xl font-semibold text-sm border border-gray-200"
                      style={{ color: '#1D3550' }}
                    >
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

// ── Page principale ───────────────────────────────────────────────────────

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

  function handlePlay(game: Game) {
    setActiveGame(game)
    setScreen('game')
  }

  function handleBack(remaining: number) {
    if (activeGame) {
      setCredits(prev => ({ ...prev, [activeGame.id]: remaining }))
    }
    setActiveGame(null)
    setScreen('hub')
  }

  if (screen === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #0F1E38 100%)' }}
      >
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }}
        />
      </div>
    )
  }

  if (screen === 'game' && activeGame) {
    return (
      <GameView
        game={activeGame}
        initialCredits={credits[activeGame.id] ?? 0}
        onBack={handleBack}
      />
    )
  }

  return <HubView games={games} credits={credits} onPlay={handlePlay} />
}
