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
  { zone: 'super',   emoji: '🟢', prize: '1 bière 25cl offerte' },
  { zone: 'bon',     emoji: '🔵', prize: '1 soda offert' },
  { zone: 'petit',   emoji: '🟠', prize: '-1€ sur ta prochaine commande' },
]

// Zones : rayons proportionnels à √(probabilité cumulée), R_max = 130
// Jackpot=2%, Gros=5%, Super=8%, Bon=10%, Petit=25%, Perdu=50%
const ZONES = [
  { id: 'perdu',   r: 130, inner:  92, fill: '#EF4444' },
  { id: 'petit',   r:  92, inner:  65, fill: '#F97316' },
  { id: 'bon',     r:  65, inner:  50, fill: '#3B82F6' },
  { id: 'super',   r:  50, inner:  34, fill: '#22C55E' },
  { id: 'gros',    r:  34, inner:  18, fill: '#A855F7' },
  { id: 'jackpot', r:  18, inner:   0, fill: '#EAB308' },
]

// Position finale de la boule dans le conteneur de la cible (280 × 280 px, centre = 140, 140)
// Distances vérifiées pour être dans la bonne zone (échelle : 1 unité SVG ≈ 1.077 px)
const RESULT_BALL_POS: Record<string, { x: number; y: number }> = {
  jackpot: { x: 140, y: 140 },  // r = 0   ∈ jackpot (< 19 px)
  gros:    { x: 165, y: 125 },  // r ≈ 29  ∈ gros    (19–37 px)
  super:   { x: 102, y: 168 },  // r ≈ 47  ∈ super   (37–54 px)
  bon:     { x: 195, y: 105 },  // r ≈ 65  ∈ bon     (54–70 px)
  petit:   { x:  70, y: 192 },  // r ≈ 87  ∈ petit   (70–99 px)
  perdu:   { x: 235, y: 195 },  // r ≈ 110 ∈ perdu   (99–140 px)
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

// ── SVG : boule métallique ─────────────────────────────────────────────────────

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
      <ellipse cx="34" cy="33" rx="13" ry="9"   fill="rgba(255,255,255,0.38)" transform="rotate(-30 34 33)" />
      <ellipse cx="63" cy="65" rx="7"  ry="4.5" fill="rgba(255,255,255,0.13)" transform="rotate(-30 63 65)" />
    </svg>
  )
}

// ── SVG : cible (zones proportionnelles) ──────────────────────────────────────

function TargetSVG({
  size = 280,
  highlightZone,
}: {
  size?: number
  highlightZone?: string
}) {
  const hz = highlightZone ? ZONES.find(z => z.id === highlightZone) : null

  return (
    <svg width={size} height={size} viewBox="-130 -130 260 260" style={{ display: 'block' }}>
      <defs>
        <filter id="tg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="tg-drop">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Zones extérieur → intérieur */}
      {ZONES.map(z => <circle key={z.id} r={z.r} fill={z.fill} />)}

      {/* Séparateurs blancs */}
      {ZONES.map(z => (
        <circle key={z.id + '-s'} r={z.r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      ))}

      {/* Cochonnet */}
      <circle r={9} fill="white" filter="url(#tg-drop)" />
      <circle r={5} fill="#E8622A" />
      <ellipse cx="-2" cy="-2.5" rx="2" ry="1.2" fill="rgba(255,255,255,0.55)" />

      {/* Zone gagnante illuminée */}
      {hz && (
        <circle
          r={(hz.r + hz.inner) / 2}
          fill="none"
          stroke="white"
          strokeWidth={hz.r - hz.inner}
          strokeOpacity={0.45}
          filter="url(#tg-glow)"
          style={{ animation: 'zone-pulse-kf 1s ease-in-out infinite' }}
        />
      )}
    </svg>
  )
}

// ── HubView ────────────────────────────────────────────────────────────────────

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
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
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
                      style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}>
                      {c}
                    </span>
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
                          style={{ backgroundColor: '#1D355010' }}>🎱</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-extrabold" style={{ color: '#1D3550' }}>🎱 {game.name}</h3>
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
                        {c > 0 ? '🎳 Jouer !' : 'Pas de crédit'}
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
              { icon: '🎱', text: 'Lance et gagne !' },
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

// ── GameView ───────────────────────────────────────────────────────────────────
//
// Phase 1 – Vue lanceur  : terrain en longueur, boule proche, cible au fond
// Phase 2 – Vue du dessus : caméra depuis le cochonnet, boule qui arrive
//
// ──────────────────────────────────────────────────────────────────────────────

type GamePhase = 'idle' | 'launching' | 'camera' | 'rolling' | 'stopped' | 'result'

function GameView({
  game,
  initialCredits,
  onBack,
}: {
  game: Game
  initialCredits: number
  onBack: (remaining: number) => void
}) {
  const [phase,         setPhase]         = useState<GamePhase>('idle')
  const [result,        setResult]        = useState<PlayResult | null>(null)
  const [credits,       setCredits]       = useState(initialCredits)
  const [highlightZone, setHighlightZone] = useState<string | undefined>()

  // Vue lanceur — état de la boule
  const [lBottom, setLBottom] = useState('10%')   // distance depuis le bas en %
  const [lScale,  setLScale]  = useState(1.0)

  // Vue du dessus — position de la boule (pixels dans conteneur 280×280)
  const [tX,     setTX]     = useState(140)
  const [tY,     setTY]     = useState(-50)
  const [tTrans, setTTrans] = useState('none')

  const throwingRef = useRef(false)

  const handleThrow = useCallback(async () => {
    if (throwingRef.current || credits < 1) return
    throwingRef.current = true
    setResult(null)
    setHighlightZone(undefined)

    // Reset position vue du dessus (au-dessus de la cible)
    setTX(140)
    setTY(-50)
    setTTrans('none')

    // Appel API dès le départ
    const apiPromise = fetch('/api/games/play', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gameId: game.id }),
    }).then(r => r.json() as Promise<PlayResult>)

    // ─── PHASE : lancer (0.5 s) ─────────────────────────────────────────
    // La boule rétrécit et remonte vers la cible
    setPhase('launching')
    setLBottom('62%')
    setLScale(0.10)
    await sleep(500)

    // ─── PHASE : transition caméra (0.3 s) ──────────────────────────────
    setPhase('camera')
    await sleep(300)

    // ─── PHASE : roulement ──────────────────────────────────────────────
    setPhase('rolling')
    await sleep(60) // laisser le DOM valider la position initiale

    // La boule descend vers le centre (ease-in = accélération)
    setTTrans('left 1.8s ease-in, top 1.8s ease-in')
    setTX(140)
    setTY(140) // vers le centre de la cible

    // Attente API + animation de roulement
    const [apiResult] = await Promise.all([apiPromise, sleep(1800)])

    if (!apiResult.error) setCredits(apiResult.creditsRemaining)
    setResult(apiResult)

    // La boule décélère vers sa position finale (ease-out)
    const pos = RESULT_BALL_POS[apiResult.result] ?? RESULT_BALL_POS.perdu
    setTTrans('left 1.0s cubic-bezier(0.2,1,0.35,1), top 1.0s cubic-bezier(0.2,1,0.35,1)')
    setTX(pos.x)
    setTY(pos.y)
    await sleep(1000)

    // ─── PHASE : arrêt ──────────────────────────────────────────────────
    setPhase('stopped')
    setHighlightZone(apiResult.result)

    if (!apiResult.error && ['jackpot', 'gros', 'super'].includes(apiResult.result)) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: apiResult.result === 'jackpot' ? 220 : 130,
          spread:        90,
          origin:        { y: 0.45 },
          colors:        ['#E8622A', '#FFD700', '#ffffff', '#a855f7', '#22c55e'],
        })
      })
    }

    await sleep(750)

    // ─── PHASE : résultat ───────────────────────────────────────────────
    setPhase('result')
    throwingRef.current = false
  }, [game.id, credits])

  function handlePlayAgain() {
    setPhase('idle')
    setResult(null)
    setHighlightZone(undefined)
    setLBottom('10%')
    setLScale(1.0)
    setTX(140)
    setTY(-50)
    setTTrans('none')
    throwingRef.current = false
  }

  const isLaunchView = phase === 'idle' || phase === 'launching'
  const isTopView    = !isLaunchView

  const SUSPENSE: Partial<Record<GamePhase, string>> = {
    launching: "C'est parti ! 🎱",
    camera:    "C'est parti ! 🎱",
    rolling:   'Ça roule...',
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 112px)', position: 'relative', overflow: 'hidden' }}
    >
      {/* ─── EN-TÊTE ────────────────────────────────────────────────────── */}
      <div
        className="flex-none flex items-center justify-between px-5 pt-12 pb-3 z-20"
        style={{ background: 'rgba(6,14,32,0.92)', backdropFilter: 'blur(16px)' }}
      >
        <button
          onClick={() => onBack(credits)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-white font-extrabold text-sm">🎳 {game.name}</h1>
          {game.event_name && <p className="text-white/40 text-xs mt-0.5">{game.event_name}</p>}
        </div>

        <div
          className="px-3 py-1.5 rounded-xl min-w-[60px] text-center"
          style={{ backgroundColor: credits > 0 ? '#E8622A' : 'rgba(255,255,255,0.14)' }}
        >
          <p className="text-white text-xs font-bold">{credits} crédit{credits !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ─── SCÈNE (deux calques superposés) ────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden z-10">

        {/* ══════════════════════════════════════════════════════
            VUE LANCEUR – perspective derrière le joueur
            ══════════════════════════════════════════════════════ */}
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: isLaunchView ? 1 : 0,
            transition: 'opacity 0.32s ease',
            pointerEvents: isLaunchView ? 'auto' : 'none',
          }}
        >
          {/* Ciel → sol (dégradé réaliste) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(
              180deg,
              #4A8FC4 0%,
              #72B8D0 24%,
              #A8C898 38%,
              #D2B888 46%,
              #C8A268 56%,
              #A87C38 72%,
              #8A6228 100%
            )`,
          }} />

          {/* Bande d'horizon (arbres floutés) */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '34%', height: '12%',
            background: 'rgba(24,50,22,0.30)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }} />

          {/* Lignes de perspective SVG */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 100 100" preserveAspectRatio="none"
          >
            {/* Point de fuite : (50, 43) */}
            {/* Bordures extérieures de la piste */}
            <line x1="9"  y1="100" x2="50" y2="43" stroke="rgba(100,72,36,0.70)" strokeWidth="0.9" />
            <line x1="91" y1="100" x2="50" y2="43" stroke="rgba(100,72,36,0.70)" strokeWidth="0.9" />
            {/* Lignes centrales de guidage */}
            <line x1="30" y1="100" x2="50" y2="43" stroke="rgba(200,168,120,0.18)" strokeWidth="0.4" />
            <line x1="70" y1="100" x2="50" y2="43" stroke="rgba(200,168,120,0.18)" strokeWidth="0.4" />
            {/* Marqueurs de distance horizontaux */}
            <line x1="32" y1="57"  x2="68" y2="57"  stroke="rgba(200,168,120,0.14)" strokeWidth="0.35" />
            <line x1="23" y1="68"  x2="77" y2="68"  stroke="rgba(200,168,120,0.12)" strokeWidth="0.30" />
            <line x1="14" y1="81"  x2="86" y2="81"  stroke="rgba(200,168,120,0.10)" strokeWidth="0.25" />
          </svg>

          {/* Bordure bois gauche (trapèze) */}
          <div style={{
            position: 'absolute', left: 0, top: '43%', bottom: 0, width: '10%',
            background: 'linear-gradient(90deg, #5A3818, #7A5232 55%, #9A7052)',
            clipPath: 'polygon(0 0, 100% 26%, 100% 100%, 0 100%)',
          }} />

          {/* Bordure bois droite */}
          <div style={{
            position: 'absolute', right: 0, top: '43%', bottom: 0, width: '10%',
            background: 'linear-gradient(270deg, #5A3818, #7A5232 55%, #9A7052)',
            clipPath: 'polygon(0 26%, 100% 0, 100% 100%, 0 100%)',
          }} />

          {/* Cible au loin (perspective : aplatie + petite) */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '42%',
            transform: 'translate(-50%, -50%) scale(0.19) scaleY(0.48)',
            transformOrigin: 'center center',
            filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.50))',
            pointerEvents: 'none',
          }}>
            <TargetSVG size={280} />
          </div>

          {/* Ombre de la boule au sol */}
          <div style={{
            position: 'absolute',
            left: '50%',
            bottom: `calc(${lBottom} - 12px)`,
            width:  `${80 * lScale}px`,
            height: `${24 * lScale}px`,
            transform: 'translate(-50%, 50%)',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)',
            filter: 'blur(3px)',
            transition: phase === 'launching' ? 'all 0.5s ease-in' : 'none',
            zIndex: 5,
            pointerEvents: 'none',
          }} />

          {/* La boule (vue lanceur) */}
          <div style={{
            position: 'absolute',
            left: '50%',
            bottom: lBottom,
            transform: `translate(-50%, 50%) scale(${lScale})`,
            transformOrigin: 'center bottom',
            transition: phase === 'launching' ? 'bottom 0.5s ease-in, transform 0.5s ease-in' : 'none',
            filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.65))',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            <MetallicBall size={104} />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            VUE DU DESSUS – depuis le cochonnet, boule qui arrive
            ══════════════════════════════════════════════════════ */}
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: isTopView ? 1 : 0,
            transition: 'opacity 0.32s ease',
            pointerEvents: isTopView ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 0,
          }}
        >
          {/* Sol sablonneux */}
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(155deg, #C8A868 0%, #D4B890 35%, #C49868 65%, #B08040 100%)',
          }} />

          {/* Grains de sable subtils */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.08,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '9px 9px',
            pointerEvents: 'none',
          }} />

          {/* Conteneur cible + boule */}
          <div style={{ position: 'relative', width: 280, height: 280, zIndex: 5, flexShrink: 0 }}>
            {/* Ombre de la cible sur le sol */}
            <div style={{
              position: 'absolute', inset: -8,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.12)',
              filter: 'blur(12px)',
            }} />

            <TargetSVG size={280} highlightZone={highlightZone} />

            {/* Boule (visible dès la phase rolling) */}
            {(phase === 'rolling' || phase === 'stopped' || phase === 'result') && (
              <div style={{
                position: 'absolute',
                left: tX,
                top:  tY,
                transform: 'translate(-50%, -50%)',
                transition: tTrans,
                zIndex: 15,
                filter: 'drop-shadow(0 5px 16px rgba(0,0,0,0.60))',
                willChange: 'left, top',
              }}>
                <MetallicBall size={46} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ZONE BASSE : texte de suspense + bouton ────────────────────── */}
      <div
        className="flex-none px-6 pb-8 pt-4 flex flex-col items-center justify-center z-10"
        style={{ minHeight: 96, background: 'rgba(6,14,32,0.86)', backdropFilter: 'blur(14px)' }}
      >
        {SUSPENSE[phase] && (
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-white/85 font-semibold text-base">{SUSPENSE[phase]}</p>
            {phase === 'rolling' && (
              <span className="flex gap-1 ml-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block', width: 6, height: 6,
                      borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
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
            🎱 LANCER !
          </button>
        )}
      </div>

      {/* ─── OVERLAY RÉSULTAT ───────────────────────────────────────────── */}
      {phase === 'result' && result && (
        <div
          className="absolute inset-0 z-30 flex items-end px-5 pb-8"
          style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)' }}
        >
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
                {/* Résultat principal */}
                <div className="text-center mb-5">
                  <p className="text-5xl mb-2">{result.emoji}</p>
                  <h2 className="text-2xl font-extrabold"
                    style={{ color: result.result === 'perdu' ? '#DC2626' : result.color }}>
                    {result.result === 'perdu'
                      ? 'Raté ! 😢'
                      : result.result === 'jackpot'
                        ? '🎉 JACKPOT !'
                        : 'Bravo !'}
                  </h2>
                  <p className="text-base font-semibold text-gray-700 mt-1.5">{result.prizeName}</p>
                </div>

                {/* Coupon gagné */}
                {result.generatesCoupon && result.couponId && (
                  <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
                    style={{ backgroundColor: '#E8622A0E', border: '1px solid #E8622A25' }}>
                    <span className="text-2xl">🎟️</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#E8622A' }}>Coupon ajouté à ton compte !</p>
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

  function handlePlay(game: Game) {
    setActiveGame(game)
    setScreen('game')
  }

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
