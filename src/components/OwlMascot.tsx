'use client'

import { useEffect, useRef, useState } from 'react'

// ── Speech bubbles pool ────────────────────────────────────────────────────

const IDLE_MESSAGES = [
  'Reste hydraté ce soir 🍺',
  'T\'as bien bossé aujourd\'hui ?',
  'Les prochains events arrivent !',
  'Accumule des points pour des cadeaux 🎁',
  'Le BDE est là pour toi !',
  'Soirée bientôt ? Reste connecté 👀',
]

const PARTY_MESSAGES = [
  '🎉 C\'est la soirée ce soir !',
  '🔥 On se retrouve là-bas ?',
  '🎵 La fête commence bientôt !',
  '🥳 Prêt pour cette nuit ?',
]

const SHAKE_JOKES = [
  'Pourquoi la bière est-elle meilleure froide ? Parce que chaud, c\'est de la soupe ! 🍺',
  'Q : Combien faut-il d\'étudiants pour changer une ampoule ? A : Combien tu paies ?',
  'Mon régime démarre lundi. Comme tous les lundis depuis 2 ans.',
  '3h du mat, la meilleure heure pour penser à son avenir... ou pas.',
  'L\'alcool ne résout pas les problèmes. Mais le jus d\'orange non plus !',
]

const DANCE_FRAMES = ['🦉', '🕺', '🦉', '💃', '🦉', '🕺', '🦉', '🎉']

// ── Composant ──────────────────────────────────────────────────────────────

interface OwlMascotProps {
  partyMode?: boolean
}

export default function OwlMascot({ partyMode = false }: OwlMascotProps) {
  const [message,    setMessage]    = useState<string | null>(null)
  const [isWinking,  setIsWinking]  = useState(false)
  const [isDancing,  setIsDancing]  = useState(false)
  const [danceFrame, setDanceFrame] = useState(0)
  const [tapCount,   setTapCount]   = useState(0)
  const [isNight,    setIsNight]    = useState(false)

  const tapTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const danceTimer  = useRef<ReturnType<typeof setInterval> | null>(null)
  const msgTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Night mode ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = new Date().getHours()
    setIsNight(h >= 21 || h < 6)
  }, [])

  // ── Message aléatoire toutes les 45s ─────────────────────────────────
  useEffect(() => {
    const pool = partyMode ? PARTY_MESSAGES : IDLE_MESSAGES
    const show = () => {
      setMessage(pool[Math.floor(Math.random() * pool.length)])
      msgTimer.current = setTimeout(() => setMessage(null), 4000)
    }
    const interval = setInterval(show, 45_000)
    // Premier message après 5s
    const initial = setTimeout(show, 5_000)
    return () => { clearInterval(interval); clearTimeout(initial); if (msgTimer.current) clearTimeout(msgTimer.current) }
  }, [partyMode])

  // ── Shake detection ───────────────────────────────────────────────────
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0, lastTime = 0

    function onMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const x = acc.x ?? 0, y = acc.y ?? 0, z = acc.z ?? 0
      const now = Date.now()
      if (now - lastTime < 200) return
      const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ)
      if (delta > 30) {
        const joke = SHAKE_JOKES[Math.floor(Math.random() * SHAKE_JOKES.length)]
        setMessage(joke)
        if (msgTimer.current) clearTimeout(msgTimer.current)
        msgTimer.current = setTimeout(() => setMessage(null), 6000)
      }
      lastX = x; lastY = y; lastZ = z; lastTime = now
    }

    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', onMotion)
    }
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  // ── Tap handler ───────────────────────────────────────────────────────
  function handleTap() {
    // Wink
    setIsWinking(true)
    setTimeout(() => setIsWinking(false), 400)

    const next = tapCount + 1
    setTapCount(next)

    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => setTapCount(0), 2000)

    if (next >= 5) {
      setTapCount(0)
      startDance()
    }
  }

  function startDance() {
    if (isDancing) return
    setIsDancing(true)
    let frame = 0
    danceTimer.current = setInterval(() => {
      frame++
      setDanceFrame(frame % DANCE_FRAMES.length)
      if (frame >= DANCE_FRAMES.length * 3) {
        clearInterval(danceTimer.current!)
        setIsDancing(false)
        setDanceFrame(0)
        setMessage('🕺 Je suis trop fort !')
        if (msgTimer.current) clearTimeout(msgTimer.current)
        msgTimer.current = setTimeout(() => setMessage(null), 3000)
      }
    }, 150)
  }

  // ── Emoji ─────────────────────────────────────────────────────────────
  const emoji = isDancing
    ? DANCE_FRAMES[danceFrame]
    : partyMode ? '🦉🎉'
    : isNight   ? '🌙'
    : isWinking ? '😉'
    : '🦉'

  return (
    <div className="relative flex flex-col items-center select-none" style={{ userSelect: 'none' }}>
      {/* Speech bubble */}
      {message && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ minWidth: '180px', maxWidth: '240px' }}
        >
          <div
            className="relative px-3 py-2 rounded-2xl text-xs font-semibold text-center leading-snug shadow-lg"
            style={{ backgroundColor: '#1D3550', color: '#fff' }}
          >
            {message}
            {/* Triangle pointer */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2"
              style={{
                width: 0, height: 0,
                borderLeft:  '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop:   '6px solid #1D3550',
              }}
            />
          </div>
        </div>
      )}

      {/* Owl button */}
      <button
        onClick={handleTap}
        className="text-4xl transition-transform duration-150 active:scale-90"
        style={{
          filter:    partyMode ? 'drop-shadow(0 0 12px rgba(232,98,42,0.7))' : 'none',
          animation: partyMode && !isDancing ? 'owlBounce 0.6s ease-in-out infinite alternate' : 'none',
        }}
        aria-label="Mascotte chouette"
      >
        {emoji}
      </button>

      <style>{`
        @keyframes owlBounce {
          from { transform: translateY(0); }
          to   { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
