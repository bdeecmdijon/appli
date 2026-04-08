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
  result:          string
  prizeName:       string
  emoji:           string
  color:           string
  generatesCoupon: boolean
  couponId:        string | null
  creditsRemaining: number
  error?:          string
}

// ── Zone config (matching DB) ─────────────────────────────────────────────

const ZONE_RING: Record<string, { mid: number; color: string }> = {
  perdu:   { mid: 110, color: '#ef4444' },
  petit:   { mid:  90, color: '#f97316' },
  bon:     { mid:  70, color: '#3b82f6' },
  super:   { mid:  50, color: '#22c55e' },
  gros:    { mid:  30, color: '#a855f7' },
  jackpot: { mid:  10, color: '#eab308' },
}

const PRIZES_PREVIEW = [
  { zone: 'jackpot', emoji: '🟡', label: 'Jackpot',   prize: 'Sandwich + boisson offerts',  prob: '2%'  },
  { zone: 'gros',    emoji: '🟣', label: 'Gros lot',  prize: '1 pinte offerte',             prob: '8%'  },
  { zone: 'super',   emoji: '🟢', label: 'Super lot', prize: '1 bière 25cl offerte',        prob: '5%'  },
  { zone: 'bon',     emoji: '🔵', label: 'Bon lot',   prize: '1 soda offert',               prob: '10%' },
  { zone: 'petit',   emoji: '🟠', label: 'Petit lot', prize: '-1€ sur ta commande',         prob: '25%' },
  { zone: 'perdu',   emoji: '🔴', label: 'Raté',      prize: 'Retente au prochain achat',   prob: '50%' },
]

// ── SVG : Cible de pétanque ───────────────────────────────────────────────

function Target({ result }: { result?: string }) {
  const ring = result ? ZONE_RING[result] : null
  return (
    <svg width={252} height={252} viewBox="-126 -126 252 252">
      <defs>
        <filter id="tg-shadow">
          <feDropShadow dx="3" dy="4" stdDeviation="6" floodOpacity="0.3" />
        </filter>
        <filter id="tg-glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Shadow */}
      <circle r={121} fill="rgba(0,0,0,0.2)" transform="translate(3,4)" />
      {/* Zones (outside → inside) */}
      <circle r={120} fill="#ef4444" />
      <circle r={100} fill="#f97316" />
      <circle r={80}  fill="#3b82f6" />
      <circle r={60}  fill="#22c55e" />
      <circle r={40}  fill="#a855f7" />
      <circle r={20}  fill="#eab308" />
      {/* Séparateurs blancs */}
      {[100, 80, 60, 40, 20].map(r => (
        <circle key={r} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      ))}
      {/* Bord extérieur */}
      <circle r={120} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
      {/* Cochonnet */}
      <circle r={11} fill="white" stroke="#ca8a04" strokeWidth={2.5} filter="url(#tg-shadow)" />
      <circle r={5.5} fill="#fbbf24" />
      {/* Anneau gagnant */}
      {ring && (
        <circle
          r={ring.mid}
          fill="none"
          stroke="white"
          strokeWidth={7}
          strokeOpacity={0.95}
          filter="url(#tg-glow)"
        />
      )}
    </svg>
  )
}

// ── SVG : Boule de pétanque ───────────────────────────────────────────────

function PetanqueBall({ size = 64 }: { size?: number }) {
  const r = size / 2 - 3
  const cx = 0
  const cy = 0
  return (
    <svg width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`}>
      <defs>
        <radialGradient id="ball-g" cx="37%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#b8c4d4" />
          <stop offset="55%"  stopColor="#5a6880" />
          <stop offset="100%" stopColor="#1e2a3a" />
        </radialGradient>
        <filter id="ball-shadow">
          <feDropShadow dx="2" dy="3" stdDeviation="4" floodOpacity="0.5" />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="url(#ball-g)" filter="url(#ball-shadow)" />
      {/* Rainures */}
      <path
        d={`M${-r*0.68},${r*0.08} Q${cx},${r*0.52} ${r*0.68},${r*0.08}`}
        stroke="rgba(0,0,0,0.22)" strokeWidth={1.5} fill="none"
      />
      <path
        d={`M${-r*0.6},${-r*0.18} Q${-r*0.1},${-r*0.62} ${r*0.58},${-r*0.18}`}
        stroke="rgba(0,0,0,0.15)" strokeWidth={1} fill="none"
      />
      {/* Reflet */}
      <ellipse cx={cx - r*0.28} cy={cy - r*0.28} rx={r*0.22} ry={r*0.16} fill="rgba(255,255,255,0.22)" transform={`rotate(-35,${cx - r*0.28},${cy - r*0.28})`} />
    </svg>
  )
}

// ── Vue Hub ───────────────────────────────────────────────────────────────

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
                          🎳
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-extrabold" style={{ color: '#1D3550' }}>
                            {game.name}
                          </h3>
                          {game.event_name && (
                            <span
                              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full text-white mt-1"
                              style={{ backgroundColor: '#E8622A' }}
                            >
                              📍 {game.event_name}
                            </span>
                          )}
                          {game.description && (
                            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                              {game.description}
                            </p>
                          )}
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

        {/* Aperçu des lots */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Lots à gagner 🏆</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {PRIZES_PREVIEW.map(item => (
              <div
                key={item.zone}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{item.prize}</p>
                </div>
                <span className="text-xs font-bold text-gray-300 flex-shrink-0">{item.prob}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Vue Jeu (Cochonnet) ───────────────────────────────────────────────────

type GamePhase = 'idle' | 'throwing' | 'landing' | 'result'

function GameView({
  game,
  initialCredits,
  onBack,
}: {
  game:           Game
  initialCredits: number
  onBack:         (remaining: number) => void
}) {
  const [phase,     setPhase]     = useState<GamePhase>('idle')
  const [result,    setResult]    = useState<PlayResult | null>(null)
  const [credits,   setCredits]   = useState(initialCredits)
  const throwingRef = useRef(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleThrow = useCallback(async () => {
    if (throwingRef.current || credits < 1) return
    throwingRef.current = true
    setPhase('throwing')
    setResult(null)

    // API + animation minimale (2.5s) en parallèle
    const [apiResult] = await Promise.all([
      fetch('/api/games/play', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gameId: game.id }),
      }).then(r => r.json() as Promise<PlayResult>),
      new Promise<void>(res => setTimeout(res, 2500)),
    ])

    if (!apiResult.error) {
      setCredits(apiResult.creditsRemaining)
    }
    setResult(apiResult)
    setPhase('landing')

    // Confettis jackpot / gros lot
    if (apiResult.result === 'jackpot' || apiResult.result === 'gros') {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#E8622A', '#FFD700', '#ffffff', '#a855f7', '#22c55e'],
        })
      })
    }

    timerRef.current = setTimeout(() => {
      setPhase('result')
      throwingRef.current = false
    }, 700)
  }, [game.id, credits])

  function handlePlayAgain() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('idle')
    setResult(null)
    throwingRef.current = false
  }

  const isThrown   = phase !== 'idle'
  const showResult = phase === 'result'
  const landedZone = (phase === 'landing' || phase === 'result') && !result?.error
    ? result?.result
    : undefined

  return (
    <div
      className="flex flex-col"
      style={{
        height:     'calc(100vh - 112px)', // minus bottom nav
        background: 'radial-gradient(ellipse at 50% 55%, #16a34a 0%, #14532d 60%, #052e16 100%)',
        position:   'relative',
        overflow:   'hidden',
      }}
    >
      {/* Lignes de terrain décoratifs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute left-6 right-6 top-[44%] h-px bg-white/8" />
        <div className="absolute left-6 right-6 bottom-[22%] h-px bg-white/8" />
        <div
          className="absolute"
          style={{
            left: '15%', right: '15%',
            top: '22%', bottom: '20%',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* ── Header ── */}
      <div
        className="flex-none flex items-center justify-between px-5 pt-12 pb-3 z-10"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)' }}
      >
        <button
          onClick={() => onBack(credits)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
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
          style={{ backgroundColor: credits > 0 ? '#E8622A' : 'rgba(255,255,255,0.15)' }}
        >
          <p className="text-white text-xs font-bold">
            {credits} crédit{credits !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Terrain + Jeu ── */}
      <div className="flex-1 flex flex-col items-center justify-center pb-2 relative z-10">
        {/* Cible */}
        <div>
          <Target result={landedZone} />
        </div>

        {/* Fil de trajectoire pendant le lancer */}
        {phase === 'throwing' && (
          <div
            className="w-0.5 bg-gradient-to-b from-transparent to-white/40"
            style={{ height: 56, marginTop: -4 }}
          />
        )}

        {/* Boule */}
        <div
          style={{
            marginTop: phase === 'throwing' ? 0 : 24,
            transition: isThrown
              ? 'transform 2s cubic-bezier(0.15, 0.05, 0.25, 1.15), margin-top 2s cubic-bezier(0.15, 0.05, 0.25, 1.15)'
              : 'none',
            transform: isThrown ? 'translateY(-188px)' : 'translateY(0px)',
            zIndex: showResult ? 2 : 8,
          }}
        >
          <PetanqueBall size={68} />
        </div>
      </div>

      {/* ── Bouton LANCER / status ── */}
      <div className="flex-none px-8 pb-8 z-10">
        {phase === 'idle' && (
          <button
            onClick={handleThrow}
            disabled={credits < 1}
            className="w-full h-16 rounded-2xl font-extrabold text-white text-xl transition active:scale-[0.97] disabled:opacity-50"
            style={{
              backgroundColor: '#E8622A',
              boxShadow:       '0 4px 28px rgba(232,98,42,0.55)',
            }}
          >
            🎳 LANCER !
          </button>
        )}

        {phase === 'throwing' && (
          <div className="h-16 flex items-center justify-center gap-3">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
            />
            <p className="text-white font-bold text-lg">En vol…</p>
          </div>
        )}

        {(phase === 'landing' || phase === 'result') && (
          <div className="h-16" />
        )}
      </div>

      {/* ── Overlay résultat ── */}
      {showResult && result && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-end justify-end px-5 pb-10 pt-32"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full bg-white rounded-3xl p-6 shadow-2xl">
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
      .not('name', 'is', null) // n'affiche que les jeux avec un nom (exclut les anciens games QR)
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
