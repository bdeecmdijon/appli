'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Equipe {
  id: string
  position: number
  nom_equipe: string
  points: number | null
  is_ecm: boolean
}

interface Classement {
  id: string
  sport: string
  competition: string
  equipes: Equipe[]
}

// ── Données mockées ────────────────────────────────────────────────────────

const RESULTS = [
  { id: '1', sport: 'Football',   icon: '⚽', opponent: 'ESC Clermont',  score: '3 - 1',   result: 'victory' as const, date: '29 mars 2026',  competition: 'Championnat régional' },
  { id: '2', sport: 'Basketball', icon: '🏀', opponent: 'ICN Nancy',      score: '68 - 72', result: 'defeat'  as const, date: '22 mars 2026',  competition: 'Tournoi inter-écoles' },
  { id: '3', sport: 'Volleyball', icon: '🏐', opponent: 'EM Strasbourg',  score: '2 - 2',   result: 'draw'    as const, date: '15 mars 2026',  competition: 'Match amical' },
]

const UPCOMING = [
  { id: '4', sport: 'Football',   icon: '⚽', opponent: 'IESEG Lille',    date: '12 avril 2026', time: '14h00', location: 'Stade Gaston-Gérard, Dijon' },
  { id: '5', sport: 'Basketball', icon: '🏀', opponent: 'Kedge Bordeaux', date: '19 avril 2026', time: '15h30', location: 'Gymnase ECM Dijon' },
]

const MOCK_CLASSEMENTS: Classement[] = [
  {
    id: '1', sport: 'Football', competition: 'Championnat Régional Bourgogne FFSU',
    equipes: [
      { id: 'e1', position: 1, nom_equipe: 'ESC Clermont',    points: 34, is_ecm: false },
      { id: 'e2', position: 2, nom_equipe: 'ECM Dijon',       points: 28, is_ecm: true  },
      { id: 'e3', position: 3, nom_equipe: 'ICN Nancy',       points: 21, is_ecm: false },
      { id: 'e4', position: 4, nom_equipe: 'EM Strasbourg',   points: 17, is_ecm: false },
      { id: 'e5', position: 5, nom_equipe: 'KEDGE Bordeaux',  points: 10, is_ecm: false },
    ],
  },
  {
    id: '2', sport: 'Basketball', competition: 'Ligue Inter-Écoles Est',
    equipes: [
      { id: 'e6', position: 1, nom_equipe: 'IESEG Lille',     points: 30, is_ecm: false },
      { id: 'e7', position: 2, nom_equipe: 'EM Lyon',         points: 26, is_ecm: false },
      { id: 'e8', position: 3, nom_equipe: 'ESSCA Angers',    points: 22, is_ecm: false },
      { id: 'e9', position: 4, nom_equipe: 'ECM Dijon',       points: 18, is_ecm: true  },
    ],
  },
]

const RESULT_CONFIG = {
  victory: { label: 'Victoire', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  defeat:  { label: 'Défaite',  bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  draw:    { label: 'Nul',      bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BdsPage() {
  const [classements, setClassements] = useState<Classement[]>([])
  const [loading, setLoading] = useState(true)
  const [bdsLogoError, setBdsLogoError] = useState(false)

  useEffect(() => {
    async function fetchClassements() {
      try {
        const { data: cls, error: clsErr } = await supabase
          .from('classements')
          .select('id, sport, competition')
          .order('created_at', { ascending: true })

        if (clsErr) throw clsErr
        if (!cls || cls.length === 0) { setClassements(MOCK_CLASSEMENTS); return }

        const { data: equipes, error: eqErr } = await supabase
          .from('classements_equipes')
          .select('id, classement_id, position, nom_equipe, points, is_ecm')
          .in('classement_id', cls.map(c => c.id))
          .order('position', { ascending: true })

        if (eqErr) throw eqErr

        const result: Classement[] = cls.map(c => ({
          ...c,
          equipes: (equipes ?? []).filter(e => e.classement_id === c.id),
        }))
        setClassements(result)
      } catch {
        setClassements(MOCK_CLASSEMENTS)
      } finally {
        setLoading(false)
      }
    }
    fetchClassements()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6 flex items-center gap-4"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
          {!bdsLogoError ? (
            <Image
              src="/logo-bds.png"
              alt="Logo BDS"
              width={56}
              height={56}
              className="object-contain"
              onError={() => setBdsLogoError(true)}
            />
          ) : (
            <span className="text-2xl">⚽</span>
          )}
        </div>
        <div>
          <p className="text-sm text-white/50 font-medium">Bureau des Sports</p>
          <h1 className="text-2xl font-extrabold text-white mt-0.5">BDS ECM Dijon</h1>
          <p className="text-xs text-white/50 mt-0.5">Saison 2025–2026 · Championnats inter-écoles</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* ── Résultats récents ── */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Résultats récents</h2>
          <div className="space-y-3">
            {RESULTS.map(match => {
              const cfg = RESULT_CONFIG[match.result]
              return (
                <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: '#1D3550' + '10' }}>
                        {match.icon}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{match.competition}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: '#1D3550' }}>ECM Dijon vs {match.opponent}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{match.date}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-lg font-extrabold" style={{ color: '#1D3550' }}>{match.score}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Prochains matchs ── */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Prochains matchs</h2>
          <div className="space-y-3">
            {UPCOMING.map(match => (
              <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: '#E8622A' + '15' }}>
                    {match.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: '#1D3550' }}>ECM Dijon vs {match.opponent}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      {match.date} · {match.time}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {match.location}
                    </div>
                  </div>
                  <div className="text-xs font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0" style={{ backgroundColor: '#E8622A' }}>À venir</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Classements ── */}
        <section>
          <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Classements 🏆</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-200 animate-pulse" />)}
            </div>
          ) : classements.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
              Aucun classement disponible.
            </div>
          ) : (
            <div className="space-y-4">
              {classements.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* En-tête classement */}
                  <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: '#1D3550' }}>
                    <p className="text-sm font-extrabold text-white">{c.sport}</p>
                    <span className="text-white/40">·</span>
                    <p className="text-xs text-white/60 truncate">{c.competition}</p>
                  </div>

                  {/* Tableau */}
                  {c.equipes.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucune équipe renseignée.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 w-8">#</th>
                          <th className="text-left px-2 py-2 text-xs font-semibold text-gray-400">Équipe</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-400">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.equipes.map(eq => (
                          <tr
                            key={eq.id}
                            className="border-b border-gray-50 last:border-0"
                            style={eq.is_ecm ? { backgroundColor: '#E8622A' + '10' } : {}}
                          >
                            <td className="px-4 py-2.5">
                              <span
                                className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                                style={
                                  eq.position === 1 ? { backgroundColor: '#FFD700', color: '#fff' }
                                  : eq.position === 2 ? { backgroundColor: '#C0C0C0', color: '#fff' }
                                  : eq.position === 3 ? { backgroundColor: '#CD7F32', color: '#fff' }
                                  : { color: '#9CA3AF' }
                                }
                              >
                                {eq.position}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: eq.is_ecm ? '#E8622A' : '#1D3550' }}
                              >
                                {eq.nom_equipe}
                              </span>
                              {eq.is_ecm && (
                                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8622A', color: '#fff' }}>
                                  Nous
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-sm font-bold" style={{ color: eq.is_ecm ? '#E8622A' : '#1D3550' }}>
                                {eq.points ?? '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Logo BDS en bas de page ── */}
        <div className="flex justify-center pt-4 pb-2">
          {!bdsLogoError ? (
            <Image
              src="/logo-bds.png"
              alt="Logo BDS ECM Dijon"
              width={90}
              height={90}
              className="object-contain opacity-60"
              onError={() => setBdsLogoError(true)}
            />
          ) : null}
        </div>

      </div>
    </div>
  )
}
