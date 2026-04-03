'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  // 'entering' → CSS transitions déclenchées après 1 frame
  // 'visible'  → logo + texte pleinement visibles
  // 'exiting'  → fade-out global
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering')

  useEffect(() => {
    const t0 = setTimeout(() => setPhase('visible'),  50)   // déclenche le fade-in
    const t1 = setTimeout(() => setPhase('exiting'), 1300)  // commence le fade-out
    const t2 = setTimeout(() => onDone(),            1800)  // démonte le splash
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  const entering = phase === 'entering'
  const exiting  = phase === 'exiting'

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#1D3550',
        opacity:    exiting ? 0 : 1,
        transition: exiting ? 'opacity 500ms ease-out' : 'none',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* Logo avec fade-in + zoom */}
      <div
        style={{
          opacity:    entering ? 0 : 1,
          transform:  entering ? 'scale(0.82)' : 'scale(1)',
          transition: 'opacity 600ms ease-out, transform 600ms cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        <Image
          src="/logobde.PNG"
          alt="BDE ECM Dijon"
          width={120}
          height={120}
          className="rounded-2xl"
          priority
        />
      </div>

      {/* Texte avec fade-in décalé */}
      <p
        className="text-white font-semibold text-xl mt-5 tracking-wide"
        style={{
          opacity:         entering ? 0 : 1,
          transform:       entering ? 'translateY(6px)' : 'translateY(0)',
          transition:      'opacity 600ms ease-out 200ms, transform 600ms ease-out 200ms',
        }}
      >
        BDE ECM Dijon
      </p>
    </div>
  )
}
