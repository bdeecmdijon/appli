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

// Position finale de la boule dans la scène (% du conteneur).
// La cible est centrée à (50%, 40%). Offsets en px calculés pour
// chaque zone, convertis en % d'écran 390 px.
// Zone radii à l'écran (scale 0.22, SVG 280px sur 260 unités) :
//   jackpot≈4px, gros≈8px, super≈12px, bon≈15px, petit≈22px, perdu>31px
const RESULT_FINAL: Record<string, { x: number; y: number; s: number }> = {
  jackpot: { x: 50.0, y: 40.0, s: 0.18 },  // centre exact (cochonnet)
  gros:    { x: 51.5, y: 39.6, s: 0.18 },  // 6 px à droite du centre
  super:   { x: 47.4, y: 40.7, s: 0.18 },  // 10 px à gauche
  bon:     { x: 53.6, y: 39.3, s: 0.18 },  // 14 px à droite
  petit:   { x: 44.9, y: 41.2, s: 0.18 },  // 20 px à gauche
  perdu:   { x: 59.0, y: 40.5, s: 0.19 },  // 35 px à droite (hors cible)
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

// ── SVG : sapin (arbre de pétanque) ───────────────────────────────────────────

function PineTree({ height }: { height: number }) {
  const w = Math.round(height * 0.52)
  const cx = w / 2
  const trunkH = Math.round(height * 0.18)
  const crownH = height - trunkH
  const trunkW = Math.max(5, Math.round(w * 0.16))

  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ display: 'block' }}>
      {/* Tronc */}
      <rect
        x={cx - trunkW / 2} y={crownH}
        width={trunkW} height={trunkH}
        fill="#7A4A18" rx={2}
      />
      {/* Couronne : 3 étages de triangles */}
      <polygon
        points={`${cx},${crownH * 0.10} ${0},${crownH * 0.72} ${w},${crownH * 0.72}`}
        fill="#1A5C0A"
      />
      <polygon
        points={`${cx},${crownH * 0.02} ${w * 0.09},${crownH * 0.50} ${w * 0.91},${crownH * 0.50}`}
        fill="#208010"
      />
      <polygon
        points={`${cx},0 ${w * 0.20},${crownH * 0.32} ${w * 0.80},${crownH * 0.32}`}
        fill="#289A14"
      />
      {/* Reflet clair sur le tier du haut */}
      <polygon
        points={`${cx},0 ${cx - w * 0.08},${crownH * 0.18} ${cx + w * 0.08},${crownH * 0.18}`}
        fill="rgba(255,255,255,0.10)"
      />
    </svg>
  )
}

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

function TargetSVG({ size = 280, highlightZone }: { size?: number; highlightZone?: string }) {
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
      {/* Séparateurs */}
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
          strokeOpacity={0.48}
          filter="url(#tg-glow)"
          style={{ animation: 'zone-pulse-kf 1s ease-in-out infinite' }}
        />
      )}
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
//  Vue unique en perspective depuis derrière le joueur.
//  L'API est appelée avant le lancer — la trajectoire va DIRECTEMENT
//  vers la zone correspondant au résultat, sans détour.
//
// ──────────────────────────────────────────────────────────────────────────────

type GamePhase = 'idle' | 'loading' | 'windup' | 'arc1' | 'arc2' | 'stopped' | 'result'

function GameView({
  game, initialCredits, onBack,
}: {
  game: Game; initialCredits: number; onBack: (remaining: number) => void
}) {
  const [phase,         setPhase]         = useState<GamePhase>('idle')
  const [result,        setResult]        = useState<PlayResult | null>(null)
  const [credits,       setCredits]       = useState(initialCredits)
  const [highlightZone, setHighlightZone] = useState<string | undefined>()

  // État de la boule (position absolue dans la scène)
  const [bLeft,  setBLeft]  = useState('50%')
  const [bTop,   setBTop]   = useState('83%')
  const [bScale, setBScale] = useState(1.0)
  const [bTrans, setBTrans] = useState('none')

  const throwingRef = useRef(false)

  const handleThrow = useCallback(async () => {
    if (throwingRef.current || credits < 1) return
    throwingRef.current = true
    setResult(null)
    setHighlightZone(undefined)

    // ─── 1. Appel API AVANT l'animation ──────────────────────────────────
    setPhase('loading')

    const apiResult = await fetch('/api/games/play', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gameId: game.id }),
    }).then(r => r.json() as Promise<PlayResult>)

    if (!apiResult.error) setCredits(apiResult.creditsRemaining)
    setResult(apiResult)

    // Position finale connue dès maintenant
    const pos    = RESULT_FINAL[apiResult.result] ?? RESULT_FINAL.perdu
    // L'apex de l'arc pointe dans la direction du résultat dès le départ
    const apexX  = 50 + 0.40 * (pos.x - 50)

    // ─── 2. Élan (0.28 s) ────────────────────────────────────────────────
    setPhase('windup')
    setBTrans('left 0.28s ease-out, top 0.28s ease-out, transform 0.28s ease-out')
    setBLeft(`${apexX * 0.15 + 50 * 0.85}%`) // léger déhanchement vers la cible
    setBTop('86%')
    setBScale(1.08)
    await sleep(280)

    // ─── 3. Arc montant vers l'apex (0.70 s) ─────────────────────────────
    setPhase('arc1')
    setBTrans('left 0.70s ease-out, top 0.70s cubic-bezier(0.18,0.9,0.38,1), transform 0.70s ease-out')
    setBLeft(`${apexX}%`)
    setBTop('19%')
    setBScale(0.27)
    await sleep(700)

    // ─── 4. Arc descendant vers la zone finale (1.05 s) ──────────────────
    setPhase('arc2')
    setBTrans('left 1.05s ease-in, top 1.05s ease-in, transform 1.05s ease-in')
    setBLeft(`${pos.x}%`)
    setBTop(`${pos.y}%`)
    setBScale(pos.s)
    await sleep(1050)

    // ─── 5. Atterrissage (micro-rebond) ──────────────────────────────────
    setPhase('stopped')
    setHighlightZone(apiResult.result)
    setBTrans('transform 0.14s ease-out')
    setBScale(pos.s * 1.14)
    await sleep(140)
    setBTrans('transform 0.12s ease-in')
    setBScale(pos.s)
    await sleep(120)

    // Confettis pour les bons résultats
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

    await sleep(680)

    // ─── 6. Résultat ─────────────────────────────────────────────────────
    setPhase('result')
    throwingRef.current = false
  }, [game.id, credits])

  function handlePlayAgain() {
    setPhase('idle')
    setResult(null)
    setHighlightZone(undefined)
    setBLeft('50%')
    setBTop('83%')
    setBScale(1.0)
    setBTrans('none')
    throwingRef.current = false
  }

  const targetGlow = highlightZone
    ? `drop-shadow(0 0 14px ${ZONES.find(z => z.id === highlightZone)?.fill ?? 'white'})`
    : 'drop-shadow(0 3px 12px rgba(0,0,0,0.5))'

  // Arbres gauche — (left, baseY en %, hauteur en px)
  const leftTrees  = [
    { l: '2%',  by: 33, h: 32 },
    { l: '1%',  by: 37, h: 46 },
    { l: '4%',  by: 43, h: 64 },
    { l: '1%',  by: 52, h: 88 },
  ]
  // Arbres droite — mêmes hauteurs, miroir
  const rightTrees = [
    { r: '2%',  by: 33, h: 32 },
    { r: '1%',  by: 37, h: 46 },
    { r: '4%',  by: 43, h: 64 },
    { r: '1%',  by: 52, h: 88 },
  ]

  return (
    <div className="flex flex-col"
      style={{ height: 'calc(100vh - 112px)', position: 'relative', overflow: 'hidden' }}>

      {/* ─── EN-TÊTE ────────────────────────────────────────────────────── */}
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
          <h1 className="text-white font-extrabold text-sm">🎳 {game.name}</h1>
          {game.event_name && <p className="text-white/40 text-xs mt-0.5">{game.event_name}</p>}
        </div>
        <div className="px-3 py-1.5 rounded-xl min-w-[60px] text-center"
          style={{ backgroundColor: credits > 0 ? '#E8622A' : 'rgba(255,255,255,0.14)' }}>
          <p className="text-white text-xs font-bold">{credits} crédit{credits !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ─── SCÈNE ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden z-10">

        {/* Ciel → sol */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(
            180deg,
            #2878C8 0%,
            #4898D8 12%,
            #78B8E0 23%,
            #A8D4EC 33%,
            #C8D8B8 38%,
            #D8C080 43%,
            #C8A060 52%,
            #B08038 68%,
            #8A6228 84%,
            #6E4C1C 100%
          )`,
        }} />

        {/* Soleil */}
        <div style={{
          position: 'absolute', right: '16%', top: '5%',
          width: 54, height: 54,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FFFAAA 0%, #FFE035 42%, rgba(255,215,45,0.22) 70%, transparent 100%)',
          boxShadow: '0 0 52px 26px rgba(255,225,70,0.20)',
          pointerEvents: 'none',
        }} />

        {/* Arbres gauche */}
        {leftTrees.map((t, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: t.l,
            top: `calc(${t.by}% - ${t.h}px)`,
            pointerEvents: 'none',
          }}>
            <PineTree height={t.h} />
          </div>
        ))}

        {/* Arbres droite (miroir horizontal via scaleX=-1) */}
        {rightTrees.map((t, i) => (
          <div key={i} style={{
            position: 'absolute',
            right: t.r,
            top: `calc(${t.by}% - ${t.h}px)`,
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
          }}>
            <PineTree height={t.h} />
          </div>
        ))}

        {/* Bordure bois gauche (trapèze perspective) */}
        <div style={{
          position: 'absolute', left: 0, top: '43%', bottom: 0, width: '10%',
          background: 'linear-gradient(90deg, #4E3010 0%, #704822 55%, #927050 100%)',
          clipPath: 'polygon(0 0, 100% 24%, 100% 100%, 0 100%)',
        }} />

        {/* Bordure bois droite */}
        <div style={{
          position: 'absolute', right: 0, top: '43%', bottom: 0, width: '10%',
          background: 'linear-gradient(270deg, #4E3010 0%, #704822 55%, #927050 100%)',
          clipPath: 'polygon(0 24%, 100% 0, 100% 100%, 0 100%)',
        }} />

        {/* Cible au fond (petite + aplatie pour l'effet perspective) */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '40%',
          transform: 'translate(-50%, -50%) scale(0.22) scaleY(0.44)',
          transformOrigin: 'center center',
          filter: targetGlow,
          transition: 'filter 0.5s ease',
          zIndex: 5,
          pointerEvents: 'none',
        }}>
          <TargetSVG size={280} highlightZone={highlightZone} />
        </div>

        {/* Ombre de la boule sur le sol (uniquement quand au sol) */}
        {(phase === 'idle' || phase === 'loading' || phase === 'windup' || phase === 'stopped') && (
          <div style={{
            position: 'absolute',
            left: bLeft,
            top: bTop,
            width: `${86 * bScale}px`,
            height: `${26 * bScale}px`,
            transform: 'translate(-50%, 18px)',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.28) 0%, transparent 70%)',
            filter: 'blur(3px)',
            zIndex: 4,
            transition: bTrans,
            pointerEvents: 'none',
          }} />
        )}

        {/* La boule */}
        <div style={{
          position: 'absolute',
          left: bLeft,
          top: bTop,
          transform: `translate(-50%, -50%) scale(${bScale})`,
          transition: bTrans,
          zIndex: 10,
          filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.65))',
          willChange: 'left, top, transform',
          pointerEvents: 'none',
        }}>
          <MetallicBall size={100} />
        </div>
      </div>

      {/* ─── ZONE BASSE : bouton / statut ───────────────────────────────── */}
      <div className="flex-none px-6 pb-8 pt-4 flex flex-col items-center justify-center z-10"
        style={{ minHeight: 92, background: 'rgba(6,14,30,0.88)', backdropFilter: 'blur(14px)' }}>

        {phase === 'idle' && (
          <button
            onClick={handleThrow}
            disabled={credits < 1}
            className="w-full h-16 rounded-2xl font-extrabold text-white text-xl active:scale-[0.97] disabled:opacity-50 btn-pulse"
            style={{ backgroundColor: '#E8622A' }}>
            🎱 LANCER !
          </button>
        )}

        {phase === 'loading' && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: 'white' }} />
            <p className="text-white/70 font-semibold text-sm">Préparation...</p>
          </div>
        )}

        {(phase === 'windup' || phase === 'arc1' || phase === 'arc2') && (
          <div className="flex items-center gap-1.5">
            <p className="text-white/85 font-semibold text-base">C&apos;est parti ! 🎱</p>
          </div>
        )}

        {phase === 'stopped' && (
          <div className="flex items-center gap-1.5">
            <p className="text-white/80 font-semibold text-base">...</p>
          </div>
        )}
      </div>

      {/* ─── OVERLAY RÉSULTAT ───────────────────────────────────────────── */}
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
                <div className="text-center mb-5">
                  <p className="text-5xl mb-2">{result.emoji}</p>
                  <h2 className="text-2xl font-extrabold"
                    style={{ color: result.result === 'perdu' ? '#DC2626' : result.color }}>
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
