'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface KPIs {
  students:       number
  pointsThisMonth: number
  upcomingEvents: number
  partners:       number
}

interface ActivityEntry {
  id:         string
  amount:     number
  reason:     string | null
  created_at: string
  profiles:   { full_name: string | null } | { full_name: string | null }[] | null
}

interface UpcomingEvent {
  id:       string
  title:    string
  starts_at: string
  location: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ── Composant KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  icon, value, label, bg, accent,
}: {
  icon: React.ReactNode
  value: number | string
  label: string
  bg: string
  accent: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-extrabold" style={{ color: '#1D3550' }}>
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{label}</p>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [kpis,     setKpis]     = useState<KPIs | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [events,   setEvents]   = useState<UpcomingEvent[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const now   = new Date().toISOString()
      const month = startOfMonth()

      const [
        studentsRes,
        pointsRes,
        eventsCountRes,
        partnersRes,
        activityRes,
        upcomingRes,
      ] = await Promise.all([
        // Étudiants inscrits
        supabase.from('profiles').select('id', { count: 'exact', head: true }),

        // Points distribués ce mois (sum via RPC n'existe pas → on fetch et somme client)
        supabase
          .from('points_history')
          .select('amount')
          .gte('created_at', month)
          .gt('amount', 0),

        // Événements à venir
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('starts_at', now),

        // Partenaires actifs (table peut ne pas exister)
        supabase.from('partners').select('id', { count: 'exact', head: true }),

        // Activité récente
        supabase
          .from('points_history')
          .select('id, amount, reason, created_at, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5),

        // Prochains événements
        supabase
          .from('events')
          .select('id, title, starts_at, location')
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(3),
      ])

      const totalPoints = (pointsRes.data ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0
      )

      setKpis({
        students:        studentsRes.count     ?? 0,
        pointsThisMonth: totalPoints,
        upcomingEvents:  eventsCountRes.count  ?? 0,
        partners:        partnersRes.error ? 0 : (partnersRes.count ?? 0),
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setActivity((activityRes.data ?? []) as any as ActivityEntry[])
      setEvents(upcomingRes.data ?? [])
      setLoading(false)
    }

    fetchAll()
  }, [])

  // ── Skeleton ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <div className="px-5 pt-14 pb-6" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
          <div className="h-4 w-32 bg-white/20 rounded-full animate-pulse mb-2" />
          <div className="h-7 w-52 bg-white/30 rounded-full animate-pulse" />
        </div>
        <div className="px-4 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-gray-100" />
            ))}
          </div>
          <div className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
          <div className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <p className="text-xs text-white/50 font-medium capitalize">{todayLabel()}</p>
        <h1 className="text-2xl font-extrabold text-white mt-1">Tableau de bord</h1>
      </div>

      <div className="px-4 py-5 pb-24 space-y-5">

        {/* ── KPIs 2×2 ── */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
            value={kpis?.students ?? 0}
            label="Étudiants inscrits"
            bg="#E8622A15"
            accent="#E8622A"
          />
          <KpiCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            }
            value={kpis?.pointsThisMonth ?? 0}
            label="Points distribués ce mois"
            bg="#1D355015"
            accent="#1D3550"
          />
          <KpiCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
            value={kpis?.upcomingEvents ?? 0}
            label="Événements à venir"
            bg="#16A34A15"
            accent="#16A34A"
          />
          <KpiCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              </svg>
            }
            value={kpis?.partners ?? 0}
            label="Partenaires actifs"
            bg="#7C3AED15"
            accent="#7C3AED"
          />
        </div>

        {/* ── Activité récente ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold" style={{ color: '#1D3550' }}>Activité récente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Dernières attributions de points</p>
          </div>

          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Aucune activité enregistrée.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.map(entry => {
                const profileData = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles
                const name  = profileData?.full_name ?? 'Étudiant inconnu'
                const first = name.split(' ')[0]
                return (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: entry.amount > 0 ? '#16A34A' : '#DC2626' }}
                    >
                      {entry.amount > 0 ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">
                        <span className="font-semibold" style={{ color: '#1D3550' }}>{first}</span>
                        {' '}a reçu{' '}
                        <span
                          className="font-bold"
                          style={{ color: entry.amount > 0 ? '#16A34A' : '#DC2626' }}
                        >
                          {entry.amount > 0 ? '+' : ''}{entry.amount} pts
                        </span>
                        {entry.reason && (
                          <span className="text-gray-400"> · {entry.reason}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(entry.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Prochains événements ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#1D3550' }}>Prochains événements</h2>
              <p className="text-xs text-gray-400 mt-0.5">Les 3 prochains à venir</p>
            </div>
            <Link
              href="/admin/evenements"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition active:scale-[0.96]"
              style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}
            >
              Voir tout
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Aucun événement à venir.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {events.map((ev, idx) => (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
                    style={{ backgroundColor: idx === 0 ? '#E8622A' : '#1D3550' + (idx === 1 ? 'CC' : '80') }}
                  >
                    {new Date(ev.starts_at).getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>
                      {ev.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatEventDate(ev.starts_at)}
                      {ev.location && ` · ${ev.location}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Raccourcis admin ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 px-1">
            Accès rapide
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Étudiants',   href: '/admin/etudiants',  emoji: '👥', color: '#E8622A' },
              { label: 'Événements',  href: '/admin/evenements', emoji: '📅', color: '#1D3550' },
              { label: 'BDS',         href: '/admin/bds',        emoji: '🏆', color: '#7C3AED' },
            ].map(({ label, href, emoji, color }) => (
              <Link
                key={href}
                href={href}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 active:scale-[0.97] transition-transform"
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-sm font-bold" style={{ color }}>{label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} className="w-4 h-4 ml-auto">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
