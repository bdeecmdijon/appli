'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface PartyModeBannerProps {
  onPartyDetected?: (hasParty: boolean) => void
}

export default function PartyModeBanner({ onPartyDetected }: PartyModeBannerProps) {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    supabase
      .from('events')
      .select('id, title')
      .gte('starts_at', todayStart.toISOString())
      .lte('starts_at', todayEnd.toISOString())
      .then(({ data }) => {
        const list = data ?? []
        setEvents(list)
        onPartyDetected?.(list.length > 0)
      })
  }, [onPartyDetected])

  if (events.length === 0) return null

  const label = events.length === 1
    ? events[0].title
    : `${events.length} événements aujourd'hui`

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3 overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, #E8622A 0%, #FF6B35 50%, #FFD700 100%)',
        boxShadow:  '0 4px 20px rgba(232,98,42,0.45)',
        animation:  'partyPulse 2s ease-in-out infinite',
      }}
    >
      {/* Sparkles */}
      <span className="text-2xl flex-shrink-0" style={{ animation: 'sparkSpin 1.5s linear infinite' }}>🔥</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-extrabold text-sm leading-tight">SOIRÉE CE SOIR !</p>
        <p className="text-white/80 text-xs truncate mt-0.5">{label}</p>
      </div>
      <span className="text-xl flex-shrink-0">🎉</span>

      {/* Animated shimmer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
          animation:   'shimmer 2.5s linear infinite',
        }}
      />

      <style>{`
        @keyframes partyPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.01); }
        }
        @keyframes sparkSpin {
          0%   { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(15deg) scale(1.15); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
