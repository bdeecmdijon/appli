'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Event {
  id:          string
  title:       string
  starts_at:   string
  ends_at:     string | null
  location:    string | null
  description: string | null
  cover_url:   string | null
  type:        string
  price_cents: number
}

type Filter = 'all' | 'upcoming' | 'past'

// ── Constantes types ───────────────────────────────────────────────────────

const EVENT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  soiree_bde:    { label: 'Soirée BDE',       color: '#E8622A', bg: '#FFF4EE' },
  event_bde:     { label: 'Événement BDE',    color: '#1D3550', bg: '#EEF2F7' },
  match_bds:     { label: 'Match BDS',        color: '#16A34A', bg: '#F0FDF4' },
  event_sportif: { label: 'Événement sportif', color: '#7C3AED', bg: '#F5F3FF' },
}

const TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, { label }]) => ({ value, label }))

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toDateInput(iso: string) {
  return iso.split('T')[0]
}

function toTimeInput(iso: string) {
  return iso.split('T')[1]?.slice(0, 5) ?? ''
}

// ── Formulaire par défaut ──────────────────────────────────────────────────

const DEFAULT_FORM = {
  title:           '',
  date:            '',
  time:            '20:00',
  ends_date:       '',
  ends_time:       '',
  location:        '',
  type:            'event_bde',
  description:     '',
  price_cents:     '0',
  hasSondage:      false,
  sondageQuestion: '',
  sondageOptions:  ['', ''] as string[],
}

// ── Composant : Modal formulaire événement ─────────────────────────────────

function EventFormModal({
  event,
  onClose,
  onSaved,
}: {
  event: Event | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!event
  const [form,        setForm]        = useState(() =>
    event
      ? {
          title:           event.title,
          date:            toDateInput(event.starts_at),
          time:            toTimeInput(event.starts_at),
          ends_date:       event.ends_at ? toDateInput(event.ends_at) : '',
          ends_time:       event.ends_at ? toTimeInput(event.ends_at) : '',
          location:        event.location ?? '',
          type:            event.type ?? 'event_bde',
          description:     event.description ?? '',
          price_cents:     String((event.price_cents ?? 0) / 100),
          hasSondage:      false,
          sondageQuestion: '',
          sondageOptions:  ['', ''] as string[],
        }
      : { ...DEFAULT_FORM }
  )
  const [coverFile,    setCoverFile]    = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(event?.cover_url ?? null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleField(name: string, value: string | boolean) {
    setForm(p => ({ ...p, [name]: value }))
  }

  function handleOptionChange(idx: number, val: string) {
    setForm(p => {
      const opts = [...p.sondageOptions]
      opts[idx] = val
      return { ...p, sondageOptions: opts }
    })
  }

  function addOption() {
    setForm(p => ({ ...p, sondageOptions: [...p.sondageOptions, ''] }))
  }

  function removeOption(idx: number) {
    setForm(p => ({ ...p, sondageOptions: p.sondageOptions.filter((_, i) => i !== idx) }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    const reader = new FileReader()
    reader.onload = ev => setCoverPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadCover(file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `covers/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('event-covers')
      .upload(path, file, { upsert: true })
    if (error || !data) {
      console.warn('Cover upload error:', error?.message)
      return null
    }
    return supabase.storage.from('event-covers').getPublicUrl(data.path).data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || !form.time) {
      setError('Titre, date et heure sont obligatoires.')
      return
    }
    setSaving(true)
    setError(null)

    // Upload cover si sélectionnée
    let coverUrl = event?.cover_url ?? null
    if (coverFile) {
      const uploaded = await uploadCover(coverFile)
      if (uploaded) coverUrl = uploaded
    }

    const payload = {
      title:       form.title.trim(),
      starts_at:   `${form.date}T${form.time}:00`,
      ends_at:     form.ends_date && form.ends_time ? `${form.ends_date}T${form.ends_time}:00` : null,
      location:    form.location.trim() || null,
      type:        form.type,
      description: form.description.trim() || null,
      price_cents: Math.round(parseFloat(form.price_cents || '0') * 100),
      cover_url:   coverUrl,
    }

    let eventId: string | null = event?.id ?? null

    if (isEdit) {
      const { error: updErr } = await supabase.from('events').update(payload).eq('id', event!.id)
      if (updErr) { setError(updErr.message); setSaving(false); return }
    } else {
      const { data, error: insErr } = await supabase.from('events').insert(payload).select('id').single()
      if (insErr || !data) { setError(insErr?.message ?? 'Erreur'); setSaving(false); return }
      eventId = data.id
    }

    // Sondage
    if (!isEdit && form.hasSondage && form.sondageQuestion.trim() && eventId) {
      const validOptions = form.sondageOptions.map(o => o.trim()).filter(Boolean)
      if (validOptions.length >= 2) {
        await supabase.from('sondages').insert({
          event_id: eventId,
          question: form.sondageQuestion.trim(),
          options:  validOptions,
        })
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5'
  const inputCls = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[94vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="px-5 pt-2 pb-10 space-y-4">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier l\'événement' : 'Nouvel événement'}
          </h2>

          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className={labelCls}>Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => handleField('title', e.target.value)}
              placeholder="ex: Soirée de rentrée BDE"
              required
              className={inputCls}
              style={{ color: '#1D3550' }}
            />
          </div>

          {/* Date + heure début */}
          <div>
            <label className={labelCls}>Date & heure de début *</label>
            <div className="flex gap-2">
              <input type="date" value={form.date} onChange={e => handleField('date', e.target.value)}
                required className={`${inputCls} flex-1`} style={{ color: '#1D3550' }} />
              <input type="time" value={form.time} onChange={e => handleField('time', e.target.value)}
                required className={`${inputCls} w-28`} style={{ color: '#1D3550' }} />
            </div>
          </div>

          {/* Date + heure fin (optionnel) */}
          <div>
            <label className={labelCls}>Date & heure de fin (optionnel)</label>
            <div className="flex gap-2">
              <input type="date" value={form.ends_date} onChange={e => handleField('ends_date', e.target.value)}
                className={`${inputCls} flex-1`} style={{ color: '#1D3550' }} />
              <input type="time" value={form.ends_time} onChange={e => handleField('ends_time', e.target.value)}
                className={`${inputCls} w-28`} style={{ color: '#1D3550' }} />
            </div>
          </div>

          {/* Lieu */}
          <div>
            <label className={labelCls}>Lieu</label>
            <input type="text" value={form.location} onChange={e => handleField('location', e.target.value)}
              placeholder="ex: Le Consortium, Dijon"
              className={inputCls} style={{ color: '#1D3550' }} />
          </div>

          {/* Type */}
          <div>
            <label className={labelCls}>Type</label>
            <select
              value={form.type}
              onChange={e => handleField('type', e.target.value)}
              className={`${inputCls} appearance-none`}
              style={{ color: '#1D3550' }}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Prix */}
          <div>
            <label className={labelCls}>Prix (€, 0 pour gratuit)</label>
            <input type="number" min="0" step="0.50" value={form.price_cents}
              onChange={e => handleField('price_cents', e.target.value)}
              placeholder="0"
              className={inputCls} style={{ color: '#1D3550' }} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description / Article</label>
            <textarea
              value={form.description}
              onChange={e => handleField('description', e.target.value)}
              placeholder="Décris l'événement en détail…"
              rows={5}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition resize-none"
              style={{ color: '#1D3550' }}
            />
          </div>

          {/* Image de couverture */}
          <div>
            <label className={labelCls}>Image de couverture</label>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} className="hidden" />
            {coverPreview ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/5', maxHeight: 240 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverPreview} alt="Aperçu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null) }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition active:scale-[0.98]"
                style={{ borderColor: '#E8622A40' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={1.5} className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: '#E8622A' }}>Choisir une image</span>
              </button>
            )}
          </div>

          {/* Sondage — uniquement à la création */}
          {!isEdit && (
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasSondage}
                  onChange={e => handleField('hasSondage', e.target.checked)}
                  className="w-4 h-4 accent-[#E8622A]"
                />
                <span className="text-sm font-semibold" style={{ color: '#1D3550' }}>
                  Ajouter un sondage
                </span>
              </label>

              {form.hasSondage && (
                <div className="px-4 pb-4 space-y-3" style={{ backgroundColor: '#E8622A08', borderTop: '1px solid #E8622A20' }}>
                  <p className="text-xs font-bold pt-3" style={{ color: '#E8622A' }}>Sondage</p>

                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1.5 block">Question</label>
                    <input
                      type="text"
                      value={form.sondageQuestion}
                      onChange={e => handleField('sondageQuestion', e.target.value)}
                      placeholder="ex: Quelle musique pour la soirée ?"
                      className={inputCls}
                      style={{ color: '#1D3550' }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-medium block">Options</label>
                    {form.sondageOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          className={`${inputCls} flex-1`}
                          style={{ color: '#1D3550' }}
                        />
                        {form.sondageOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-50"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="w-full h-10 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ borderColor: '#E8622A40', color: '#E8622A' }}
                    >
                      + Ajouter une option
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#E8622A' }}
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Publier l\'événement'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EvenementsPage() {
  const [events,      setEvents]      = useState<Event[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<Filter>('upcoming')
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editEvent,   setEditEvent]   = useState<Event | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchEvents() {
    setLoading(true)
    const now = new Date().toISOString()

    let q = supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, description, cover_url, type, price_cents')
      .order('starts_at', { ascending: filter !== 'past' })

    if (filter === 'upcoming') q = q.gte('starts_at', now)
    if (filter === 'past')     q = q.lt('starts_at', now)
    if (typeFilter !== 'all')  q = q.eq('type', typeFilter)

    const { data } = await q
    setEvents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [filter, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet événement ? Cette action est irréversible.')) return
    await supabase.from('events').delete().eq('id', id)
    flash('Événement supprimé')
    fetchEvents()
  }

  function openCreate() {
    setEditEvent(null)
    setModalOpen(true)
  }

  function openEdit(ev: Event) {
    setEditEvent(ev)
    setModalOpen(true)
  }

  function handleSaved() {
    flash(editEvent ? 'Événement mis à jour ✓' : 'Événement publié ✓')
    fetchEvents()
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
      <div className="px-5 pt-14 pb-5" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-white/50 font-medium">Administration</p>
            <h1 className="text-2xl font-extrabold text-white mt-0.5">Événements</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvel événement
          </button>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap">
          {/* Filtre statut */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as Filter)}
            className="h-9 px-3 rounded-xl text-sm font-semibold border-0 outline-none appearance-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            <option value="all">Tous</option>
            <option value="upcoming">À venir</option>
            <option value="past">Passés</option>
          </select>

          {/* Filtre type */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-9 px-3 rounded-xl text-sm font-semibold border-0 outline-none appearance-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            <option value="all">Tous les types</option>
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 py-5 pb-28 space-y-3">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100" />)
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            Aucun événement{filter !== 'all' ? ` ${filter === 'upcoming' ? 'à venir' : 'passé'}` : ''}.
          </div>
        ) : (
          events.map(ev => {
            const typeInfo = EVENT_TYPES[ev.type] ?? EVENT_TYPES.event_bde
            const isPast   = new Date(ev.starts_at) < new Date()

            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                style={{ opacity: isPast ? 0.75 : 1 }}
              >
                <div className="flex">
                  {/* Image / placeholder */}
                  <div
                    className="w-20 flex-shrink-0 bg-gray-100 flex items-center justify-center"
                    style={ev.cover_url ? {} : { backgroundColor: typeInfo.bg }}
                  >
                    {ev.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={typeInfo.color} strokeWidth={1.5} className="w-8 h-8 opacity-40">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-bold leading-snug truncate" style={{ color: '#1D3550' }}>
                        {ev.title}
                      </h3>
                      <span
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}
                      >
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(ev.starts_at)}</p>
                    {ev.location && (
                      <p className="text-xs text-gray-400 truncate">{ev.location}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => openEdit(ev)}
                        className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold transition active:scale-[0.97]"
                        style={{ backgroundColor: '#1D355010', color: '#1D3550' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold transition active:scale-[0.97]"
                        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal formulaire */}
      {modalOpen && (
        <EventFormModal
          event={editEvent}
          onClose={() => { setModalOpen(false); setEditEvent(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
