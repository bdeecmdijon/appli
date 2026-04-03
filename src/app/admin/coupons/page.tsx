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

interface Student {
  id:           string
  full_name:    string | null
  student_code: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function couponStatus(c: Coupon): 'scheduled' | 'active' | 'expired' {
  const now = new Date()
  if (new Date(c.expires_at) < now)     return 'expired'
  if (new Date(c.available_from) > now) return 'scheduled'
  return 'active'
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function nextSixAM(from: Date): Date {
  const d = new Date(from)
  d.setHours(6, 0, 0, 0)
  if (d <= from) d.setDate(d.getDate() + 1)
  return d
}

function computeExpiresAt(availFrom: Date, option: string): Date {
  switch (option) {
    case '24h': return new Date(availFrom.getTime() + 24 * 3600_000)
    case '48h': return new Date(availFrom.getTime() + 48 * 3600_000)
    case '1w':  return new Date(availFrom.getTime() + 7  * 86400_000)
    case '6am': return nextSixAM(availFrom)
    default:    return new Date(availFrom.getTime() + 24 * 3600_000)
  }
}

// ── Modal création ─────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: () => void
}) {
  const [emoji,         setEmoji]         = useState('🎟️')
  const [title,         setTitle]         = useState('')
  const [description,   setDescription]   = useState('')
  const [target,        setTarget]        = useState<'all' | 'specific'>('all')
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [students,      setStudents]      = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [immediate,     setImmediate_]    = useState(true)
  const [availDate,     setAvailDate]     = useState('')
  const [availTime,     setAvailTime]     = useState('20:00')
  const [expireOpt,     setExpireOpt]     = useState('24h')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Charge la liste des étudiants quand on passe en mode "specific"
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
    return (
      (s.full_name ?? '').toLowerCase().includes(q) ||
      (s.student_code ?? '').toLowerCase().includes(q)
    )
  })

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!title.trim())             { setError('Le titre est obligatoire.'); return }
    if (target === 'specific' && selectedIds.size === 0) { setError('Sélectionne au moins un étudiant.'); return }

    setSaving(true)
    setError(null)

    const availFrom = immediate
      ? new Date()
      : (() => {
          if (!availDate) { setError('Choisis une date de disponibilité.'); setSaving(false); return null }
          const [y, m, d] = availDate.split('-').map(Number)
          const [h, min]  = availTime.split(':').map(Number)
          return new Date(y, m - 1, d, h, min)
        })()

    if (!availFrom) return

    const expiresAt = computeExpiresAt(availFrom, expireOpt)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: newCoupon, error: couponErr } = await supabase
      .from('coupons')
      .insert({
        emoji:          emoji.trim() || '🎟️',
        title:          title.trim(),
        description:    description.trim() || null,
        available_from: availFrom.toISOString(),
        expires_at:     expiresAt.toISOString(),
        target,
        created_by:     user?.id ?? null,
      })
      .select('id')
      .single()

    if (couponErr || !newCoupon) {
      setError(couponErr?.message ?? 'Erreur lors de la création.')
      setSaving(false)
      return
    }

    // Crée les assignments
    let recipientIds: string[] = []
    if (target === 'all') {
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .neq('role', 'admin')
      recipientIds = (allUsers ?? []).map((u: { id: string }) => u.id)
    } else {
      recipientIds = Array.from(selectedIds)
    }

    if (recipientIds.length > 0) {
      const assignments = recipientIds.map(uid => ({
        coupon_id: newCoupon.id,
        user_id:   uid,
      }))
      const { error: asgErr } = await supabase
        .from('coupon_assignments')
        .insert(assignments)
      if (asgErr) {
        setError(`Coupon créé mais erreur d'assignation : ${asgErr.message}`)
        setSaving(false)
        return
      }
    }

    onCreated()
  }

  const EXPIRE_OPTS = [
    { value: '24h', label: '24 heures' },
    { value: '48h', label: '48 heures' },
    { value: '1w',  label: '1 semaine' },
    { value: '6am', label: 'Fin de soirée (6h du matin)' },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-8 bottom-8 z-50 bg-white rounded-3xl shadow-2xl overflow-y-auto max-w-sm mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-extrabold mb-5" style={{ color: '#1D3550' }}>
            Créer un coupon
          </h3>

          <div className="space-y-4">
            {/* Emoji */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Emoji</label>
                <input
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-2xl outline-none focus:border-[#E8622A]"
                  maxLength={4}
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
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Description (optionnel)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Valable sur tous les shots…"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                style={{ color: '#1D3550' }}
              />
            </div>

            {/* Destinataires */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Destinataires</label>
              <div className="space-y-2">
                {(['all', 'specific'] as const).map(v => (
                  <label key={v} className="flex items-center gap-3 cursor-pointer">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: target === v ? '#E8622A' : '#D1D5DB' }}
                      onClick={() => setTarget(v)}
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

              {/* Multi-select étudiants */}
              {target === 'specific' && (
                <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Rechercher par nom ou code…"
                      className="w-full text-sm px-2 py-1.5 outline-none"
                      style={{ color: '#1D3550' }}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
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

            {/* Disponible à partir de */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Disponible à partir de</label>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={immediate}
                  onChange={e => setImmediate_(e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm" style={{ color: '#1D3550' }}>Immédiatement</span>
              </label>
              {!immediate && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={availDate}
                    onChange={e => setAvailDate(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                    style={{ color: '#1D3550' }}
                  />
                  <input
                    type="time"
                    value={availTime}
                    onChange={e => setAvailTime(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A]"
                    style={{ color: '#1D3550' }}
                  />
                </div>
              )}
            </div>

            {/* Expire après */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Expire après</label>
              <select
                value={expireOpt}
                onChange={e => setExpireOpt(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] bg-white"
                style={{ color: '#1D3550' }}
              >
                {EXPIRE_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 h-12 rounded-2xl font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: '#E8622A' }}
              >
                {saving ? 'Création…' : 'Créer le coupon'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  active:    { label: 'Actif',      bg: '#DCFCE7', color: '#16A34A' },
  scheduled: { label: 'Programmé',  bg: '#FFF7ED', color: '#EA580C' },
  expired:   { label: 'Expiré',     bg: '#F3F4F6', color: '#9CA3AF' },
}

export default function CouponsAdminPage() {
  const [coupons,     setCoupons]     = useState<Coupon[]>([])
  const [loading,     setLoading]     = useState(true)
  const [createOpen,  setCreateOpen]  = useState(false)

  async function fetchCoupons() {
    const { data } = await supabase
      .from('coupons')
      .select('*, coupon_assignments(id, status)')
      .order('created_at', { ascending: false })
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
            onClick={() => setCreateOpen(true)}
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
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.color }}>
                          {style.label}
                        </span>
                      </div>
                      {coupon.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{coupon.description}</p>
                      )}
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-600">Dispo : </span>
                          {fmtDateTime(coupon.available_from)}
                        </p>
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-600">Expire : </span>
                          {fmtDateTime(coupon.expires_at)}
                        </p>
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-600">Destinataires : </span>
                          {coupon.target === 'all' ? 'Tous' : `${total} personne${total > 1 ? 's' : ''}`}
                          {' · '}
                          <span style={{ color: '#16A34A' }}>{used} utilisé{used > 1 ? 's' : ''}</span>
                          {' / '}
                          {total} total
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => deleteCoupon(coupon)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-red-100 transition active:scale-[0.97]"
                      style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Supprimer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchCoupons() }}
        />
      )}
    </div>
  )
}
