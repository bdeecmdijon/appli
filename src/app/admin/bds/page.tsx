'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

type Resultat = 'a_venir' | 'victoire' | 'defaite' | 'nul'
type Tab      = 'matchs' | 'classements'

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

// Regroupement pour l'affichage
interface ClassementGroup {
  key:         string
  sport:       string
  competition: string | null
  rows:        ClassementRow[]
}

// ── Constantes ─────────────────────────────────────────────────────────────

const SPORTS = ['Football', 'Basket', 'Volley', 'Handball', 'Rugby', 'Tennis', 'Badminton', 'Autre']

const SPORT_ICONS: Record<string, string> = {
  Football: '⚽', Basket: '🏀', Volley: '🏐',
  Handball: '🤾', Rugby: '🏉', Tennis: '🎾', Badminton: '🏸',
}

const RESULT_CONFIG: Record<Resultat, { label: string; bg: string; text: string; border: string }> = {
  a_venir:  { label: 'À venir',  bg: '#FFF4EE', text: '#E8622A', border: '#FEDDCC' },
  victoire: { label: 'Victoire', bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  defaite:  { label: 'Défaite',  bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  nul:      { label: 'Nul',      bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sportIcon(s: string) { return SPORT_ICONS[s] ?? '🏅' }

function formatMatchDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMatchTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function toDateInput(iso: string) { return iso.split('T')[0] }
function toTimeInput(iso: string) { return iso.split('T')[1]?.slice(0, 5) ?? '' }

function autoResultat(ecm: string, adv: string): Resultat | null {
  if (ecm === '' || adv === '') return null
  const e = parseInt(ecm), a = parseInt(adv)
  if (isNaN(e) || isNaN(a)) return null
  return e > a ? 'victoire' : e < a ? 'defaite' : 'nul'
}

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

function isEcm(equipe: string) {
  return equipe.toLowerCase().includes('ecm')
}

// ── Modal Match ─────────────────────────────────────────────────────────────

function MatchModal({
  match,
  onClose,
  onSaved,
}: {
  match:   Match | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!match

  const [sport,       setSport]       = useState(match?.sport       ?? 'Football')
  const [competition, setCompetition] = useState(match?.competition ?? '')
  const [adversaire,  setAdversaire]  = useState(match?.adversaire  ?? '')
  const [date,        setDate]        = useState(match?.date_heure ? toDateInput(match.date_heure) : '')
  const [time,        setTime]        = useState(match?.date_heure ? toTimeInput(match.date_heure) : '14:00')
  const [lieu,        setLieu]        = useState(match?.lieu        ?? '')
  const [scoreEcm,    setScoreEcm]    = useState(match?.score_ecm?.toString() ?? '')
  const [scoreAdv,    setScoreAdv]    = useState(match?.score_adv?.toString() ?? '')
  const [resultat,    setResultat]    = useState<Resultat>(match?.resultat ?? 'a_venir')
  const [commentaire, setCommentaire] = useState(match?.commentaire ?? '')
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function handleScoreChange(field: 'ecm' | 'adv', val: string) {
    const ecm = field === 'ecm' ? val : scoreEcm
    const adv = field === 'adv' ? val : scoreAdv
    if (field === 'ecm') setScoreEcm(val)
    else setScoreAdv(val)
    const auto = autoResultat(ecm, adv)
    if (auto) setResultat(auto)
  }

  async function handleSave() {
    if (!adversaire.trim() || !date || !time) {
      setError('Adversaire, date et heure sont obligatoires.')
      return
    }
    setSaving(true); setError(null)

    const payload = {
      sport,
      competition: competition.trim() || null,
      adversaire:  adversaire.trim(),
      date_heure:  `${date}T${time}:00`,
      lieu:        lieu.trim() || null,
      score_ecm:   scoreEcm !== '' ? parseInt(scoreEcm) : null,
      score_adv:   scoreAdv !== '' ? parseInt(scoreAdv) : null,
      resultat,
      commentaire: commentaire.trim() || null,
    }

    const { error: e } = isEdit
      ? await supabase.from('matchs').update(payload).eq('id', match!.id)
      : await supabase.from('matchs').insert(payload)

    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le match contre ${match!.adversaire} ?`)) return
    setDeleting(true)
    await supabase.from('matchs').delete().eq('id', match!.id)
    onSaved(); onClose()
  }

  const inp = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[95vh] overflow-y-auto lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-lg lg:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier le match' : 'Nouveau match'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-10 space-y-4">
          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className={lbl}>Sport</label>
            <select value={sport} onChange={e => setSport(e.target.value)}
              className={inp} style={{ color: '#1D3550' }}>
              {SPORTS.map(s => <option key={s} value={s}>{sportIcon(s)} {s}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Compétition (optionnel)</label>
            <input type="text" value={competition} onChange={e => setCompetition(e.target.value)}
              placeholder="ex: Championnat inter-écoles" className={inp} style={{ color: '#1D3550' }} />
          </div>

          <div>
            <label className={lbl}>Adversaire *</label>
            <input type="text" value={adversaire} onChange={e => setAdversaire(e.target.value)}
              placeholder="ex: IESEG Lille" className={inp} style={{ color: '#1D3550' }} />
          </div>

          <div>
            <label className={lbl}>Date & heure *</label>
            <div className="flex gap-2">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className={`${inp} flex-1`} style={{ color: '#1D3550' }} />
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className={`${inp} w-28`} style={{ color: '#1D3550' }} />
            </div>
          </div>

          <div>
            <label className={lbl}>Lieu (optionnel)</label>
            <input type="text" value={lieu} onChange={e => setLieu(e.target.value)}
              placeholder="ex: Gymnase ECM Dijon" className={inp} style={{ color: '#1D3550' }} />
          </div>

          <div>
            <label className={lbl}>Score</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 mb-1 text-center">ECM Dijon</p>
                <input type="number" min="0" value={scoreEcm}
                  onChange={e => handleScoreChange('ecm', e.target.value)}
                  placeholder="—"
                  className="w-full h-12 text-center text-xl font-bold rounded-xl border border-gray-200 outline-none focus:border-[#E8622A] bg-white"
                  style={{ color: '#1D3550' }} />
              </div>
              <span className="text-lg font-bold text-gray-300 flex-shrink-0">–</span>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 mb-1 text-center">Adversaire</p>
                <input type="number" min="0" value={scoreAdv}
                  onChange={e => handleScoreChange('adv', e.target.value)}
                  placeholder="—"
                  className="w-full h-12 text-center text-xl font-bold rounded-xl border border-gray-200 outline-none focus:border-[#E8622A] bg-white"
                  style={{ color: '#1D3550' }} />
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Résultat</label>
            <div className="flex gap-2">
              {(['a_venir', 'victoire', 'defaite', 'nul'] as Resultat[]).map(r => {
                const cfg = RESULT_CONFIG[r]
                return (
                  <button key={r} type="button" onClick={() => setResultat(r)}
                    className="flex-1 h-9 rounded-xl text-xs font-bold border transition"
                    style={{
                      backgroundColor: resultat === r ? cfg.bg : '#F9FAFB',
                      color:           resultat === r ? cfg.text : '#9CA3AF',
                      borderColor:     resultat === r ? cfg.border : '#E5E7EB',
                    }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={lbl}>Commentaire (optionnel)</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
              rows={2} placeholder="Résumé du match, faits marquants…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white resize-none"
              style={{ color: '#1D3550' }} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#E8622A' }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Ajouter le match'}
          </button>

          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="w-full h-11 rounded-2xl font-semibold text-sm border border-red-100 disabled:opacity-50"
              style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}>
              {deleting ? 'Suppression…' : 'Supprimer ce match'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Modal Classement (une ligne = une équipe) ───────────────────────────────

function ClassementRowModal({
  row,
  prefillSport,
  prefillCompetition,
  onClose,
  onSaved,
}: {
  row:                 ClassementRow | null
  prefillSport?:       string
  prefillCompetition?: string | null
  onClose:             () => void
  onSaved:             () => void
}) {
  const isEdit = !!row

  const [sport,       setSport]       = useState(row?.sport            ?? prefillSport       ?? 'Football')
  const [competition, setCompetition] = useState(row?.competition      ?? prefillCompetition ?? '')
  const [equipe,      setEquipe]      = useState(row?.equipe           ?? '')
  const [position,    setPosition]    = useState(row?.position?.toString()  ?? '1')
  const [points,      setPoints]      = useState(row?.points?.toString()    ?? '')
  const [victoires,   setVictoires]   = useState(row?.victoires?.toString() ?? '0')
  const [defaites,    setDefaites]    = useState(row?.defaites?.toString()  ?? '0')
  const [nuls,        setNuls]        = useState(row?.nuls?.toString()      ?? '0')
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSave() {
    if (!sport || !equipe.trim()) {
      setError('Le sport et le nom de l\'équipe sont obligatoires.')
      return
    }
    setSaving(true); setError(null)

    const payload = {
      sport,
      competition: competition.trim() || null,
      equipe:      equipe.trim(),
      position:    parseInt(position) || 1,
      points:      points !== '' ? parseInt(points) : null,
      victoires:   parseInt(victoires) || 0,
      defaites:    parseInt(defaites)  || 0,
      nuls:        parseInt(nuls)      || 0,
    }

    const { error: e } = isEdit
      ? await supabase.from('classements').update(payload).eq('id', row!.id)
      : await supabase.from('classements').insert(payload)

    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${row!.equipe}" de ce classement ?`)) return
    setDeleting(true)
    await supabase.from('classements').delete().eq('id', row!.id)
    onSaved(); onClose()
  }

  const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[95vh] overflow-y-auto lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-lg lg:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier l\'entrée' : 'Ajouter une équipe'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-10 space-y-4">
          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Sport */}
          <div>
            <label className={lbl}>Sport *</label>
            <select value={sport} onChange={e => setSport(e.target.value)}
              className={inp} style={{ color: '#1D3550' }}>
              {SPORTS.map(s => <option key={s} value={s}>{sportIcon(s)} {s}</option>)}
            </select>
          </div>

          {/* Compétition */}
          <div>
            <label className={lbl}>Compétition</label>
            <input type="text" value={competition ?? ''} onChange={e => setCompetition(e.target.value)}
              placeholder="ex: Championnat inter-écoles" className={inp} style={{ color: '#1D3550' }} />
          </div>

          {/* Équipe — champ obligatoire (NOT NULL) */}
          <div>
            <label className={lbl}>Équipe *</label>
            <input
              type="text"
              value={equipe}
              onChange={e => setEquipe(e.target.value)}
              placeholder="Ex: ECM Dijon"
              className={inp}
              style={{ color: '#1D3550' }}
              required
            />
          </div>

          {/* Position */}
          <div>
            <label className={lbl}>Position dans le classement</label>
            <input type="number" min="1" value={position} onChange={e => setPosition(e.target.value)}
              placeholder="1" className={inp} style={{ color: '#1D3550' }} />
          </div>

          {/* Stats Pts / V / D / N */}
          <div>
            <label className={lbl}>Statistiques</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { val: points,    set: setPoints,    label: 'Pts' },
                { val: victoires, set: setVictoires, label: 'V' },
                { val: defaites,  set: setDefaites,  label: 'D' },
                { val: nuls,      set: setNuls,      label: 'N' },
              ] as { val: string; set: (v: string) => void; label: string }[]).map(({ val, set, label }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 mb-1 text-center">{label}</p>
                  <input
                    type="number" min="0" value={val}
                    onChange={e => set(e.target.value)}
                    placeholder="—"
                    className="w-full h-11 text-center rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] bg-white"
                    style={{ color: '#1D3550' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#E8622A' }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Ajouter l\'équipe'}
          </button>

          {/* Delete */}
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="w-full h-11 rounded-2xl font-semibold text-sm border border-red-100 disabled:opacity-50"
              style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}>
              {deleting ? 'Suppression…' : 'Supprimer cette entrée'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BdsAdminPage() {
  const [tab,                setTab]                = useState<Tab>('matchs')
  const [matchs,             setMatchs]             = useState<Match[]>([])
  const [clsRows,            setClsRows]            = useState<ClassementRow[]>([])
  const [loadingMatchs,      setLoadingMatchs]      = useState(true)
  const [loadingClassements, setLoadingClassements] = useState(true)
  const [matchModal,         setMatchModal]         = useState<Match | null>(null)
  const [matchModalOpen,     setMatchModalOpen]     = useState(false)
  // clsModal: null = closed, object = open (row=null means new)
  const [clsModal, setClsModal] = useState<{
    row:                ClassementRow | null
    prefillSport?:      string
    prefillCompetition?: string | null
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchMatchs() {
    setLoadingMatchs(true)
    const { data } = await supabase
      .from('matchs')
      .select('id, sport, competition, adversaire, date_heure, lieu, score_ecm, score_adv, resultat, commentaire')
      .order('date_heure', { ascending: true })
    setMatchs(data ?? [])
    setLoadingMatchs(false)
  }

  async function fetchClassements() {
    setLoadingClassements(true)
    const { data } = await supabase
      .from('classements')
      .select('id, sport, competition, equipe, position, points, victoires, defaites, nuls')
      .order('sport')
      .order('position', { ascending: true })
    setClsRows(data ?? [])
    setLoadingClassements(false)
  }

  useEffect(() => {
    fetchMatchs()
    fetchClassements()
  }, [])

  const upcoming = matchs.filter(m => m.resultat === 'a_venir')
  const results  = matchs.filter(m => m.resultat !== 'a_venir').slice().reverse()
  const clsGroups = groupClassements(clsRows)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white whitespace-nowrap" style={{ backgroundColor: '#1D3550' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-5 pb-0" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">BDS</h1>
            <p className="text-xs text-white/50 mt-0.5">Gestion des matchs & classements</p>
          </div>
          <button
            onClick={() => {
              if (tab === 'matchs') { setMatchModal(null); setMatchModalOpen(true) }
              else setClsModal({ row: null })
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter
          </button>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(['matchs', 'classements'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-sm font-bold transition relative"
              style={{ color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {t === 'matchs' ? 'Matchs' : 'Classements'}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#E8622A]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24 space-y-4">

        {/* ── MATCHS ── */}
        {tab === 'matchs' && (
          <>
            {loadingMatchs ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />)
            ) : matchs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-3xl mb-2">🏅</p>
                <p className="text-gray-400 text-sm">Aucun match enregistré.</p>
                <button
                  onClick={() => { setMatchModal(null); setMatchModalOpen(true) }}
                  className="mt-4 text-sm font-bold" style={{ color: '#E8622A' }}>
                  Ajouter le premier match
                </button>
              </div>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">À venir</p>
                    <div className="space-y-2">
                      {upcoming.map(m => (
                        <MatchCard key={m.id} match={m} onClick={() => { setMatchModal(m); setMatchModalOpen(true) }} />
                      ))}
                    </div>
                  </div>
                )}
                {results.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">Résultats</p>
                    <div className="space-y-2">
                      {results.map(m => (
                        <MatchCard key={m.id} match={m} onClick={() => { setMatchModal(m); setMatchModalOpen(true) }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── CLASSEMENTS ── */}
        {tab === 'classements' && (
          <>
            {loadingClassements ? (
              [1, 2].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-gray-100" />)
            ) : clsGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="text-3xl mb-2">🏆</p>
                <p className="text-gray-400 text-sm">Aucun classement enregistré.</p>
                <button onClick={() => setClsModal({ row: null })}
                  className="mt-4 text-sm font-bold" style={{ color: '#E8622A' }}>
                  Ajouter la première entrée
                </button>
              </div>
            ) : (
              clsGroups.map(group => {
                const ecmRow = group.rows.find(r => isEcm(r.equipe))
                return (
                  <div key={group.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Group header */}
                    <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ backgroundColor: '#1D3550' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{sportIcon(group.sport)}</span>
                        <p className="text-sm font-extrabold text-white">{group.sport}</p>
                        {group.competition && (
                          <>
                            <span className="text-white/40">·</span>
                            <p className="text-xs text-white/60 truncate">{group.competition}</p>
                          </>
                        )}
                        {ecmRow && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#E8622A', color: '#fff' }}>
                            ECM #{ecmRow.position}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setClsModal({ row: null, prefillSport: group.sport, prefillCompetition: group.competition })}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[320px]">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <th className="text-left px-4 py-2 text-gray-400 font-semibold w-8">#</th>
                            <th className="text-left px-2 py-2 text-gray-400 font-semibold">Équipe</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-semibold w-9">Pts</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-semibold w-8">V</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-semibold w-8">D</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-semibold w-8">N</th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map(r => (
                            <tr key={r.id}
                              className="border-b border-gray-50 last:border-0"
                              style={isEcm(r.equipe) ? { backgroundColor: '#E8622A08' } : {}}>
                              <td className="px-4 py-2.5 font-bold" style={{ color: '#1D3550' }}>{r.position}</td>
                              <td className="px-2 py-2.5 font-semibold" style={{ color: isEcm(r.equipe) ? '#E8622A' : '#1D3550' }}>
                                {r.equipe}
                              </td>
                              <td className="px-2 py-2.5 text-center font-semibold" style={{ color: '#1D3550' }}>{r.points ?? '—'}</td>
                              <td className="px-2 py-2.5 text-center" style={{ color: '#16A34A' }}>{r.victoires}</td>
                              <td className="px-2 py-2.5 text-center" style={{ color: '#DC2626' }}>{r.defaites}</td>
                              <td className="px-2 py-2.5 text-center text-gray-400">{r.nuls}</td>
                              <td className="px-2 py-2.5 text-right">
                                <button
                                  onClick={() => setClsModal({ row: r })}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center ml-auto"
                                  style={{ backgroundColor: '#1D355015' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2} className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Modal match */}
      {matchModalOpen && (
        <MatchModal
          match={matchModal}
          onClose={() => setMatchModalOpen(false)}
          onSaved={() => { flash(matchModal ? 'Match mis à jour ✓' : 'Match ajouté ✓'); fetchMatchs() }}
        />
      )}

      {/* Modal classement row */}
      {clsModal !== null && (
        <ClassementRowModal
          row={clsModal.row}
          prefillSport={clsModal.prefillSport}
          prefillCompetition={clsModal.prefillCompetition}
          onClose={() => setClsModal(null)}
          onSaved={() => {
            flash(clsModal.row ? 'Entrée mise à jour ✓' : 'Équipe ajoutée ✓')
            fetchClassements()
          }}
        />
      )}
    </div>
  )
}

// ── Card Match ──────────────────────────────────────────────────────────────

function MatchCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const cfg = RESULT_CONFIG[match.resultat]

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
      onClick={onClick}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: '#1D355010' }}>
        {sportIcon(match.sport)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>ECM vs {match.adversaire}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {match.competition ? `${match.competition} · ` : ''}{formatMatchDate(match.date_heure)} {formatMatchTime(match.date_heure)}
        </p>
        {match.lieu && <p className="text-xs text-gray-400 truncate">{match.lieu}</p>}
        {match.resultat !== 'a_venir' && match.score_ecm !== null && match.score_adv !== null && (
          <p className="text-xs font-bold mt-0.5" style={{ color: '#1D3550' }}>{match.score_ecm} – {match.score_adv}</p>
        )}
      </div>
      <span className="text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0"
        style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
        {cfg.label}
      </span>
    </div>
  )
}
