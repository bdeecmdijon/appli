'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Coupon {
  id:             string
  emoji:          string
  title:          string
  description:    string | null
  available_from: string
  expires_at:     string
  target:         'all' | 'specific'
  created_at:     string
  coupon_assignments: { id: string; status: string }[]
}

interface AssignmentRow {
  id:       string
  status:   string
  used_at:  string | null
  profiles: { full_name: string | null; student_code: string | null } | null
}

interface Student {
  id:           string
  full_name:    string | null
  student_code: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function couponStatus(c: Coupon): 'scheduled' | 'active' | 'expired' {
  const now = new Date()
  if (new Date(c.expires_at)     < now) return 'expired'
  if (new Date(c.available_from) > now) return 'scheduled'
  return 'active'
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isoToDate(iso: string) { return iso.split('T')[0] }
function isoToTime(iso: string) { return iso.substring(11, 16) }

function buildISO(date: string, time: string): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const [h, min]  = (time || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min).toISOString()
}

const STATUS_STYLE = {
  active:    { label: 'Actif',   bg: '#DCFCE7', color: '#16A34A' },
  scheduled: { label: 'À venir', bg: '#FFF7ED', color: '#EA580C' },
  expired:   { label: 'Expiré',  bg: '#F3F4F6', color: '#9CA3AF' },
}

// ── Modal coupon (création + édition) ──────────────────────────────────────

function CouponModal({
  coupon,
  onClose,
  onSaved,
}: {
  coupon:   Coupon | null   // null = nouveau
  onClose:  () => void
  onSaved:  () => void
}) {
  const isEdit = !!coupon

  // Champs
  const [emoji,         setEmoji]       = useState(coupon?.emoji       ?? '🎟️')
  const [title,         setTitle]       = useState(coupon?.title       ?? '')
  const [description,   setDesc]        = useState(coupon?.description ?? '')
  const [target,        setTarget]      = useState<'all' | 'specific'>(coupon?.target ?? 'all')
  const [selectedIds,   setSelectedIds] = useState<Set<string>>(new Set())
  const [students,      setStudents]    = useState<Student[]>([])
  const [studentSearch, setSearch]      = useState('')

  // Dates
  const [immediateStart, setImmStart] = useState(!isEdit)
  const [startDate,      setStartDate] = useState(isEdit ? isoToDate(coupon.available_from) : '')
  const [startTime,      setStartTime] = useState(isEdit ? isoToTime(coupon.available_from) : '20:00')
  const [endDate,        setEndDate]   = useState(isEdit ? isoToDate(coupon.expires_at) : '')
  const [endTime,        setEndTime]   = useState(isEdit ? isoToTime(coupon.expires_at) : '02:00')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Charge les étudiants si mode "specific"
  useEffect(() => {
    if (target !== 'specific' || students.length > 0) return
    supabase
      .from('profiles')
      .select('id, full_name, student_code')
      .neq('role', 'admin')
      .order('full_name')
      .then(({ data }) => setStudents(data ?? []))
  }, [target, students.length])

  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase()
    return (s.full_name ?? '').toLowerCase().includes(q) ||
           (s.student_code ?? '').toLowerCase().includes(q)
  })

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!title.trim()) { setError('Le titre est obligatoire.'); return }
    if (!isEdit && target === 'specific' && selectedIds.size === 0) {
      setError('Sélectionne au moins un étudiant.'); return
    }

    const availFrom = immediateStart && !isEdit
      ? new Date().toISOString()
      : buildISO(startDate, startTime)

    const expiresAt = buildISO(endDate, endTime)

    if (!availFrom) { setError('Précise la date de début.'); return }
    if (!expiresAt) { setError('Précise la date de fin.'); return }
    if (new Date(expiresAt) <= new Date(availFrom)) {
      setError('La date de fin doit être après la date de début.'); return
    }

    setSaving(true)
    setError(null)

    if (isEdit) {
      const { error: upErr } = await supabase
        .from('coupons')
        .update({
          emoji:          emoji.trim() || '🎟️',
          title:          title.trim(),
          description:    description.trim() || null,
          available_from: availFrom,
          expires_at:     expiresAt,
        })
        .eq('id', coupon.id)

      if (upErr) { setError(upErr.message); setSaving(false); return }
      onSaved()
      return
    }

    // Création via API route
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/admin/coupons', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emoji:          emoji.trim() || '🎟️',
        title:          title.trim(),
        description:    description.trim() || null,
        available_from: availFrom,
        expires_at:     expiresAt,
        target,
        recipient_ids:  target === 'specific' ? Array.from(selectedIds) : undefined,
        _userId: user?.id,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error ?? 'Erreur'); setSaving(false); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-6 bottom-6 z-50 bg-white rounded-3xl shadow-2xl overflow-y-auto max-w-sm mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-extrabold mb-5" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier le coupon' : 'Créer un coupon'}
          </h3>

          <div className="space-y-4">
            {/* Emoji + Titre */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Emoji</label>
                <input
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  maxLength={4}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-2xl outline-none focus:border-[#E8622A]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Titre *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Shot offert"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                  style={{ color: '#1D3550' }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
              <input
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="Valable sur tous les shots…"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                style={{ color: '#1D3550' }}
              />
            </div>

            {/* Date de début */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Date de début</label>
              {!isEdit && (
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={immediateStart}
                    onChange={e => setImmStart(e.target.checked)}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm" style={{ color: '#1D3550' }}>Immédiatement</span>
                </label>
              )}
              {(isEdit || !immediateStart) && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                    style={{ color: '#1D3550' }}
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                    style={{ color: '#1D3550' }}
                  />
                </div>
              )}
            </div>

            {/* Date de fin */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Date de fin *</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                  style={{ color: '#1D3550' }}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                  style={{ color: '#1D3550' }}
                />
              </div>
            </div>

            {/* Destinataires (création uniquement) */}
            {!isEdit && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Destinataires</label>
                <div className="space-y-2">
                  {(['all', 'specific'] as const).map(v => (
                    <label key={v} className="flex items-center gap-3 cursor-pointer" onClick={() => setTarget(v)}>
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: target === v ? '#E8622A' : '#D1D5DB' }}
                      >
                        {target === v && (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E8622A' }} />
                        )}
                      </div>
                      <span className="text-sm" style={{ color: '#1D3550' }}>
                        {v === 'all' ? 'Tous les utilisateurs' : 'Sélectionner des personnes'}
                      </span>
                    </label>
                  ))}
                </div>

                {target === 'specific' && (
                  <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        value={studentSearch}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher par nom ou code…"
                        className="w-full text-sm px-2 py-1.5 outline-none"
                        style={{ color: '#1D3550' }}
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-gray-400 p-3 text-center">Aucun étudiant trouvé</p>
                      ) : filteredStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleStudent(s.id)}
                            className="w-4 h-4 rounded accent-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>
                              {s.full_name ?? 'Sans nom'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">{s.student_code ?? '—'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="px-3 py-2 bg-orange-50 border-t border-orange-100">
                        <p className="text-xs font-bold" style={{ color: '#E8622A' }}>
                          {selectedIds.size} étudiant{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isEdit && (
              <p className="text-xs text-gray-400 italic">
                Les destinataires ne peuvent pas être modifiés après création.
              </p>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 rounded-2xl font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: '#E8622A' }}
              >
                {saving ? 'Enregistrement…' : isEdit ? 'Modifier' : 'Créer le coupon'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Modal assignations ────────────────────────────────────────────────────

function AssignmentsModal({
  coupon,
  onClose,
}: {
  coupon:  Coupon
  onClose: () => void
}) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<'all' | 'pending' | 'used'>('all')

  useEffect(() => {
    supabase
      .from('coupon_assignments')
      .select('id, status, used_at, profiles(full_name, student_code)')
      .eq('coupon_id', coupon.id)
      .order('status')
      .then(({ data }) => {
        setAssignments((data ?? []) as AssignmentRow[])
        setLoading(false)
      })
  }, [coupon.id])

  const filtered = filter === 'all'
    ? assignments
    : assignments.filter(a => a.status === filter)

  const usedCount    = assignments.filter(a => a.status === 'used').length
  const pendingCount = assignments.filter(a => a.status === 'pending').length

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-8 bottom-8 z-50 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-w-sm mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-extrabold" style={{ color: '#1D3550' }}>
              {coupon.emoji} {coupon.title}
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 text-xs text-gray-500">
            <span style={{ color: '#16A34A' }}>{usedCount} utilisé{usedCount > 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{pendingCount} en attente</span>
            <span>·</span>
            <span>{assignments.length} total</span>
          </div>

          {/* Filtres */}
          <div className="flex gap-2 mt-3">
            {(['all', 'pending', 'used'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                style={{
                  backgroundColor: filter === f ? '#1D3550' : '#F3F4F6',
                  color:           filter === f ? '#fff'    : '#6B7280',
                }}
              >
                {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : 'Utilisés'}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Aucun résultat</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#E8622A' }}>
                    {(a.profiles?.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>
                      {a.profiles?.full_name ?? 'Sans nom'}
                    </p>
                    <p className="text-xs font-mono text-gray-400">{a.profiles?.student_code ?? '—'}</p>
                    {a.status === 'used' && a.used_at && (
                      <p className="text-xs text-gray-400">
                        Utilisé le {new Date(a.used_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <span
                    className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                    style={
                      a.status === 'used'
                        ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                        : a.status === 'expired'
                        ? { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
                        : { backgroundColor: '#FFF7ED', color: '#EA580C' }
                    }
                  >
                    {a.status === 'used' ? '✓ Utilisé' : a.status === 'expired' ? 'Expiré' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CouponsAdminPage() {
  const [coupons,  setCoupons]  = useState<Coupon[]>([])
  const [loading,  setLoading]  = useState(true)
  // undefined = fermé, null = nouveau, Coupon = édition
  const [editing,  setEditing]  = useState<Coupon | null | undefined>(undefined)
  const [viewing,  setViewing]  = useState<Coupon | null>(null)

  async function fetchCoupons() {
    const { data } = await supabase
      .from('coupons')
      .select('*, coupon_assignments(id, status)')
      .order('available_from', { ascending: false })
    setCoupons((data ?? []) as Coupon[])
    setLoading(false)
  }

  useEffect(() => { fetchCoupons() }, [])

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Supprimer "${coupon.title}" ? Les assignments seront aussi supprimés.`)) return
    await supabase.from('coupons').delete().eq('id', coupon.id)
    setCoupons(prev => prev.filter(c => c.id !== coupon.id))
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: '#1D3550' }}>Coupons</h1>
            <p className="text-sm text-gray-400 mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Créer un coupon
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 py-5 max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" />)}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎟️</div>
            <p className="font-bold text-lg" style={{ color: '#1D3550' }}>Aucun coupon</p>
            <p className="text-sm text-gray-400 mt-1">Crée ton premier coupon pour les étudiants.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map(coupon => {
              const st    = couponStatus(coupon)
              const style = STATUS_STYLE[st]
              const total = coupon.coupon_assignments.length
              const used  = coupon.coupon_assignments.filter(a => a.status === 'used').length

              return (
                <div key={coupon.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0 mt-0.5">{coupon.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold" style={{ color: '#1D3550' }}>{coupon.title}</p>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: style.bg, color: style.color }}
                        >
                          {style.label}
                        </span>
                      </div>
                      {coupon.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{coupon.description}</p>
                      )}
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-400">
                        <p>
                          <span className="font-medium text-gray-600">De : </span>
                          {fmtDateTime(coupon.available_from)}
                          <span className="font-medium text-gray-600"> → </span>
                          {fmtDateTime(coupon.expires_at)}
                        </p>
                        <p>
                          <span className="font-medium text-gray-600">Destinataires : </span>
                          {coupon.target === 'all' ? 'Tous' : `${total} personne${total > 1 ? 's' : ''}`}
                          {' · '}
                          <span style={{ color: '#16A34A' }}>{used} utilisé{used > 1 ? 's' : ''}</span>
                          {' / '}
                          {total}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setViewing(coupon)}
                      className="flex-1 h-9 rounded-xl text-xs font-bold border border-gray-200 transition active:scale-[0.97]"
                      style={{ color: '#1D3550' }}
                    >
                      Voir assignations
                    </button>
                    <button
                      onClick={() => setEditing(coupon)}
                      className="flex-1 h-9 rounded-xl text-xs font-bold border border-gray-200 transition active:scale-[0.97]"
                      style={{ color: '#1D3550' }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => deleteCoupon(coupon)}
                      className="w-9 h-9 rounded-xl border border-red-100 flex items-center justify-center transition active:scale-[0.97]"
                      style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {editing !== undefined && (
        <CouponModal
          coupon={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); fetchCoupons() }}
        />
      )}

      {viewing && (
        <AssignmentsModal
          coupon={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
