'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Event {
  id:        string
  title:     string
  starts_at: string
  location:  string | null
  cover_url: string | null
  type:      string | null
}

const TYPE_COLORS: Record<string, string> = {
  soiree_bde:    '#E8622A',
  event_bde:     '#1D3550',
  match_bds:     '#16A34A',
  event_sportif: '#7C3AED',
}

const TYPE_LABELS: Record<string, string> = {
  soiree_bde:    'Soirée BDE',
  event_bde:     'Événement BDE',
  match_bds:     'Match BDS',
  event_sportif: 'Événement sportif',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    day:   d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }),
    time:  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function EvenementsPage() {
  const router = useRouter()
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, starts_at, location, cover_url, type')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#F3F4F6' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold" style={{ color: '#1D3550' }}>Événements à venir</h1>
      </div>

      <div className="px-5 pb-10 space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-bold text-lg" style={{ color: '#1D3550' }}>Aucun événement prévu</p>
            <p className="text-sm text-gray-400 mt-1">Reviens bientôt !</p>
          </div>
        ) : (
          events.map(event => {
            const { day, time } = formatDate(event.starts_at)
            const typeColor = TYPE_COLORS[event.type ?? ''] ?? '#1D3550'
            const typeLabel = TYPE_LABELS[event.type ?? ''] ?? null

            return (
              <Link
                key={event.id}
                href={`/accueil/${event.id}`}
                className="flex gap-4 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                {/* Image */}
                <div className="flex-shrink-0 w-28" style={{ aspectRatio: '4/5' }}>
                  {event.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.cover_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-3xl"
                      style={{ background: `linear-gradient(160deg, ${typeColor} 0%, ${typeColor}cc 100%)` }}
                    >
                      🎉
                    </div>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
                  <div>
                    {typeLabel && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: typeColor + '18', color: typeColor }}
                      >
                        {typeLabel}
                      </span>
                    )}
                    <h2
                      className="font-extrabold text-sm leading-snug mt-1.5 line-clamp-2"
                      style={{ color: '#1D3550' }}
                    >
                      {event.title}
                    </h2>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      <span className="capitalize">{day} · {time}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
