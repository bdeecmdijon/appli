'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Equipe {
  id:            string
  classement_id: string
  position:      number
  nom_equipe:    string
  points:        number | null
  wins:          number
  losses:        number
  is_ecm:        boolean
}

interface Classement {
  id:           string
  sport:        string
  competition:  string
  created_at:   string
  equipes:      Equipe[]
}

const SPORTS = [
  'Football', 'Basketball', 'Volleyball', 'Handball', 'Tennis',
  'Rugby', 'Natation', 'Athlétisme', 'Badminton', 'Autre',
]

// ── Helpers ────────────────────────────────────────────────────────────────

const EQ_DEFAULT = { position: 1, nom_equipe: '', points: '', wins: '0', losses: '0', is_ecm: false }

// ── Composant modal création/édition classement ────────────────────────────

function ClassementModal({
  classement,
  onClose,
  onSaved,
}: {
  classement: Classement | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!classement

  const [sport,       setSport]       = useState(classement?.sport       ?? '')
  const [sportCustom, setSportCustom] = useState(!SPORTS.includes(classement?.sport ?? '') ? (classement?.sport ?? '') : '')
  const [competition, setCompetition] = useState(classement?.competition ?? '')
  const [equipes,     setEquipes]     = useState<typeof EQ_DEFAULT[]>(
    classement?.equipes.map(e => ({
      position:  e.position,
      nom_equipe: e.nom_equipe,
      points:    e.points?.toString() ?? '',
      wins:      e.wins?.toString()   ?? '0',
      losses:    e.losses?.toString() ?? '0',
      is_ecm:    e.is_ecm,
    })) ?? [{ ...EQ_DEFAULT }]
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const effectiveSport = sport === 'Autre' ? sportCustom : sport

  function updateEquipe(idx: number, field: string, val: string | boolean) {
    setEquipes(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: val }
      return next
    })
  }

  function addEquipe() {
    setEquipes(prev => [...prev, { ...EQ_DEFAULT, position: prev.length + 1 }])
  }

  function removeEquipe(idx: number) {
    setEquipes(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!effectiveSport.trim() || !competition.trim()) {
      setError('Sport et compétition sont obligatoires.')
      return
    }
    setSaving(true)
    setError(null)

    const clsPayload = { sport: effectiveSport.trim(), competition: competition.trim() }
    let clsId = classement?.id ?? null

    if (isEdit) {
      await supabase.from('classements').update(clsPayload).eq('id', classement!.id)
      // Supprimer les anciennes équipes et réinsérer
      await supabase.from('classements_equipes').delete().eq('classement_id', classement!.id)
    } else {
      const { data, error: insErr } = await supabase.from('classements').insert(clsPayload).select('id').single()
      if (insErr || !data) { setError(insErr?.message ?? 'Erreur'); setSaving(false); return }
      clsId = data.id
    }

    if (equipes.length > 0 && clsId) {
      const rows = equipes.map(e => ({
        classement_id: clsId,
        position:      Number(e.position),
        nom_equipe:    e.nom_equipe.trim(),
        points:        e.points !== '' ? Number(e.points) : null,
        wins:          Number(e.wins)   || 0,
        losses:        Number(e.losses) || 0,
        is_ecm:        e.is_ecm,
      }))
      const { error: eqErr } = await supabase.from('classements_equipes').insert(rows)
      if (eqErr) console.warn('equipes insert error:', eqErr.message)
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const inputCls = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pt-2 pb-10 space-y-5">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier le classement' : 'Nouveau classement'}
          </h2>

          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Sport */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sport *</label>
            <select
              value={sport}
              onChange={e => setSport(e.target.value)}
              className={`${inputCls} appearance-none`}
              style={{ color: sport ? '#1D3550' : '#9CA3AF' }}
            >
              <option value="">Sélectionne un sport</option>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {sport === 'Autre' && (
              <input
                type="text"
                value={sportCustom}
                onChange={e => setSportCustom(e.target.value)}
                placeholder="Nom du sport"
                className={`${inputCls} mt-2`}
                style={{ color: '#1D3550' }}
              />
            )}
          </div>

          {/* Compétition */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Compétition *</label>
            <input
              type="text"
              value={competition}
              onChange={e => setCompetition(e.target.value)}
              placeholder="ex: Championnat Régional Bourgogne FFSU"
              className={inputCls}
              style={{ color: '#1D3550' }}
            />
          </div>

          {/* Équipes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Équipes ({equipes.length})
              </label>
            </div>

            <div className="space-y-3">
              {equipes.map((eq, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-3 space-y-2.5"
                  style={eq.is_ecm
                    ? { backgroundColor: '#E8622A08', border: '1px solid #E8622A30' }
                    : { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }
                  }
                >
                  {/* Ligne 1 : pos + nom + supprimer */}
                  <div className="flex gap-2 items-start">
                    <div className="w-14">
                      <label className="text-[10px] text-gray-400 block mb-1">Pos.</label>
                      <input
                        type="number" min={1} value={eq.position}
                        onChange={e => updateEquipe(idx, 'position', e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center outline-none focus:border-[#E8622A]"
                        style={{ color: '#1D3550' }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 block mb-1">Nom de l&apos;équipe</label>
                      <input
                        type="text" value={eq.nom_equipe}
                        onChange={e => updateEquipe(idx, 'nom_equipe', e.target.value)}
                        placeholder="ex: ECM Dijon"
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                        style={{ color: '#1D3550' }}
                      />
                    </div>
                    {equipes.length > 1 && (
                      <button onClick={() => removeEquipe(idx)} className="mt-5 w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Ligne 2 : Pts / V / D */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'points', label: 'Pts' },
                      { key: 'wins',   label: 'Victoires' },
                      { key: 'losses', label: 'Défaites' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-[10px] text-gray-400 block mb-1">{label}</label>
                        <input
                          type="number" min={0}
                          value={eq[key as keyof typeof eq] as string}
                          onChange={e => updateEquipe(idx, key, e.target.value)}
                          placeholder="—"
                          className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center outline-none focus:border-[#E8622A]"
                          style={{ color: '#1D3550' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Checkbox ECM */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eq.is_ecm}
                      onChange={e => updateEquipe(idx, 'is_ecm', e.target.checked)}
                      className="w-4 h-4 accent-[#E8622A]"
                    />
                    <span className="text-xs font-semibold" style={{ color: eq.is_ecm ? '#E8622A' : '#6B7280' }}>
                      C&apos;est nous (équipe ECM — surlignée côté public)
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <button
              onClick={addEquipe}
              className="w-full h-10 mt-3 rounded-2xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
              style={{ borderColor: '#E8622A40', color: '#E8622A' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Ajouter une équipe
            </button>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#E8622A' }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BdsPage() {
  const [classements, setClassements] = useState<Classement[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editItem,    setEditItem]    = useState<Classement | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchAll() {
    setLoading(true)
    const { data: cls } = await supabase
      .from('classements')
      .select('id, sport, competition, created_at')
      .order('created_at', { ascending: false })

    if (!cls) { setLoading(false); return }

    const { data: equipes } = await supabase
      .from('classements_equipes')
      .select('*')
      .in('classement_id', cls.map(c => c.id))
      .order('position', { ascending: true })

    setClassements(cls.map(c => ({
      ...c,
      competition: c.competition,
      equipes: (equipes ?? []).filter(e => e.classement_id === c.id),
    })))
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce classement et toutes ses équipes ?')) return
    await supabase.from('classements').delete().eq('id', id)
    flash('Classement supprimé')
    fetchAll()
  }

  function openCreate() {
    setEditItem(null)
    setModalOpen(true)
  }

  function openEdit(c: Classement) {
    setEditItem(c)
    setModalOpen(true)
  }

  function handleSaved() {
    flash(editItem ? 'Classement mis à jour ✓' : 'Classement créé ✓')
    fetchAll()
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white whitespace-nowrap" style={{ backgroundColor: '#1D3550' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-14 pb-6" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50 font-medium">Administration</p>
            <h1 className="text-2xl font-extrabold text-white mt-0.5">BDS — Classements</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau
          </button>
        </div>
      </div>

      <div className="px-4 py-5 pb-28 space-y-4">
        {loading ? (
          [1,2].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-gray-100" />)
        ) : classements.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            Aucun classement. Crée le premier !
          </div>
        ) : (
          classements.map(c => {
            const ecmTeam = c.equipes.find(e => e.is_ecm)
            return (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* En-tête card */}
                <div className="px-4 py-3.5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold" style={{ color: '#1D3550' }}>{c.sport}</span>
                      {ecmTeam && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}
                        >
                          ECM #{ecmTeam.position}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.competition}</p>
                    <p className="text-xs text-gray-300 mt-0.5">{c.equipes.length} équipe{c.equipes.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90"
                      style={{ backgroundColor: '#1D355015' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-90 bg-red-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Tableau des équipes */}
                {c.equipes.length > 0 && (
                  <div className="px-4 py-3 overflow-x-auto">
                    <table className="w-full text-xs min-w-[320px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <th className="text-left py-1.5 text-gray-400 font-semibold w-7">#</th>
                          <th className="text-left py-1.5 text-gray-400 font-semibold">Équipe</th>
                          <th className="text-center py-1.5 text-gray-400 font-semibold w-10">Pts</th>
                          <th className="text-center py-1.5 text-gray-400 font-semibold w-8">V</th>
                          <th className="text-center py-1.5 text-gray-400 font-semibold w-8">D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.equipes.map(eq => (
                          <tr
                            key={eq.id}
                            style={eq.is_ecm
                              ? { backgroundColor: '#E8622A08' }
                              : {}
                            }
                          >
                            <td className="py-2 font-bold" style={{ color: '#1D3550' }}>{eq.position}</td>
                            <td className="py-2 font-semibold truncate max-w-[130px]" style={{ color: eq.is_ecm ? '#E8622A' : '#1D3550' }}>
                              {eq.is_ecm && '🟠 '}{eq.nom_equipe}
                            </td>
                            <td className="py-2 text-center font-semibold" style={{ color: '#1D3550' }}>{eq.points ?? '—'}</td>
                            <td className="py-2 text-center" style={{ color: '#16A34A' }}>{eq.wins ?? 0}</td>
                            <td className="py-2 text-center" style={{ color: '#DC2626' }}>{eq.losses ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ClassementModal
          classement={editItem}
          onClose={() => { setModalOpen(false); setEditItem(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
