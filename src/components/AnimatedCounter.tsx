'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number   // ms
  className?: string
  style?: React.CSSProperties
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function AnimatedCounter({ value, duration = 900, className, style }: AnimatedCounterProps) {
  const [displayed, setDisplayed] = useState(value)
  const [flash,     setFlash]     = useState(false)
  const prevRef    = useRef(value)
  const rafRef     = useRef<number | null>(null)
  const startRef   = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to   = value

    if (from === to) return

    // Flash doré quand le solde augmente
    if (to > from) {
      setFlash(true)
      setTimeout(() => setFlash(false), 600)
    }

    prevRef.current = to

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const t       = Math.min(elapsed / duration, 1)
      const current = Math.round(from + (to - from) * easeOut(t))
      setDisplayed(current)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return (
    <span
      className={className}
      style={{
        ...style,
        transition:  'text-shadow 0.3s ease',
        textShadow:  flash
          ? '0 0 20px rgba(255,215,0,0.9), 0 0 40px rgba(255,165,0,0.6)'
          : 'none',
      }}
    >
      {displayed.toLocaleString('fr-FR')}
    </span>
  )
}
