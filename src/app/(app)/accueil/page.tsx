'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CalendarSection from '@/components/CalendarSection'
import RedemptionFlow, { type Reward } from '@/components/RedemptionFlow'

// ── Types ──────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  points_balance: number
}

interface Event {
  id: string
  title: string
  starts_at: string
  location: string | null
  cover_url: string | null
}

// ── Mocks fallback ─────────────────────────────────────────────────────────

const MOCK_PROFILE: Profile = {
  id: 'mock',
  full_name: 'Thomas Dupont',
  points_balance: 620,
}

const MOCK_EVENTS: Event[] = [
  { id: '1', title: 'Soirée de rentrée BDE', starts_at: '2026-04-12T21:00:00', location: 'Le Consortium, Dijon', cover_url: null },
  { id: '2', title: 'Tournoi de foot inter-promos', starts_at: '2026-04-18T14:00:00', location: 'Stade Gaston-Gérard, Dijon', cover_url: null },
  { id: '3', title: 'Conférence Entrepreneuriat', starts_at: '2026-04-25T18:30:00', location: 'Amphi A — ECM Dijon', cover_url: null },
]

const EVENT_COLORS = ['#E8622A', '#1D3550', '#2E6DA4']

// ── Paliers ────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Bronze', min: 0,    max: 500,  color: '#CD7F32' },
  { name: 'Argent', min: 500,  max: 1500, color: '#A0A0A0' },
  { name: 'Or',     min: 1500, max: null, color: '#FFD700' },
]

function getTierIndex(pts: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (pts >= TIERS[i].min) return i
  }
  return 0
}

function getTierProgress(pts: number, idx: number) {
  const t = TIERS[idx]
  if (!t.max) return 100
  return Math.min(Math.round(((pts - t.min) / (t.max - t.min)) * 100), 100)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function getFirstName(fullName: string | null): string | null {
  if (!fullName?.trim()) return null
  return fullName.trim().split(/\s+/)[0]
}

// ── Composant Modal Félicitations ──────────────────────────────────────────

function TierUpModal({ tierName, color, onClose }: { tierName: string; color: string; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-8" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl mb-4"
            style={{ backgroundColor: color + '20' }}
          >
            {tierName === 'Or' ? '🥇' : tierName === 'Argent' ? '🥈' : '🥉'}
          </div>
          <h2 className="text-xl font-extrabold mb-2" style={{ color: '#1D3550' }}>
            Nouveau palier !
          </h2>
          <p className="text-base font-semibold mb-1" style={{ color }}>
            Palier {tierName} atteint
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Félicitations, tu débloques de nouvelles récompenses exclusives !
          </p>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98]"
            style={{ backgroundColor: '#E8622A' }}
          >
            Super !
          </button>
        </div>
      </div>
    </>
  )
}

// ── Composant Bottom Sheet Récompenses ─────────────────────────────────────

function RewardsSheet({
  rewards,
  points,
  onClose,
  onPointsUpdated,
}: {
  rewards: Reward[]
  points: number
  onClose: () => void
  onPointsUpdated: (newBalance: number) => void
}) {
  const [activeReward, setActiveReward] = useState<Reward | null>(null)

  if (activeReward) {
    return (
      <RedemptionFlow
        reward={activeReward}
        onClose={() => { setActiveReward(null); onClose() }}
        onSuccess={(newBalance) => {
          onPointsUpdated(newBalance)
        }}
      />
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-5 pt-2 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
              Dépenser mes points
            </h2>
            <span className="text-sm font-bold" style={{ color: '#E8622A' }}>
              {points.toLocaleString('fr-FR')} pts
            </span>
          </div>

          {rewards.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">
              Aucune récompense disponible pour le moment.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
              {rewards.map(reward => {
                const canAfford = points >= reward.points_cost
                return (
                  <div
                    key={reward.id}
                    className="rounded-2xl border p-4 flex items-center gap-4"
                    style={{
                      borderColor:     canAfford ? '#E8622A40' : '#E5E7EB',
                      backgroundColor: canAfford ? '#E8622A06' : '#F9FAFB',
                    }}
                  >
                    <span className="text-3xl flex-shrink-0">{reward.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight" style={{ color: '#1D3550' }}>
                        {reward.name}
                      </p>
                      {reward.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{reward.description}</p>
                      )}
                      <p className="text-sm font-extrabold mt-1" style={{ color: canAfford ? '#E8622A' : '#9CA3AF' }}>
                        {reward.points_cost} pts
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveReward(reward)}
                      disabled={!canAfford}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-[0.96] disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: canAfford ? '#E8622A' : '#E5E7EB',
                        color:           canAfford ? '#FFFFFF'  : '#9CA3AF',
                      }}
                    >
                      {canAfford ? 'Échanger' : 'Insuffisant'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AccueilPage() {
  const [profile,              setProfile]              = useState<Profile | null>(null)
  const [events,               setEvents]               = useState<Event[]>([])
  const [rewards,              setRewards]              = useState<Reward[]>([])
  const [loading,              setLoading]              = useState(true)
  const [error,                setError]                = useState<string | null>(null)
  const [sheetOpen,            setSheetOpen]            = useState(false)
  const [tierUpName,           setTierUpName]           = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true) // true par défaut pour éviter le flash

  // Ref pour détecter le changement de palier sans déclencher au premier chargement
  const prevTierRef   = useRef<number | null>(null)
  const initialLoaded = useRef(false)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, points_balance')
          .eq('id', user.id)
          .single()
        if (profileErr) throw profileErr
        setProfile(profileData ?? MOCK_PROFILE)
      } else {
        setProfile(MOCK_PROFILE)
      }

      const [eventsRes, rewardsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, starts_at, location, cover_url')
          .gt('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(3),
        supabase
          .from('rewards')
          .select('id, emoji, name, description, points_cost')
          .eq('is_active', true)
          .order('points_cost', { ascending: true }),
      ])

      if (eventsRes.error) throw eventsRes.error
      setEvents(eventsRes.data && eventsRes.data.length > 0 ? eventsRes.data : MOCK_EVENTS)
      setRewards(rewardsRes.data ?? [])
    } catch (err) {
      console.error(err)
      setError('Données de démonstration affichées.')
      setProfile(MOCK_PROFILE)
      setEvents(MOCK_EVENTS)
    } finally {
      setLoading(false)
    }
  }, [])

  // Chargement initial
  useEffect(() => { fetchData(true) }, [fetchData])

  // Rafraîchit le solde quand l'utilisateur revient sur la page (après la roue)
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') fetchData(false)
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [fetchData])

  // ── Notifications ──────────────────────────────────────────────────────

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  async function handleEnableNotifications() {
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const OneSignal = (await import('react-onesignal')).default
        await OneSignal.User.PushSubscription.optIn()
        setNotificationsEnabled(true)
      }
    } catch (err) {
      console.error('Erreur notifications:', err)
    }
  }

  // ── Détection changement de palier ──────────────────────────────────────

  const points  = profile?.points_balance ?? 0
  const tierIdx = getTierIndex(points)

  useEffect(() => {
    if (!initialLoaded.current) {
      // Premier chargement : on mémorise sans déclencher l'animation
      if (!loading) {
        prevTierRef.current = tierIdx
        initialLoaded.current = true
      }
      return
    }
    if (prevTierRef.current !== null && tierIdx > prevTierRef.current) {
      // Palier supérieur atteint
      setTierUpName(TIERS[tierIdx].name)
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#E8622A', '#FFD700', '#1D3550', '#CD7F32'] })
      })
    }
    prevTierRef.current = tierIdx
  }, [tierIdx, loading])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-7 w-40 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="w-12 h-12 rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="px-5 space-y-4">
          <div className="h-44 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-5 w-44 rounded-full bg-gray-100 animate-pulse" />
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const currentTier = TIERS[tierIdx]
  const nextTier    = TIERS[tierIdx + 1] ?? null
  const progress    = getTierProgress(points, tierIdx)
  const barWidth    = (tierIdx / (TIERS.length - 1)) * 100 + (progress / 100) * (100 / (TIERS.length - 1))
  const firstName   = getFirstName(profile?.full_name ?? null)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <p className="text-sm text-gray-400 font-medium">BDE ECM Dijon</p>
          <h1 className="text-2xl font-bold mt-0.5" style={{ color: '#1D3550' }}>
            Bonjour{firstName ? ` ${firstName}` : ''} 👋
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
          <Image src="/logobde.PNG" alt="Logo BDE" width={48} height={48} className="object-contain" />
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-3 px-4 py-2 rounded-xl bg-orange-50 border border-orange-100">
          <p className="text-xs text-orange-600">{error}</p>
        </div>
      )}

      <div className="px-5 space-y-5 pb-6">

        {/* ── Bannière notifications ── */}
        {!notificationsEnabled && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
            style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: '#92400E' }}>🔔 Active les notifications</p>
              <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>Ne rate aucun événement du BDE !</p>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm text-white transition active:scale-[0.96]"
              style={{ backgroundColor: '#E8622A' }}
            >
              Activer
            </button>
          </div>
        )}

        {/* ── Carte points ── */}
        <div
          className="rounded-2xl p-5 text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, #1D3550 0%, #2E5A8A 100%)' }}
        >
          <p className="text-sm text-white/60 font-medium mb-1">Mes points</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#E8622A' }}>
              {points.toLocaleString('fr-FR')}
            </span>
            <span className="text-xl font-semibold text-white/80 mb-1">points</span>
          </div>

          <button
            onClick={() => setSheetOpen(true)}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97] mb-4"
            style={{ backgroundColor: '#E8622A', color: '#fff' }}
          >
            Dépenser mes points →
          </button>

          {/* Barre Bronze / Argent / Or */}
          <div>
            <div className="flex justify-between mb-1.5">
              {TIERS.map((tier, i) => (
                <span
                  key={tier.name}
                  className="text-xs font-semibold"
                  style={{ color: i <= tierIdx ? tier.color : 'rgba(255,255,255,0.35)' }}
                >
                  {tier.name}
                </span>
              ))}
            </div>
            <div className="relative h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="absolute inset-0 flex">
                {TIERS.slice(0, -1).map((_, i) => (
                  <div key={i} className="h-full border-r border-white/30" style={{ width: `${100 / (TIERS.length - 1)}%` }} />
                ))}
              </div>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{ width: `${barWidth}%`, backgroundColor: currentTier.color }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-white/50">
                Palier : <span className="font-semibold" style={{ color: currentTier.color }}>{currentTier.name}</span>
              </span>
              {nextTier && (
                <span className="text-xs text-white/50">
                  <span className="font-semibold text-white/80">{nextTier.min - points} pts</span> avant {nextTier.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Événements à venir ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: '#1D3550' }}>Événements à venir</h2>
            <button className="text-sm font-medium" style={{ color: '#E8622A' }}>Voir tout</button>
          </div>

          {events.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">Aucun événement prévu.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
              {events.map((event, idx) => {
                const { date, time } = formatDate(event.starts_at)
                const color = EVENT_COLORS[idx % EVENT_COLORS.length]
                return (
                  <Link
                    key={event.id}
                    href={`/accueil/${event.id}`}
                    className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.98] transition-transform flex flex-col"
                  >
                    <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
                      {event.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.cover_url}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                          style={{ background: `linear-gradient(160deg, ${color} 0%, ${color}cc 100%)` }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} className="w-14 h-14">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white flex-1 flex flex-col justify-between">
                      <h3 className="font-bold text-sm leading-snug" style={{ color: '#1D3550' }}>{event.title}</h3>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 flex-shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                          <span>{date} · {time}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 text-gray-400 text-xs">
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
              })}
            </div>
          )}
        </div>

        {/* ── Bannière Instagram ── */}
        <a
          href="https://instagram.com/bde_ecm_dijon"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #F77737 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">@bde_ecm_dijon</p>
            <p className="text-white/80 text-xs">Suis-nous sur Instagram</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4 opacity-70 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>

        {/* Calendrier */}
        <CalendarSection />

      </div>

      {/* Bottom Sheet récompenses */}
      {sheetOpen && (
        <RewardsSheet
          rewards={rewards}
          points={points}
          onClose={() => setSheetOpen(false)}
          onPointsUpdated={(newBalance) => setProfile(prev => prev ? { ...prev, points_balance: newBalance } : prev)}
        />
      )}

      {/* Modal nouveau palier */}
      {tierUpName && (
        <TierUpModal
          tierName={tierUpName}
          color={TIERS.find(t => t.name === tierUpName)?.color ?? '#E8622A'}
          onClose={() => setTierUpName(null)}
        />
      )}
    </div>
  )
}
