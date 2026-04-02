'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Config types d'événements ──────────────────────────────────────────────

const TYPE_CONFIG = {
  soiree_bde:    { color: '#EF4444', label: 'Soirée BDE' },
  event_bde:     { color: '#E8622A', label: 'Événement BDE' },
  match_bds:     { color: '#3B82F6', label: 'Match BDS' },
  event_sportif: { color: '#22C55E', label: 'Événement sportif' },
} as const

type EventType = keyof typeof TYPE_CONFIG

interface CalEvent {
  id: string
  title: string
  starts_at: string
  type: EventType
}

// ── Constantes ─────────────────────────────────────────────────────────────

const DAYS_FR   = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Mock pour fallback
const MOCK_EVENTS: CalEvent[] = [
  { id: '1', title: 'Soirée de rentrée BDE',        starts_at: '2026-04-12T21:00:00', type: 'soiree_bde' },
  { id: '2', title: 'Tournoi de foot inter-promos',  starts_at: '2026-04-18T14:00:00', type: 'match_bds' },
  { id: '3', title: 'Conférence Entrepreneuriat',    starts_at: '2026-04-25T18:30:00', type: 'event_bde' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// Décalage du premier jour (lundi = 0 … dimanche = 6)
function firstWeekdayOffset(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function colorOf(type: string) {
  return TYPE_CONFIG[type as EventType]?.color ?? '#E8622A'
}

// ── Composant ──────────────────────────────────────────────────────────────

export default function CalendarSection() {
  const router   = useRouter()
  const today    = new Date()
  const [view,   setView]   = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modal,  setModal]  = useState<CalEvent[] | null>(null)

  const year  = view.getFullYear()
  const month = view.getMonth()

  // ── Fetch events du mois ────────────────────────────────────────────────

  const fetchMonthEvents = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(year, month, 1).toISOString()
      const end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('events')
        .select('id, title, starts_at, type')
        .gte('starts_at', start)
        .lte('starts_at', end)
        .order('starts_at', { ascending: true })

      if (error) throw error
      const filtered = (data && data.length > 0) ? data : MOCK_EVENTS.filter(e => {
        const d = new Date(e.starts_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      setEvents(filtered)
    } catch {
      setEvents(MOCK_EVENTS.filter(e => {
        const d = new Date(e.starts_at)
        return d.getFullYear() === year && d.getMonth() === month
      }))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchMonthEvents() }, [fetchMonthEvents])

  // ── Grille calendrier ───────────────────────────────────────────────────

  const totalDays    = daysInMonth(year, month)
  const startOffset  = firstWeekdayOffset(year, month)
  const totalCells   = Math.ceil((startOffset + totalDays) / 7) * 7
  const isThisMonth  = today.getFullYear() === year && today.getMonth() === month

  // Grouper les events par jour du mois
  const byDay: Record<number, CalEvent[]> = {}
  events.forEach(e => {
    const d = new Date(e.starts_at).getDate()
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(e)
  })

  function handleDay(day: number) {
    const evts = byDay[day]
    if (!evts?.length) return
    if (evts.length === 1) {
      router.push(`/accueil/${evts[0].id}`)
    } else {
      setModal(evts)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section>
      {/* Titre + navigation mois */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold" style={{ color: '#1D3550' }}>Calendrier</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#1D3550' + '10' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-sm font-bold min-w-[130px] text-center" style={{ color: '#1D3550' }}>
            {MONTHS_FR[month]} {year}
          </span>
          <button
            onClick={() => setView(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#1D3550' + '10' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Entêtes jours */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_FR.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">{d}</div>
          ))}
        </div>

        {/* Grille */}
        {loading ? (
          <div className="h-44 flex items-center justify-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#E8622A', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }, (_, i) => {
              const day      = i - startOffset + 1
              const valid    = day >= 1 && day <= totalDays
              const isToday  = isThisMonth && valid && day === today.getDate()
              const dayEvts  = valid ? (byDay[day] ?? []) : []
              const hasEvts  = dayEvts.length > 0

              return (
                <div
                  key={i}
                  onClick={() => valid && hasEvts && handleDay(day)}
                  className={`flex flex-col items-center py-1.5 min-h-[50px] border-b border-r border-gray-50
                    ${hasEvts ? 'cursor-pointer active:bg-orange-50' : ''}`}
                >
                  {valid && (
                    <>
                      <span
                        className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium"
                        style={
                          isToday
                            ? { backgroundColor: '#E8622A', color: '#fff', fontWeight: 700 }
                            : hasEvts
                              ? { color: '#1D3550', fontWeight: 600 }
                              : { color: '#9CA3AF' }
                        }
                      >
                        {day}
                      </span>
                      {hasEvts && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center" style={{ maxWidth: 32 }}>
                          {dayEvts.slice(0, 3).map((e, idx) => (
                            <span
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: colorOf(e.type) }}
                            />
                          ))}
                          {dayEvts.length > 3 && (
                            <span className="text-[8px] text-gray-400 font-bold">+{dayEvts.length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
        {(Object.entries(TYPE_CONFIG) as [string, { color: string; label: string }][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
            <span className="text-xs text-gray-500">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Modal événements multiples */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-5 pt-2 pb-8">
              <h3 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>
                {modal.length} événements ce jour
              </h3>
              <div className="space-y-2 mb-4">
                {modal.map(e => {
                  const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.event_bde
                  return (
                    <button
                      key={e.id}
                      onClick={() => { setModal(null); router.push(`/accueil/${e.id}`) }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition"
                      style={{ backgroundColor: cfg.color + '10', border: `1px solid ${cfg.color}30` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>{e.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(e.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{cfg.label}
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-full h-11 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500"
              >
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
