'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

type Resultat = 'a_venir' | 'victoire' | 'defaite' | 'nul'

interface Match {
  id:          string
  sport:       string
  competition: string | null
  adversaire:  string
  date_heure:  string
  lieu:        string | null
  score_ecm:   number | null
  score_adv:   number | null
  resultat:    Resultat
  commentaire: string | null
}

// Une ligne classements = une équipe dans une compétition
interface ClassementRow {
  id:          string
  sport:       string
  competition: string | null
  equipe:      string
  position:    number
  points:      number | null
  victoires:   number
  defaites:    number
  nuls:        number
}

interface ClassementGroup {
  key:         string
  sport:       string
  competition: string | null
  rows:        ClassementRow[]
}

// ── Constantes ─────────────────────────────────────────────────────────────

const SPORT_ICONS: Record<string, string> = {
  Football: '⚽', Basket: '🏀', Volley: '🏐',
  Handball: '🤾', Rugby: '🏉', Tennis: '🎾', Badminton: '🏸',
}

const RESULT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  victoire: { label: 'Victoire', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  defaite:  { label: 'Défaite',  bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  nul:      { label: 'Nul',      bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sportIcon(s: string) { return SPORT_ICONS[s] ?? '🏅' }

function groupClassements(rows: ClassementRow[]): ClassementGroup[] {
  const map = new Map<string, ClassementGroup>()
  for (const row of rows) {
    const key = `${row.sport}__${row.competition ?? ''}`
    if (!map.has(key)) {
      map.set(key, { key, sport: row.sport, competition: row.competition, rows: [] })
    }
    map.get(key)!.rows.push(row)
  }
  for (const group of map.values()) {
    group.rows.sort((a, b) => a.position - b.position)
  }
  return Array.from(map.values())
}

function isEcm(equipe: string) { return equipe.toLowerCase().includes('ecm') }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BdsPage() {
  const [upcoming,     setUpcoming]     = useState<Match[]>([])
  const [results,      setResults]      = useState<Match[]>([])
  const [clsRows,      setClsRows]      = useState<ClassementRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [bdsLogoError, setBdsLogoError] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [matchsRes, clsRes] = await Promise.all([
          supabase
            .from('matchs')
            .select('id, sport, competition, adversaire, date_heure, lieu, score_ecm, score_adv, resultat, commentaire')
            .order('date_heure', { ascending: true }),
          supabase
            .from('classements')
            .select('id, sport, competition, equipe, position, points, victoires, defaites, nuls')
            .order('sport')
            .order('position', { ascending: true }),
        ])

        const matchsData = matchsRes.data ?? []
        setUpcoming(matchsData.filter(m => m.resultat === 'a_venir'))
        setResults(
          matchsData
            .filter(m => m.resultat !== 'a_venir')
            .sort((a, b) => b.date_heure.localeCompare(a.date_heure))
        )

        setClsRows(clsRes.data ?? [])
      } catch {
        // Silently fail — tables may not exist yet
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
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
          <p className="text-xs text-white/50 mt-0.5">Saison 2025–2026</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-6 pb-24">

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Prochains matchs ── */}
            <section>
              <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Prochains matchs</h2>
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Aucun match prévu pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(match => (
                    <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: '#E8622A15' }}
                        >
                          {sportIcon(match.sport)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: '#1D3550' }}>
                            ECM Dijon vs {match.adversaire}
                          </p>
                          {match.competition && (
                            <p className="text-xs text-gray-400 mt-0.5">{match.competition}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 flex-shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            {formatDate(match.date_heure)} · {formatTime(match.date_heure)}
                          </div>
                          {match.lieu && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                              {match.lieu}
                            </div>
                          )}
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 text-white"
                          style={{ backgroundColor: '#E8622A' }}
                        >
                          À venir
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Derniers résultats ── */}
            <section>
              <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Derniers résultats</h2>
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Aucun résultat disponible.
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map(match => {
                    const cfg = RESULT_CONFIG[match.resultat] ?? RESULT_CONFIG.nul
                    return (
                      <div key={match.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                              style={{ backgroundColor: '#1D355010' }}
                            >
                              {sportIcon(match.sport)}
                            </div>
                            <div className="min-w-0">
                              {match.competition && (
                                <p className="text-xs text-gray-400">{match.competition}</p>
                              )}
                              <p className="text-sm font-bold mt-0.5" style={{ color: '#1D3550' }}>
                                ECM Dijon vs {match.adversaire}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDate(match.date_heure)}</p>
                              {match.commentaire && (
                                <p className="text-xs text-gray-500 mt-1 italic">{match.commentaire}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {match.score_ecm !== null && match.score_adv !== null && (
                              <span className="text-xl font-extrabold" style={{ color: '#1D3550' }}>
                                {match.score_ecm} – {match.score_adv}
                              </span>
                            )}
                            <span
                              className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
                              style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Classements ── */}
            <section>
              <h2 className="text-base font-bold mb-3" style={{ color: '#1D3550' }}>Classements 🏆</h2>

              {clsRows.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                  Aucun classement disponible.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupClassements(clsRows).map(group => (
                    <div key={group.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: '#1D3550' }}>
                        <span className="text-base">{sportIcon(group.sport)}</span>
                        <p className="text-sm font-extrabold text-white">{group.sport}</p>
                        {group.competition && (
                          <>
                            <span className="text-white/40">·</span>
                            <p className="text-xs text-white/60 truncate">{group.competition}</p>
                          </>
                        )}
                      </div>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 w-8">#</th>
                            <th className="text-left px-2 py-2 text-xs font-semibold text-gray-400">Équipe</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-400">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map(r => {
                            const ecm = isEcm(r.equipe)
                            return (
                              <tr key={r.id} className="border-b border-gray-50 last:border-0"
                                style={ecm ? { backgroundColor: '#E8622A10' } : {}}>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                                    style={
                                      r.position === 1 ? { backgroundColor: '#FFD700', color: '#fff' }
                                      : r.position === 2 ? { backgroundColor: '#C0C0C0', color: '#fff' }
                                      : r.position === 3 ? { backgroundColor: '#CD7F32', color: '#fff' }
                                      : { color: '#9CA3AF' }
                                    }>
                                    {r.position}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5">
                                  <span className="text-sm font-semibold" style={{ color: ecm ? '#E8622A' : '#1D3550' }}>
                                    {r.equipe}
                                  </span>
                                  {ecm && (
                                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8622A', color: '#fff' }}>
                                      Nous
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className="text-sm font-bold" style={{ color: ecm ? '#E8622A' : '#1D3550' }}>
                                    {r.points ?? '—'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Footer logo */}
            {!bdsLogoError && (
              <div className="flex justify-center pt-4 pb-2">
                <Image
                  src="/logo-bds.png"
                  alt="Logo BDS ECM Dijon"
                  width={90}
                  height={90}
                  className="object-contain opacity-60"
                  onError={() => setBdsLogoError(true)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
