'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { FORMATIONS_ECM } from '@/lib/formations'

// ── Types ──────────────────────────────────────────────────────────────────

interface Profile {
  full_name:    string | null
  email:        string
  phone:        string | null
  formation:    string | null
  ecole:        string | null
  autre_ecole:  string | null
  points_balance: number
  student_code: string | null
}

interface Coupon {
  id: string
  emoji: string
  title: string
  event: string
  status: 'available' | 'used'
  used_at?: string
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_COUPONS: Coupon[] = [
  { id: '1', emoji: '🥃', title: 'Shot offert',  event: 'Soirée de rentrée BDE', status: 'available' },
  { id: '2', emoji: '🎟️', title: 'Entrée VIP',   event: 'Afterwork BDS',         status: 'used', used_at: '15 mars 2026' },
]

const MOCK_STATS = { events_count: 3, games_count: 2 }

// ── Paliers ────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Bronze', min: 0,    max: 500,  color: '#CD7F32' },
  { name: 'Argent', min: 500,  max: 1500, color: '#A0A0A0' },
  { name: 'Or',     min: 1500, max: null, color: '#FFD700' },
]

function getTier(pts: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (pts >= TIERS[i].min) return TIERS[i]
  }
  return TIERS[0]
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function displayFormation(profile: Profile | null) {
  if (!profile) return '—'
  if (profile.ecole === 'ECM') return profile.formation ?? '—'
  return profile.autre_ecole ?? profile.ecole ?? profile.formation ?? '—'
}

// ── Composant édition profil ───────────────────────────────────────────────

function EditProfileSheet({
  profile,
  userId,
  onClose,
  onSaved,
}: {
  profile: Profile
  userId: string
  onClose: () => void
  onSaved: (updated: Partial<Profile>) => void
}) {
  const nameParts = (profile.full_name ?? '').trim().split(/\s+/)
  const [prenom,    setPrenom]    = useState(nameParts[0] ?? '')
  const [nom,       setNom]       = useState(nameParts.slice(1).join(' '))
  const [phone,     setPhone]     = useState(profile.phone ?? '')
  const [formation, setFormation] = useState(profile.formation ?? '')
  const [autreEcole, setAutreEcole] = useState(profile.autre_ecole ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const isECM = profile.ecole === 'ECM'

  async function handleSave() {
    if (!prenom.trim()) {
      setError('Le prénom est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)

    const full_name = [prenom.trim(), nom.trim()].filter(Boolean).join(' ')
    const updates = {
      full_name,
      phone:       phone.trim()       || null,
      formation:   isECM ? (formation || null) : null,
      autre_ecole: !isECM ? (autreEcole.trim() || null) : null,
    }

    console.log('[ProfilPage] Saving →', updates)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (updateErr) {
      console.error('[ProfilPage] update error →', {
        message: updateErr.message,
        code:    updateErr.code,
        details: updateErr.details,
        hint:    updateErr.hint,
      })
      setError(`Erreur : ${updateErr.message}`)
      setSaving(false)
      return
    }

    onSaved(updates)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-5 pt-3 pb-10">
          <h2 className="text-lg font-extrabold mb-5" style={{ color: '#1D3550' }}>
            Modifier le profil
          </h2>

          <div className="space-y-4">
            {/* Prénom + Nom */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Prénom *</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  placeholder="Thomas"
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-orange-400 transition"
                  style={{ color: '#1D3550' }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Dupont"
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-orange-400 transition"
                  style={{ color: '#1D3550' }}
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-orange-400 transition"
                style={{ color: '#1D3550' }}
              />
            </div>

            {/* Formation / école */}
            {isECM ? (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Formation</label>
                <select
                  value={formation}
                  onChange={e => setFormation(e.target.value)}
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-orange-400 transition bg-white"
                  style={{ color: formation ? '#1D3550' : '#9CA3AF' }}
                >
                  <option value="">Sélectionne ta formation</option>
                  {FORMATIONS_ECM.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">École</label>
                <input
                  type="text"
                  value={autreEcole}
                  onChange={e => setAutreEcole(e.target.value)}
                  placeholder="Nom de ton école"
                  className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-orange-400 transition"
                  style={{ color: '#1D3550' }}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 font-medium">{error}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#E8622A' }}
            >
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </button>

            <button
              onClick={onClose}
              className="w-full h-12 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const router = useRouter()
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [editOpen,   setEditOpen]   = useState(false)
  const [saveToast,  setSaveToast]  = useState(false)
  const [couponToast, setCouponToast] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        console.log('[ProfilPage] auth.getUser →', user?.id, authErr)

        if (!user) {
          console.warn('[ProfilPage] No user found, showing mock data')
          setProfile({
            full_name:      'Thomas Dupont',
            email:          'thomas.dupont@ecm-dijon.fr',
            phone:          null,
            formation:      'M1 Finance MJV',
            ecole:          'ECM',
            autre_ecole:    null,
            points_balance: 620,
            student_code:   'ECM-DEMO01',
          })
          setLoading(false)
          return
        }

        setUserId(user.id)

        let data: Record<string, unknown> | null = null

        // Tentative 1 : requête complète
        const { data: fullData, error: fullError } = await supabase
          .from('profiles')
          .select('full_name, phone, formation, ecole, autre_ecole, points_balance, student_code')
          .eq('id', user.id)
          .single()

        console.log('[ProfilPage] profiles query → data:', fullData)

        if (fullError) {
          console.warn('[ProfilPage] full query failed, retrying with base columns →', {
            message: fullError.message, code: fullError.code,
          })
          // Tentative 2 : colonnes de base (schema ancien)
          const { data: baseData, error: baseError } = await supabase
            .from('profiles')
            .select('full_name, points_balance')
            .eq('id', user.id)
            .single()

          if (baseError) {
            console.error('[ProfilPage] base query error →', {
              message: baseError.message, code: baseError.code,
              details: baseError.details, hint: baseError.hint,
            })
            throw baseError
          }
          data = baseData as Record<string, unknown>
        } else {
          data = fullData as Record<string, unknown>
        }

        setProfile({
          full_name:      (data?.full_name      as string  | null) ?? null,
          email:          user.email                               ?? '',
          phone:          (data?.phone          as string  | null) ?? null,
          formation:      (data?.formation      as string  | null) ?? null,
          ecole:          (data?.ecole          as string  | null) ?? null,
          autre_ecole:    (data?.autre_ecole    as string  | null) ?? null,
          points_balance: (data?.points_balance as number)         ?? 0,
          student_code:   (data?.student_code  as string  | null) ?? null,
        })
      } catch (err: unknown) {
        const e = err as Record<string, unknown>
        console.error('[ProfilPage] fetchProfile error →', {
          message: e?.message,
          code:    e?.code,
          details: e?.details,
          hint:    e?.hint,
          status:  e?.status,
          raw:     String(err),
        })
        setProfile({
          full_name:      'Thomas Dupont',
          email:          'thomas.dupont@ecm-dijon.fr',
          phone:          null,
          formation:      'M1 Finance MJV',
          ecole:          'ECM',
          autre_ecole:    null,
          points_balance: 620,
          student_code:   'ECM-DEMO01',
        })
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  async function handleSignOut() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function handleSaved(updated: Partial<Profile>) {
    setProfile(prev => prev ? { ...prev, ...updated } : prev)
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  function handleCouponClick() {
    setCouponToast(true)
    setTimeout(() => setCouponToast(false), 2500)
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-52 animate-pulse" style={{ backgroundColor: '#1D3550' + '80' }} />
        <div className="px-5 mt-4 space-y-4">
          <div className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    )
  }

  const tier    = getTier(profile?.points_balance ?? 0)
  const tierIdx = TIERS.indexOf(tier)
  const nextTier = TIERS[tierIdx + 1] ?? null

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast sauvegarde */}
      <div
        className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl whitespace-nowrap transition-all duration-300"
        style={{
          backgroundColor: '#1D3550',
          opacity: saveToast ? 1 : 0,
          transform: `translateX(-50%) translateY(${saveToast ? '0' : '-8px'})`,
          pointerEvents: 'none',
        }}
      >
        ✅ Profil mis à jour
      </div>

      {/* Toast coupon coming soon */}
      <div
        className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl whitespace-nowrap transition-all duration-300"
        style={{
          backgroundColor: '#E8622A',
          opacity: couponToast ? 1 : 0,
          transform: `translateX(-50%) translateY(${couponToast ? '0' : '-8px'})`,
          pointerEvents: 'none',
        }}
      >
        🚧 Bientôt disponible
      </div>

      {/* Header */}
      <div
        className="px-5 pt-14 pb-8 flex flex-col items-center"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-extrabold mb-3 border-4 border-white/20"
          style={{ backgroundColor: '#E8622A' }}
        >
          {getInitials(profile?.full_name ?? null)}
        </div>

        {profile?.full_name ? (
          <>
            <h1 className="text-xl font-extrabold text-white">{profile.full_name}</h1>
            <p className="text-sm text-white/60 mt-0.5">{displayFormation(profile)}</p>
            {profile.phone && (
              <p className="text-xs text-white/40 mt-0.5">{profile.phone}</p>
            )}
          </>
        ) : (
          <h1 className="text-base font-semibold text-white/70 italic mb-0.5">Profil incomplet</h1>
        )}

        {/* Bouton modifier */}
        <button
          onClick={() => setEditOpen(true)}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition active:scale-[0.95]"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          {profile?.full_name ? 'Modifier le profil' : 'Compléter le profil'}
        </button>
      </div>

      <div className="px-5 -mt-4 space-y-4 pb-10">

        {/* Bannière profil incomplet */}
        {!profile?.full_name && (
          <button
            onClick={() => setEditOpen(true)}
            className="w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}
          >
            <span className="text-2xl flex-shrink-0">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#1D3550' }}>Complète ton profil</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ajoute ton prénom, nom et formation pour personnaliser ton expérience.
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth={2.5} className="w-4 h-4 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Carte points */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Solde de points</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-extrabold" style={{ color: '#E8622A' }}>
              {(profile?.points_balance ?? 0).toLocaleString('fr-FR')}
            </span>
            <span className="text-base font-medium text-gray-400 mb-1">points</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: tier.color }}
            >
              Palier {tier.name}
            </div>
            {nextTier && (
              <span className="text-xs text-gray-400">
                · {nextTier.min - (profile?.points_balance ?? 0)} pts avant {nextTier.name}
              </span>
            )}
          </div>
        </div>

        {/* Code étudiant */}
        {profile?.student_code && (
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Mon code étudiant</p>
            <div className="flex flex-col items-center gap-3">
              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: '#1D3550' + '08', border: '1px solid ' + '#1D3550' + '15' }}
              >
                <QRCodeSVG
                  value={profile.student_code}
                  size={150}
                  fgColor="#1D3550"
                  bgColor="transparent"
                  level="M"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-2xl font-extrabold tracking-widest"
                  style={{ color: '#E8622A', fontFamily: 'monospace' }}
                >
                  {profile.student_code}
                </span>
                <p className="text-xs text-gray-400 text-center">
                  Présente ce code aux événements BDE
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Mes stats</p>
          <div className="flex gap-4">
            <div className="flex-1 rounded-xl py-4 flex flex-col items-center" style={{ backgroundColor: '#1D3550' + '10' }}>
              <span className="text-3xl font-extrabold" style={{ color: '#1D3550' }}>{MOCK_STATS.events_count}</span>
              <span className="text-xs text-gray-500 mt-1 text-center">Événements<br />participés</span>
            </div>
            <div className="flex-1 rounded-xl py-4 flex flex-col items-center" style={{ backgroundColor: '#E8622A' + '10' }}>
              <span className="text-3xl font-extrabold" style={{ color: '#E8622A' }}>{MOCK_STATS.games_count}</span>
              <span className="text-xs text-gray-500 mt-1 text-center">Soirées<br />jouées</span>
            </div>
          </div>
        </div>

        {/* Mes coupons */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mes coupons</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#E8622A' + '15', color: '#E8622A' }}
            >
              Bientôt disponible
            </span>
          </div>

          <div className="space-y-2.5">
            {MOCK_COUPONS.map(coupon => (
              <button
                key={coupon.id}
                onClick={handleCouponClick}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition active:scale-[0.98]"
                style={{
                  backgroundColor: coupon.status === 'available' ? '#E8622A' + '08' : '#F3F4F6',
                  border: `1px solid ${coupon.status === 'available' ? '#E8622A' + '25' : '#E5E7EB'}`,
                  opacity: coupon.status === 'used' ? 0.6 : 1,
                }}
              >
                <span className="text-2xl flex-shrink-0">{coupon.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: '#1D3550',
                      textDecoration: coupon.status === 'used' ? 'line-through' : 'none',
                    }}
                  >
                    {coupon.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{coupon.event}</p>
                  {coupon.status === 'used' && coupon.used_at && (
                    <p className="text-xs text-gray-400 mt-0.5">Utilisé le {coupon.used_at}</p>
                  )}
                </div>
                <span
                  className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={
                    coupon.status === 'available'
                      ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                      : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
                  }
                >
                  {coupon.status === 'available' ? 'Disponible' : 'Utilisé'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Déconnexion */}
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="w-full rounded-2xl font-bold text-white text-sm transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: '#DC2626', height: '52px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </div>

      {/* Bottom sheet édition */}
      {editOpen && profile && userId && (
        <EditProfileSheet
          profile={profile}
          userId={userId}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
