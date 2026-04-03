'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

interface Partner {
  id:          string
  name:        string
  address:     string | null
  city:        string | null
  phone:       string | null
  description: string | null
  offer:       string | null
  category:    string | null
  logo_url:    string | null
  is_active:   boolean
}

const CATEGORIES = ['Restaurant', 'Bar', 'Sport', 'Culture', 'Mode', 'Bien-être', 'Tech', 'Autre']

const DEFAULT_FORM = {
  name:        '',
  address:     '',
  city:        '',
  phone:       '',
  description: '',
  offer:       '',
  category:    '',
}

// ── Modal formulaire ───────────────────────────────────────────────────────

function PartnerFormModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!partner
  const [form,      setForm]      = useState(() => partner ? {
    name:        partner.name,
    address:     partner.address     ?? '',
    city:        partner.city        ?? '',
    phone:       partner.phone       ?? '',
    description: partner.description ?? '',
    offer:       partner.offer       ?? '',
    category:    partner.category    ?? '',
  } : { ...DEFAULT_FORM })
  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(partner?.logo_url ?? null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function set(name: string, value: string) {
    setForm(p => ({ ...p, [name]: value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `logos/${Date.now()}.${ext}`
    console.log('[uploadLogo] Uploading to bucket "partners", path:', path)
    const { data, error: upErr } = await supabase.storage
      .from('partners')
      .upload(path, file, { upsert: true })
    if (upErr || !data) {
      console.error('[uploadLogo] Upload error:', upErr?.message)
      return null
    }
    const publicUrl = supabase.storage.from('partners').getPublicUrl(data.path).data.publicUrl
    console.log('[uploadLogo] Public URL:', publicUrl)
    return publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true); setError(null)

    let logoUrl = partner?.logo_url ?? null
    if (logoFile) {
      const uploaded = await uploadLogo(logoFile)
      if (uploaded) logoUrl = uploaded
    }

    const payload = {
      name:        form.name.trim(),
      address:     form.address.trim()     || null,
      city:        form.city.trim()        || null,
      phone:       form.phone.trim()       || null,
      description: form.description.trim() || null,
      offer:       form.offer.trim()       || null,
      category:    form.category           || null,
      logo_url:    logoUrl,
    }

    if (isEdit) {
      const { error: e } = await supabase.from('partners').update(payload).eq('id', partner!.id)
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('partners').insert(payload)
      if (e) { setError(e.message); setSaving(false); return }
    }

    setSaving(false); onSaved(); onClose()
  }

  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5'
  const inp = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[94vh] overflow-y-auto lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-lg lg:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1 lg:hidden"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>
            {isEdit ? 'Modifier le partenaire' : 'Nouveau partenaire'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-10 space-y-4">
          {error && <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100"><p className="text-sm text-red-600">{error}</p></div>}

          <div><label className={lbl}>Nom *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Bar Le Consortium" required className={inp} style={{ color: '#1D3550' }} /></div>

          <div><label className={lbl}>Catégorie</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inp} style={{ color: '#1D3550' }}>
              <option value="">— Choisir —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>

          <div className="flex gap-2">
            <div className="flex-1"><label className={lbl}>Adresse</label>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rue…" className={inp} style={{ color: '#1D3550' }} /></div>
            <div className="w-32"><label className={lbl}>Ville</label>
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Dijon" className={inp} style={{ color: '#1D3550' }} /></div>
          </div>

          <div><label className={lbl}>Téléphone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="03 80 …" className={inp} style={{ color: '#1D3550' }} /></div>

          <div><label className={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="Présentation du partenaire…" className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white resize-none" style={{ color: '#1D3550' }} /></div>

          <div><label className={lbl}>Offre partenaire</label>
            <textarea value={form.offer} onChange={e => set('offer', e.target.value)} rows={2}
              placeholder="ex: -10% sur la carte sur présentation du QR code étudiant…" className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition bg-white resize-none" style={{ color: '#1D3550' }} /></div>

          <div><label className={lbl}>Logo</label>
            {logoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-xl border border-gray-100 mb-2" />
            )}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full h-11 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 flex items-center justify-center gap-2 transition hover:border-[#E8622A] hover:text-[#E8622A]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {logoPreview ? 'Changer le logo' : 'Choisir un logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} /></div>

          <button type="submit" disabled={saving}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#E8622A' }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter le partenaire'}
          </button>
        </form>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PartenairesPage() {
  const [partners,     setPartners]     = useState<Partner[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Partner | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  async function fetchPartners() {
    setLoading(true)
    const { data } = await supabase
      .from('partners')
      .select('id, name, address, city, phone, description, offer, category, logo_url, is_active')
      .order('name')
    setPartners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPartners() }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('partners').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    fetchPartners()
  }

  function openCreate() { setEditTarget(null); setModalOpen(true) }
  function openEdit(p: Partner) { setEditTarget(p); setModalOpen(true) }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-5" style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">Partenaires</h1>
            <p className="text-xs text-white/50 mt-0.5">{partners.length} partenaire{partners.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition active:scale-[0.97]"
            style={{ backgroundColor: '#E8622A' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 py-4 pb-24 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-3xl mb-2">🤝</p>
            <p className="text-gray-400 text-sm">Aucun partenaire enregistré.</p>
          </div>
        ) : (
          partners.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100"
                style={{ backgroundColor: '#F3F4F6' }}>
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt={p.name} className="w-10 h-10 object-contain rounded-lg" />
                ) : (
                  <span className="text-xl">🏪</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>{p.name}</p>
                {p.category && (
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                    style={{ backgroundColor: '#E8622A15', color: '#E8622A' }}>{p.category}</span>
                )}
                {p.city && <p className="text-xs text-gray-400 mt-0.5">{p.city}</p>}
                {p.offer && <p className="text-xs text-gray-400 truncate mt-0.5">🎁 {p.offer}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1D355015' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
                <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DC262615' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <PartnerFormModal
          partner={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={fetchPartners}
        />
      )}

      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-x-4 bottom-4 z-50 bg-white rounded-2xl shadow-2xl p-6 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-80">
            <p className="text-base font-bold text-center mb-1" style={{ color: '#1D3550' }}>Supprimer ce partenaire ?</p>
            <p className="text-sm text-gray-400 text-center mb-6">« {deleteTarget.name} » sera supprimé.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 h-11 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ backgroundColor: '#DC2626' }}>
                {deleting ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
