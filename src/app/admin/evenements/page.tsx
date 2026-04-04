'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Link as LinkIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Event {
  id:                 string
  title:              string
  starts_at:          string
  ends_at:            string | null
  location:           string | null
  description:        string | null
  cover_url:          string | null
  video_url:          string | null
  type:               string
  price_cents:        number
  registration_url:   string | null
  registration_label: string | null
}

type Filter = 'all' | 'upcoming' | 'past'

// ── Constantes ─────────────────────────────────────────────────────────────

const EVENT_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  soiree_bde:    { label: 'Soirée BDE',        color: '#E8622A', bg: '#FFF4EE' },
  event_bde:     { label: 'Événement BDE',     color: '#1D3550', bg: '#EEF2F7' },
  match_bds:     { label: 'Match BDS',         color: '#16A34A', bg: '#F0FDF4' },
  event_sportif: { label: 'Événement sportif', color: '#7C3AED', bg: '#F5F3FF' },
}

const TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, { label }]) => ({ value, label }))

const VIDEO_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function toDateInput(iso: string) { return iso.split('T')[0] }
function toTimeInput(iso: string) { return iso.split('T')[1]?.slice(0, 5) ?? '' }

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = new window.Image()
  image.src = imageSrc
  await new Promise<void>(resolve => { image.onload = () => resolve() })

  const canvas = document.createElement('canvas')
  canvas.width  = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  )
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas vide')); return }
      resolve(new File([blob], 'cover_cropped.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  })
}

// ── Composant CropModal ───────────────────────────────────────────────────

function CropModal({
  src,
  onConfirm,
  onCancel,
}: {
  src:       string
  onConfirm: (file: File, preview: string) => void
  onCancel:  () => void
}) {
  const [crop,   setCrop]   = useState({ x: 0, y: 0 })
  const [zoom,   setZoom]   = useState(1)
  const [area,   setArea]   = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  async function handleConfirm() {
    if (!area) return
    setSaving(true)
    try {
      const file    = await getCroppedImg(src, area)
      const preview = URL.createObjectURL(file)
      onConfirm(file, preview)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Titre */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <p className="text-white font-bold text-sm">Recadrer la photo (4:5)</p>
        <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Zone cropper */}
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={4 / 5}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Contrôles */}
      <div className="px-5 pb-10 pt-4 bg-black space-y-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4 flex-shrink-0 opacity-60">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
          </svg>
          <input
            type="range" min={1} max={3} step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-orange-500"
          />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5 flex-shrink-0 opacity-60">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
          </svg>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-2xl font-semibold text-sm text-white border border-white/20 transition active:scale-[0.97]"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 h-12 rounded-2xl font-bold text-white transition active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: '#E8622A' }}
          >
            {saving ? 'Recadrage…' : 'Valider le recadrage'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Formulaire ─────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  title:       '',
  date:        '',
  time:        '20:00',
  ends_date:   '',
  ends_time:   '',
  location:    '',
  type:        'soiree_bde',
  description: '',
  price_cents: '0',
}

// ── Modal formulaire ───────────────────────────────────────────────────────

function EventFormModal({
  event,
  onClose,
  onSaved,
}: {
  event:   Event | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!event

  const [form, setForm] = useState(() =>
    event ? {
      title:       event.title,
      date:        toDateInput(event.starts_at),
      time:        toTimeInput(event.starts_at),
      ends_date:   event.ends_at ? toDateInput(event.ends_at) : '',
      ends_time:   event.ends_at ? toTimeInput(event.ends_at) : '',
      location:    event.location    ?? '',
      type:        event.type        ?? 'soiree_bde',
      description: event.description ?? '',
      price_cents: String((event.price_cents ?? 0) / 100),
    } : { ...DEFAULT_FORM }
  )

  // Photo + crop
  const [coverPreview,  setCoverPreview]  = useState<string | null>(event?.cover_url ?? null)
  const [croppedFile,   setCroppedFile]   = useState<File | null>(null)
  const [coverRemoved,  setCoverRemoved]  = useState(false)
  const [cropSrc,       setCropSrc]       = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  // Vidéo
  const [videoPreview,  setVideoPreview]  = useState<string | null>(event?.video_url ?? null)
  const [videoFile,     setVideoFile]     = useState<File | null>(null)
  const [videoRemoved,  setVideoRemoved]  = useState(false)
  const videoRef = useRef<HTMLInputElement>(null)

  // Lien externe
  const [linkEnabled, setLinkEnabled] = useState(!!event?.registration_url)
  const [linkUrl,     setLinkUrl]     = useState(event?.registration_url   ?? '')
  const [linkLabel,   setLinkLabel]   = useState(event?.registration_label ?? '')

  // Sondage
  const [pollEnabled,  setPollEnabled]  = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions,  setPollOptions]  = useState(['', ''])

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function set(name: string, value: string) {
    setForm(p => ({ ...p, [name]: value }))
  }

  // ── Photo ──────────────────────────────────────────────────────────────

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)   // ouvre le cropper
    e.target.value = ''     // reset input
  }

  function handleCropConfirm(file: File, preview: string) {
    setCroppedFile(file)
    setCoverPreview(preview)
    setCoverRemoved(false)
    setCropSrc(null)
  }

  function removeCover() {
    setCoverPreview(null)
    setCroppedFile(null)
    setCoverRemoved(true)
  }

  async function uploadCover(file: File): Promise<string | null> {
    const path = `covers/${Date.now()}.jpg`
    const { data, error: upErr } = await supabase.storage
      .from('events')
      .upload(path, file, { upsert: true, contentType: 'image/jpeg' })
    if (upErr || !data) { console.warn('Cover upload:', upErr?.message); return null }
    return supabase.storage.from('events').getPublicUrl(data.path).data.publicUrl
  }

  // ── Vidéo ──────────────────────────────────────────────────────────────

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > VIDEO_MAX_BYTES) {
      setError('La vidéo dépasse la limite de 50 Mo.')
      e.target.value = ''
      return
    }
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
    setVideoRemoved(false)
    e.target.value = ''
  }

  function removeVideo() {
    setVideoPreview(null)
    setVideoFile(null)
    setVideoRemoved(true)
  }

  async function uploadVideo(file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
    const path = `videos/${Date.now()}.${ext}`
    const { data, error: upErr } = await supabase.storage
      .from('events-videos')
      .upload(path, file, { upsert: true })
    if (upErr || !data) { console.warn('Video upload:', upErr?.message); return null }
    return supabase.storage.from('events-videos').getPublicUrl(data.path).data.publicUrl
  }

  // ── Sondage ────────────────────────────────────────────────────────────

  function setPollOption(i: number, val: string) {
    setPollOptions(opts => opts.map((o, idx) => idx === i ? val : o))
  }
  function addPollOption() {
    if (pollOptions.length < 6) setPollOptions(o => [...o, ''])
  }
  function removePollOption(i: number) {
    if (pollOptions.length <= 2) return
    setPollOptions(o => o.filter((_, idx) => idx !== i))
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || !form.time) {
      setError('Titre, date et heure sont obligatoires.')
      return
    }
    if (pollEnabled) {
      if (!pollQuestion.trim()) { setError('La question du sondage est obligatoire.'); return }
      if (pollOptions.filter(o => o.trim()).length < 2) { setError('Le sondage nécessite au moins 2 options.'); return }
    }

    setSaving(true)
    setError(null)

    // Cover
    let coverUrl: string | null
    if (coverRemoved) {
      coverUrl = null
    } else if (croppedFile) {
      coverUrl = await uploadCover(croppedFile) ?? event?.cover_url ?? null
    } else {
      coverUrl = event?.cover_url ?? null
    }

    // Vidéo
    let videoUrl: string | null
    if (videoRemoved) {
      videoUrl = null
    } else if (videoFile) {
      videoUrl = await uploadVideo(videoFile) ?? event?.video_url ?? null
    } else {
      videoUrl = event?.video_url ?? null
    }

    const payload = {
      title:              form.title.trim(),
      starts_at:          `${form.date}T${form.time}:00`,
      ends_at:            form.ends_date && form.ends_time ? `${form.ends_date}T${form.ends_time}:00` : null,
      location:           form.location.trim()    || null,
      type:               form.type,
      description:        form.description.trim() || null,
      price_cents:        Math.round(parseFloat(form.price_cents || '0') * 100),
      cover_url:          coverUrl,
      video_url:          videoUrl,
      registration_url:   linkEnabled && linkUrl.trim() ? linkUrl.trim() : null,
      registration_label: linkEnabled && linkLabel.trim() ? linkLabel.trim() : null,
    }

    if (isEdit) {
      const { error: e } = await supabase.from('events').update(payload).eq('id', event!.id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { data: newEvent, error: e } = await supabase
        .from('events')
        .insert(payload)
        .select('id')
        .single()
      if (e || !newEvent) { setError(e?.message ?? 'Erreur création'); setSaving(false); return }

      if (pollEnabled) {
        const validOpts = pollOptions.filter(o => o.trim())
        await supabase.from('sondages').insert({
          event_id: newEvent.id,
          question: pollQuestion.trim(),
          options:  validOpts,
        })
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5'
  const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'

  const hasCover = !!coverPreview
  const hasVideo = !!videoPreview
  const hasBoth  = hasCover && hasVideo

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[94vh] overflow-y-auto lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-lg lg:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier l\'événement' : 'Nouvel événement'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-10 space-y-4">
          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className={lbl}>Titre *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="ex: Soirée de rentrée BDE" required className={inp} style={{ color: '#1D3550' }} />
          </div>

          {/* Catégorie */}
          <div>
            <label className={lbl}>Catégorie *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className={inp} style={{ color: '#1D3550' }}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Date + heure début */}
          <div>
            <label className={lbl}>Date & heure de début *</label>
            <div className="flex gap-2">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                required className={`${inp} flex-1`} style={{ color: '#1D3550' }} />
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                required className={`${inp} w-28`} style={{ color: '#1D3550' }} />
            </div>
          </div>

          {/* Date + heure fin */}
          <div>
            <label className={lbl}>Date & heure de fin (optionnel)</label>
            <div className="flex gap-2">
              <input type="date" value={form.ends_date} onChange={e => set('ends_date', e.target.value)}
                className={`${inp} flex-1`} style={{ color: '#1D3550' }} />
              <input type="time" value={form.ends_time} onChange={e => set('ends_time', e.target.value)}
                className={`${inp} w-28`} style={{ color: '#1D3550' }} />
            </div>
          </div>

          {/* Lieu */}
          <div>
            <label className={lbl}>Lieu</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="ex: Le Consortium, Dijon" className={inp} style={{ color: '#1D3550' }} />
          </div>

          {/* Tarif */}
          <div>
            <label className={lbl}>Tarif (€)</label>
            <input type="number" min="0" step="0.01" value={form.price_cents}
              onChange={e => set('price_cents', e.target.value)}
              placeholder="0 = gratuit" className={inp} style={{ color: '#1D3550' }} />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Décris l'événement…"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white resize-none"
              style={{ color: '#1D3550' }} />
          </div>

          {/* ── Médias ── */}
          <div>
            <label className={lbl}>Médias</label>

            {/* Previews côte à côte (ou seule) */}
            {(hasCover || hasVideo) && (
              <div className={`mb-3 ${hasBoth ? 'grid grid-cols-2 gap-2' : ''}`}>

                {/* Photo */}
                {hasCover && (
                  <div className="relative rounded-2xl overflow-hidden bg-gray-100" style={{ aspectRatio: '4/5' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreview!} alt="Photo" className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setCoverPreview(null)} />
                    {/* Badge type */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-bold text-white">
                      📷 Photo 4:5
                    </div>
                    {/* Bouton X */}
                    <button
                      type="button"
                      onClick={removeCover}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition active:scale-90"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {/* Bouton Changer */}
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-black/50 transition active:scale-95"
                    >
                      Changer
                    </button>
                  </div>
                )}

                {/* Vidéo */}
                {hasVideo && (
                  <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/5' }}>
                    <video
                      src={videoPreview!}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    {/* Icône ▶ */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-bold text-white">
                      🎬 Vidéo
                    </div>
                    {/* Bouton X */}
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition active:scale-90"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {/* Bouton Changer */}
                    <button
                      type="button"
                      onClick={() => videoRef.current?.click()}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-black/50 transition active:scale-95"
                    >
                      Changer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Boutons d'ajout */}
            <div className={`grid gap-2 ${!hasCover && !hasVideo ? 'grid-cols-2' : hasCover && !hasVideo ? 'grid-cols-1' : !hasCover && hasVideo ? 'grid-cols-1' : 'hidden'}`}>
              {!hasCover && (
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 transition hover:border-[#E8622A] hover:bg-orange-50 active:scale-[0.97]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.8} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-400">Ajouter une photo</span>
                  <span className="text-[10px] text-gray-300">Format 4:5 recommandé</span>
                </button>
              )}
              {!hasVideo && (
                <button
                  type="button"
                  onClick={() => videoRef.current?.click()}
                  className="h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 transition hover:border-[#E8622A] hover:bg-orange-50 active:scale-[0.97]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.8} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-400">Ajouter une vidéo</span>
                  <span className="text-[10px] text-gray-300">MP4, MOV, WebM — max 50 Mo</span>
                </button>
              )}
            </div>

            {/* Inputs cachés */}
            <input
              ref={coverRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={handleCoverChange}
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mov"
              className="hidden"
              onChange={handleVideoChange}
            />
          </div>

          {/* Lien externe */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setLinkEnabled(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#1D3550' }}>
                <LinkIcon size={15} strokeWidth={2.5} color="#E8622A" />
                Ajouter un lien
              </span>
              <div
                className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
                style={{ backgroundColor: linkEnabled ? '#E8622A' : '#E5E7EB' }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: linkEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </div>
            </button>

            {linkEnabled && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <label className={lbl}>Texte du bouton</label>
                  <input
                    type="text"
                    value={linkLabel}
                    onChange={e => setLinkLabel(e.target.value)}
                    placeholder="S'inscrire"
                    maxLength={50}
                    className={inp}
                    style={{ color: '#1D3550' }}
                  />
                </div>
                <div>
                  <label className={lbl}>URL du lien *</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className={inp}
                    style={{ color: '#1D3550' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sondage */}
          {!isEdit && (
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setPollEnabled(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-semibold" style={{ color: '#1D3550' }}>
                  Ajouter un sondage
                </span>
                <div
                  className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
                  style={{ backgroundColor: pollEnabled ? '#E8622A' : '#E5E7EB' }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: pollEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </div>
              </button>

              {pollEnabled && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                  <div className="pt-3">
                    <label className={lbl}>Question *</label>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      placeholder="ex: Quel thème préféres-tu ?"
                      className={inp}
                      style={{ color: '#1D3550' }}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Options</label>
                    <div className="space-y-2">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={e => setPollOption(i, e.target.value)}
                            placeholder={`Option ${i + 1}`}
                            className={`${inp} flex-1`}
                            style={{ color: '#1D3550' }}
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removePollOption(i)}
                              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: '#FEE2E2' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2.5} className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {pollOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={addPollOption}
                        className="mt-2 text-xs font-semibold flex items-center gap-1"
                        style={{ color: '#E8622A' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Ajouter une option
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#E8622A' }}
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer l\'événement'}
          </button>
        </form>
      </div>

      {/* Crop modal — par-dessus tout */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </>
  )
}

// ── Confirmation suppression ───────────────────────────────────────────────

function DeleteConfirm({
  event,
  onClose,
  onDeleted,
}: {
  event:     Event
  onClose:   () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('events').delete().eq('id', event.id)
    setDeleting(false)
    onDeleted()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-4 z-50 bg-white rounded-2xl shadow-2xl p-6 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-80">
        <p className="text-base font-bold text-center mb-1" style={{ color: '#1D3550' }}>
          Supprimer cet événement ?
        </p>
        <p className="text-sm text-gray-400 text-center mb-6">
          « {event.title} » sera définitivement supprimé.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500">
            Annuler
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 h-11 rounded-xl font-bold text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: '#DC2626' }}>
            {deleting ? '…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EvenementsPage() {
  const [events,       setEvents]       = useState<Event[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<Filter>('all')
  const [formEvent,    setFormEvent]    = useState<Event | null>(null)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)

  async function fetchEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('id, title, starts_at, ends_at, location, description, cover_url, video_url, type, price_cents, registration_url, registration_label')
      .order('starts_at', { ascending: false })
    setEvents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [])

  const now = new Date().toISOString()

  const filtered = events.filter(ev => {
    if (filter === 'upcoming') return ev.starts_at >= now
    if (filter === 'past')     return ev.starts_at < now
    return true
  })

  function openCreate() { setFormEvent(null); setModalOpen(true) }
  function openEdit(ev: Event) { setFormEvent(ev); setModalOpen(true) }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',      label: 'Tous' },
    { key: 'upcoming', label: 'À venir' },
    { key: 'past',     label: 'Passés' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-5" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">Événements</h1>
            <p className="text-xs text-white/50 mt-0.5">{events.length} événement{events.length !== 1 ? 's' : ''} au total</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Créer
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition"
              style={{
                backgroundColor: filter === f.key ? '#E8622A' : 'rgba(255,255,255,0.15)',
                color: filter === f.key ? '#fff' : 'rgba(255,255,255,0.8)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 py-4 pb-24 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-gray-100" />
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Aucun événement trouvé.</p>
          </div>
        ) : (
          filtered.map(ev => {
            const type   = EVENT_TYPES[ev.type] ?? EVENT_TYPES.event_bde
            const isPast = ev.starts_at < now
            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                style={{ opacity: isPast ? 0.7 : 1 }}
              >
                <div className="flex">
                  {/* Vignette cover */}
                  <div
                    className="w-20 flex-shrink-0 flex items-center justify-center relative"
                    style={{
                      background: ev.cover_url
                        ? undefined
                        : `linear-gradient(160deg, ${type.color} 0%, ${type.color}cc 100%)`,
                      minHeight: '6rem',
                    }}
                  >
                    {ev.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover absolute inset-0" />
                    ) : (
                      <span className="text-2xl">📅</span>
                    )}
                    {/* Badge vidéo */}
                    {ev.video_url && (
                      <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3 ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1"
                          style={{ backgroundColor: type.bg, color: type.color }}
                        >
                          {type.label}
                        </span>
                        <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>{ev.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{formatDate(ev.starts_at)}</p>
                        {ev.location && <p className="text-xs text-gray-400 truncate">{ev.location}</p>}
                        {ev.price_cents > 0 && (
                          <p className="text-xs font-semibold mt-0.5" style={{ color: '#E8622A' }}>
                            {(ev.price_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEdit(ev)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: '#1D355015' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(ev)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: '#DC262615' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {modalOpen && (
        <EventFormModal
          event={formEvent}
          onClose={() => setModalOpen(false)}
          onSaved={fetchEvents}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          event={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchEvents}
        />
      )}
    </div>
  )
}
