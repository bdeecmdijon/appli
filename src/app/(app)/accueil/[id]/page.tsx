'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Composant Sondage ─────────────────────────────────────────────────────

interface Sondage {
  id: string
  question: string
  options: string[]
}

interface VoteCounts {
  [option: string]: number
}

function PollSection({ eventId }: { eventId: string }) {
  const [sondage,   setSondage]   = useState<Sondage | null>(null)
  const [userVote,  setUserVote]  = useState<string | null>(null)
  const [counts,    setCounts]    = useState<VoteCounts>({})
  const [totalVotes, setTotalVotes] = useState(0)
  const [voting,    setVoting]    = useState(false)
  const [userId,    setUserId]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Utilisateur courant
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      // Sondage lié à cet event
      const { data: s } = await supabase
        .from('sondages')
        .select('id, question, options')
        .eq('event_id', eventId)
        .single()

      if (!s) return
      setSondage(s)

      // Tous les votes pour ce sondage
      const { data: votes } = await supabase
        .from('sondages_votes')
        .select('option_choisie, user_id')
        .eq('sondage_id', s.id)

      if (votes) {
        const c: VoteCounts = {}
        votes.forEach(v => { c[v.option_choisie] = (c[v.option_choisie] ?? 0) + 1 })
        setCounts(c)
        setTotalVotes(votes.length)

        if (user) {
          const mine = votes.find(v => v.user_id === user.id)
          if (mine) setUserVote(mine.option_choisie)
        }
      }
    }
    load()
  }, [eventId])

  async function vote(option: string) {
    if (!sondage || !userId || userVote) return
    setVoting(true)

    const { error } = await supabase.from('sondages_votes').insert({
      sondage_id: sondage.id,
      user_id: userId,
      option_choisie: option,
    })

    if (!error) {
      setUserVote(option)
      setCounts(prev => ({ ...prev, [option]: (prev[option] ?? 0) + 1 }))
      setTotalVotes(t => t + 1)
    }
    setVoting(false)
  }

  if (!sondage) return null

  const hasVoted = !!userVote

  return (
    <div>
      <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Sondage</h2>
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>{sondage.question}</p>

        <div className="space-y-2">
          {sondage.options.map(option => {
            const voteCount = counts[option] ?? 0
            const pct       = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
            const isChosen  = userVote === option

            return (
              <button
                key={option}
                onClick={() => !hasVoted && vote(option)}
                disabled={voting || (!userId)}
                className="w-full relative rounded-xl overflow-hidden text-left transition active:scale-[0.98] disabled:opacity-60"
                style={{
                  border: `2px solid ${isChosen ? '#E8622A' : '#E5E7EB'}`,
                  backgroundColor: hasVoted ? 'transparent' : 'white',
                }}
              >
                {/* Barre de progression */}
                {hasVoted && (
                  <div
                    className="absolute inset-0 rounded-xl transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: isChosen ? '#E8622A' + '20' : '#1D3550' + '08' }}
                  />
                )}
                <div className="relative flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-medium" style={{ color: isChosen ? '#E8622A' : '#1D3550' }}>
                    {isChosen && '✓ '}{option}
                  </span>
                  {hasVoted && (
                    <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: isChosen ? '#E8622A' : '#6B7280' }}>
                      {pct}%
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">
          {hasVoted ? `${totalVotes} vote${totalVotes > 1 ? 's' : ''}` : 'Sélectionne une option pour voter'}
        </p>
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Event {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  cover_url: string | null
  price_cents: number
}

// ── Mock fallback ──────────────────────────────────────────────────────────

const MOCK_EVENTS: Record<string, Event> = {
  '1': {
    id: '1',
    title: 'Soirée de rentrée BDE',
    starts_at: '2026-04-12T21:00:00',
    ends_at: '2026-04-13T02:00:00',
    location: 'Le Consortium, 1 rue Paul Cabet, Dijon',
    description: `La grande soirée de rentrée du BDE ECM Dijon est de retour ! 🎉\n\nVenez célébrer le début de cette nouvelle année scolaire avec tous vos camarades dans l'une des plus belles salles de Dijon.\n\nAu programme :\n- DJ set toute la nuit\n- Open bar premium (2h)\n- Photo booth souvenir\n- Goodies BDE offerts aux 100 premiers`,
    cover_url: null,
    price_cents: 1500,
  },
  '2': {
    id: '2',
    title: 'Tournoi de foot inter-promos',
    starts_at: '2026-04-18T14:00:00',
    ends_at: '2026-04-18T18:00:00',
    location: 'Stade Gaston-Gérard, Dijon',
    description: `Le tournoi de football inter-promos revient pour sa 3e édition ! ⚽\n\nToutes les promotions s'affrontent pour décrocher le trophée du BDE. Que tu sois un crack du ballon ou juste là pour l'ambiance, tout le monde est le bienvenu.\n\nFormat :\n- Équipes de 5 (+ 2 remplaçants)\n- Phase de poules puis élimination directe\n- Finale et remise des prix à 17h30\n\nInscriptions en équipe obligatoires avant le 15 avril. Places limitées !`,
    cover_url: null,
    price_cents: 0,
  },
  '3': {
    id: '3',
    title: 'Conférence Entrepreneuriat',
    starts_at: '2026-04-25T18:30:00',
    ends_at: '2026-04-25T20:30:00',
    location: 'Amphi A — ECM Dijon',
    description: `Le BDE ECM Dijon accueille trois entrepreneurs locaux pour une conférence inspirante sur les parcours atypiques et la création d'entreprise. 💡\n\nIntervenants :\n- Camille R. — Fondatrice d'une startup FoodTech (promo 2019)\n- Marc D. — CEO d'une agence digitale dijonnaise\n- Sophie L. — Directrice associée d'un cabinet de conseil RH\n\nUne heure d'échanges suivie d'un cocktail networking. L'occasion idéale pour tisser des liens avec des alumni et des pros du secteur.`,
    cover_url: null,
    price_cents: 0,
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toIcsDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', 'T')
}

function addToCalendar(event: Event) {
  const start = toIcsDate(event.starts_at)
  const end   = event.ends_at ? toIcsDate(event.ends_at) : toIcsDate(event.starts_at)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BDE ECM Dijon//FR',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    event.location ? `LOCATION:${event.location}` : '',
    `DESCRIPTION:BDE ECM Dijon`,
    `UID:${event.id}@bde-ecm-dijon`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

async function shareEvent(event: Event, setCopied: (v: boolean) => void) {
  const url  = window.location.href
  const text = `${event.title}${event.location ? ` — ${event.location}` : ''}`

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: event.title, text, url })
      return
    } catch {
      // annulé par l'user, ne rien faire
      return
    }
  }
  // Fallback : copier le lien
  await navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatPrice(cents: number) {
  if (cents === 0) return 'Gratuit'
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event,   setEvent]   = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    async function fetchEvent() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, starts_at, ends_at, location, description, cover_url, price_cents')
          .eq('id', id)
          .single()

        if (error || !data) {
          // Fallback mock si l'id correspond
          setEvent(MOCK_EVENTS[id] ?? null)
        } else {
          setEvent(data)
        }
      } catch {
        setEvent(MOCK_EVENTS[id] ?? null)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchEvent()
  }, [id])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-64 bg-gray-200 animate-pulse" />
        <div className="px-5 pt-5 space-y-3">
          <div className="h-7 w-3/4 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-100 rounded-full animate-pulse" />
          <div className="mt-6 space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-4 bg-gray-100 rounded-full animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-5xl">😕</p>
        <p className="text-base font-semibold text-center" style={{ color: '#1D3550' }}>Événement introuvable</p>
        <button onClick={() => router.back()} className="text-sm font-semibold" style={{ color: '#E8622A' }}>
          ← Retour
        </button>
      </div>
    )
  }

  const paragraphs = (event.description ?? '').split('\n').filter(Boolean)

  return (
    <div className="min-h-screen bg-white">
      {/* Affiche portrait pleine largeur (ratio 4:5) */}
      <div className="relative w-full" style={{ aspectRatio: '4/5', maxHeight: '85vh' }}>
        {event.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.cover_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          /* Placeholder visuel */
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} className="w-28 h-28">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
            </svg>
            <p className="text-white/30 text-sm font-medium">Aucune affiche</p>
          </div>
        )}

        {/* Bouton retour flottant */}
        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-9 h-9 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Contenu */}
      <div className="px-5 pt-5 pb-10 space-y-5">

        {/* Titre */}
        <h1 className="text-2xl font-extrabold leading-tight" style={{ color: '#1D3550' }}>
          {event.title}
        </h1>

        {/* Infos clés */}
        <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50 bg-gray-50">
          {/* Date */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E8622A' + '15' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">Date</p>
              <p className="text-sm font-semibold capitalize" style={{ color: '#1D3550' }}>{formatDate(event.starts_at)}</p>
            </div>
          </div>

          {/* Heure */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E8622A' + '15' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">Heure</p>
              <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>
                {formatTime(event.starts_at)}
                {event.ends_at && ` → ${formatTime(event.ends_at)}`}
              </p>
            </div>
          </div>

          {/* Lieu */}
          {event.location && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E8622A' + '15' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400">Lieu</p>
                <p className="text-sm font-semibold" style={{ color: '#1D3550' }}>{event.location}</p>
              </div>
            </div>
          )}

          {/* Prix */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E8622A' + '15' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 7.629A3 3 0 009.17 7.5M15 12h-6m0 0H7.5M9 12V9.75M9 12v2.25m-.75 2.438A3.001 3.001 0 019 16.5c0 .265.02.525.058.78M15 12h1.5m-1.5 0V9.75M15 12v2.25m.75 2.438A3 3 0 0115 16.5a3 3 0 01-.75-.062M12 21a9 9 0 110-18 9 9 0 010 18z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">Tarif</p>
              <p className="text-sm font-semibold" style={{ color: event.price_cents === 0 ? '#16A34A' : '#1D3550' }}>
                {formatPrice(event.price_cents)}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {paragraphs.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Description</h2>
            <div className="space-y-3">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* Sondage */}
        <PollSection eventId={event.id} />

        {/* Actions : calendrier + partager */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => addToCalendar(event)}
            className="h-12 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]"
            style={{ backgroundColor: '#1D3550' + '10', color: '#1D3550' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008z" />
            </svg>
            Calendrier
          </button>

          <button
            onClick={() => shareEvent(event, setCopied)}
            className="h-12 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] text-white"
            style={{ backgroundColor: '#E8622A' }}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Lien copié !
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Partager
              </>
            )}
          </button>
        </div>

        {/* Bouton retour */}
        <button
          onClick={() => router.back()}
          className="w-full h-12 rounded-2xl font-semibold text-sm border-2 transition active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ borderColor: '#1D3550' + '30', color: '#1D3550' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Retour aux événements
        </button>
      </div>
    </div>
  )
}
