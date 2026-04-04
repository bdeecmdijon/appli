'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x:    number
  y:    number
  r:    number
  vx:   number
  vy:   number
  a:    number   // alpha
  va:   number   // alpha velocity
}

interface StarfieldBackgroundProps {
  count?:   number
  color?:   string
  opacity?: number
}

export default function StarfieldBackground({
  count   = 55,
  color   = '#E8622A',
  opacity = 0.18,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let stars: Star[] = []

    function resize() {
      canvas!.width  = canvas!.offsetWidth
      canvas!.height = canvas!.offsetHeight
    }

    function initStars() {
      stars = Array.from({ length: count }, () => ({
        x:  Math.random() * canvas!.width,
        y:  Math.random() * canvas!.height,
        r:  Math.random() * 2.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        a:  Math.random(),
        va: (Math.random() - 0.5) * 0.008,
      }))
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      for (const s of stars) {
        s.x  += s.vx
        s.y  += s.vy
        s.a  += s.va

        // Wrap edges
        if (s.x < 0)              s.x = canvas!.width
        if (s.x > canvas!.width)  s.x = 0
        if (s.y < 0)              s.y = canvas!.height
        if (s.y > canvas!.height) s.y = 0

        // Clamp alpha
        if (s.a < 0.1) { s.a = 0.1; s.va = Math.abs(s.va) }
        if (s.a > 1.0) { s.a = 1.0; s.va = -Math.abs(s.va) }

        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx!.fillStyle = color
        ctx!.globalAlpha = s.a * opacity
        ctx!.fill()
      }

      ctx!.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }

    resize()
    initStars()
    draw()

    const ro = new ResizeObserver(() => { resize(); initStars() })
    ro.observe(canvas)

    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [count, color, opacity])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}
