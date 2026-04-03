'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { FORMATIONS_ECM } from '@/lib/formations'
import CouponFlow, { type CouponAssignment } from '@/components/CouponFlow'

// ── Types ──────────────────────────────────────────────────────────────────

interface CouponRow extends CouponAssignment {
  status:     'pending' | 'used'
  used_at:    string | null
  quantity:   number | null
  used_count: number
}

interface Profile {
  full_name:      string | null
  email:          string
  phone:          string | null
  formation:      string | null
  ecole:          string | null
  autre_ecole:    string | null
  points_balance: number
  student_code:   string | null
  role:           string | null
}

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
  if (!profile) return 'Non renseigné'
  if (profile.ecole === 'ECM') return profile.formation ?? 'Non renseigné'
  return profile.autre_ecole ?? profile.ecole ?? profile.formation ?? 'Non renseigné'
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
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loggingOut,    setLoggingOut]    = useState(false)
  const [editOpen,      setEditOpen]      = useState(false)
  const [saveToast,     setSaveToast]     = useState(false)
  const [qrOpen,        setQrOpen]        = useState(false)
  const [coupons,       setCoupons]       = useState<CouponRow[]>([])
  const [activeCoupon,  setActiveCoupon]  = useState<CouponRow | null>(null)
  const [notifGranted,    setNotifGranted]    = useState<boolean | null>(null)
  const [iosUnsupported,  setIosUnsupported]  = useState(false)
  const [debugLogs,       setDebugLogs]       = useState<string[]>([])

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
            role:           null,
          })
          setLoading(false)
          return
        }

        setUserId(user.id)

        // Requête principale — toutes les colonnes nécessaires
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, phone, formation, ecole, autre_ecole, points_balance, student_code, role')
          .eq('id', user.id)
          .single()

        console.log('[ProfilPage] profiles query → raw data:', profileData)
        console.log('[ProfilPage] profiles query → error:', profileError)
        console.log('[ProfilPage] student_code from DB:', profileData?.student_code)

        if (profileError) {
          console.error('[ProfilPage] query error →', {
            message: profileError.message,
            code:    profileError.code,
            details: profileError.details,
            hint:    profileError.hint,
          })
          throw profileError
        }

        const built: Profile = {
          full_name:      profileData?.full_name      ?? null,
          email:          user.email                  ?? '',
          phone:          profileData?.phone          ?? null,
          formation:      profileData?.formation      ?? null,
          ecole:          profileData?.ecole          ?? null,
          autre_ecole:    profileData?.autre_ecole    ?? null,
          points_balance: profileData?.points_balance ?? 0,
          student_code:   profileData?.student_code   ?? null,
          role:           profileData?.role           ?? null,
        }

        console.log('[ProfilPage] built profile → student_code:', built.student_code)
        setProfile(built)

        // Coupons : pending non expirés + utilisés il y a moins de 2h
        const now2h  = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        const nowIso = new Date().toISOString()
        const { data: assignData } = await supabase
          .from('coupon_assignments')
          .select('id, coupon_id, status, used_at, coupons(emoji, title, description, available_from, expires_at, quantity)')
          .eq('user_id', user.id)
          .or(`status.eq.pending,and(status.eq.used,used_at.gt.${now2h})`)

        if (assignData && assignData.length > 0) {
          // Récupère les counts d'utilisation globaux pour ces coupons
          const couponIds = assignData.map((a: Record<string, unknown>) => a.coupon_id as string)
          const { data: usedData } = await supabase
            .from('coupon_assignments')
            .select('coupon_id')
            .in('coupon_id', couponIds)
            .eq('status', 'used')

          const usedCountMap: Record<string, number> = {}
          for (const row of usedData ?? []) {
            const cid = (row as { coupon_id: string }).coupon_id
            usedCountMap[cid] = (usedCountMap[cid] ?? 0) + 1
          }

          const rows = assignData
            .filter((a: Record<string, unknown>) => {
              const c = a.coupons as { expires_at: string } | null
              if (a.status === 'pending') return c && c.expires_at > nowIso
              return true
            })
            .map((a: Record<string, unknown>) => {
              const c = a.coupons as { emoji: string; title: string; description: string | null; available_from: string; expires_at: string; quantity: number | null }
              return {
                id:             a.id as string,
                emoji:          c.emoji,
                title:          c.title,
                description:    c.description,
                available_from: c.available_from,
                expires_at:     c.expires_at,
                status:         a.status as 'pending' | 'used',
                used_at:        (a.used_at as string | null) ?? null,
                quantity:       c.quantity,
                used_count:     usedCountMap[a.coupon_id as string] ?? 0,
              }
            })
          setCoupons(rows)
        }
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
          role:           null,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  function addLog(msg: string) {
    console.log(msg)
    setDebugLogs(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 20))
  }

  function getIOSVersion(): number {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
    return match ? parseFloat(`${match[1]}.${match[2]}`) : 0
  }

  // Vérifie la permission via l'API native (fonctionne iOS PWA)
  useEffect(() => {
    if (!('Notification' in window)) return

    const isIOS      = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const iosVersion = isIOS ? getIOSVersion() : 99

    addLog(`iOS: ${isIOS} | version: ${iosVersion} | permission: ${Notification.permission}`)

    if (isIOS && iosVersion < 16.4) {
      setIosUnsupported(true)
      return
    }
    setNotifGranted(Notification.permission === 'granted')
  }, [])

  async function handleNotifRequest() {
    try {
      const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      addLog(`Activation — iOS: ${isIOS}, standalone: ${isStandalone}`)

      const permission = await Notification.requestPermission()
      addLog(`permission: ${permission}`)

      if (permission === 'granted') {
        const OneSignal = (await import('react-onesignal')).default
        await OneSignal.User.PushSubscription.optIn()
        const sub    = OneSignal.User.PushSubscription
        const userId = OneSignal.User.onesignalId
        addLog(`optedIn: ${sub.optedIn}`)
        addLog(`id: ${sub.id ?? 'null'}`)
        addLog(`token: ${sub.token ? sub.token.substring(0, 20) + '...' : 'null'}`)
        addLog(`OneSignal User ID: ${userId ?? 'null'}`)
        console.log('[OneSignal] optedIn:', sub.optedIn)
        console.log('[OneSignal] id:', sub.id)
        console.log('[OneSignal] token:', sub.token)
        console.log('[OneSignal] User ID:', userId)
        setNotifGranted(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog(`ERREUR: ${msg}`)
      console.error('[Notif] Erreur:', err)
    }
  }

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

        <div className="flex items-center gap-2 mt-4">
          {/* Bouton modifier */}
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition active:scale-[0.95]"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            {profile?.full_name ? 'Modifier' : 'Compléter le profil'}
          </button>

          {/* Bouton Admin (visible uniquement si role === 'admin') */}
          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition active:scale-[0.95]"
              style={{ backgroundColor: '#E8622A', color: '#ffffff' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin
            </Link>
          )}
        </div>
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

        {/* Code fidélité */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Mon code fidélité</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <span
                className="text-2xl font-extrabold tracking-widest"
                style={{ color: '#E8622A', fontFamily: 'monospace' }}
              >
                {profile?.student_code ?? '—'}
              </span>
              <p className="text-xs text-gray-400 mt-1">Présente ce code aux événements BDE</p>
            </div>
            <button
              onClick={() => setQrOpen(true)}
              disabled={!profile?.student_code}
              className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl flex-shrink-0 transition active:scale-[0.96] disabled:opacity-40"
              style={{ backgroundColor: '#1D355008', border: '1px solid #1D355015' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1D3550" strokeWidth={1.8} className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              <span className="text-[10px] font-bold" style={{ color: '#1D3550' }}>QR Code</span>
            </button>
          </div>
        </div>

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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Mes coupons
          </p>

          {coupons.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">
              Aucun coupon disponible pour le moment.
            </p>
          ) : (
            <div className="space-y-2.5">
              {coupons.map(coupon => {
                const now           = new Date()
                const isUsed        = coupon.status === 'used'
                const isOutOfStock  = !isUsed && coupon.quantity !== null && coupon.used_count >= coupon.quantity
                const isLocked      = !isUsed && !isOutOfStock && new Date(coupon.available_from) > now

                if (isUsed) {
                  // État UTILISÉ — grayed, badge vert, heure d'utilisation
                  const usedTime = coupon.used_at
                    ? new Date(coupon.used_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : null
                  return (
                    <div
                      key={coupon.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      <span className="text-2xl flex-shrink-0 opacity-50">{coupon.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-gray-400">{coupon.title}</p>
                        {usedTime && (
                          <span className="text-[10px] font-medium text-gray-400 mt-0.5 block">
                            Utilisé à {usedTime}
                          </span>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                        ✓ Utilisé
                      </span>
                    </div>
                  )
                }

                if (isOutOfStock) {
                  // État STOCK ÉPUISÉ — grayed, badge rouge
                  return (
                    <div
                      key={coupon.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      <span className="text-2xl flex-shrink-0 opacity-40">{coupon.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-gray-400">{coupon.title}</p>
                        <span className="text-[10px] font-medium text-gray-400 mt-0.5 block">
                          Stock épuisé
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                        Épuisé
                      </span>
                    </div>
                  )
                }

                if (isLocked) {
                  // État VERROUILLÉ — grayed, 🔒, date de disponibilité
                  const availDate = new Date(coupon.available_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  const availTime = new Date(coupon.available_from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div
                      key={coupon.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      <span className="text-2xl flex-shrink-0 opacity-40">{coupon.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-gray-400">{coupon.title}</p>
                        <span className="text-[10px] font-medium text-gray-400 mt-0.5 block">
                          Disponible le {availDate} à {availTime}
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-base px-2 opacity-50">🔒</span>
                    </div>
                  )
                }

                // État DISPONIBLE — coloré, valable jusqu'à, bouton Utiliser
                const expiresTime = new Date(coupon.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div
                    key={coupon.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#E8622A08', border: '1px solid #E8622A25' }}
                  >
                    <span className="text-2xl flex-shrink-0">{coupon.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: '#1D3550' }}>{coupon.title}</p>
                      <span className="text-[10px] font-medium text-gray-400 mt-0.5 block">
                        Valable jusqu&apos;à {expiresTime}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveCoupon(coupon)}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-[0.96]"
                      style={{ backgroundColor: '#E8622A' }}
                    >
                      Utiliser
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        {iosUnsupported && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="text-sm font-bold" style={{ color: '#92400E' }}>📱 iOS 16.4+ requis</p>
            <p className="text-xs mt-1" style={{ color: '#B45309' }}>
              Les notifications nécessitent iOS 16.4+ et l&apos;app installée sur l&apos;écran d&apos;accueil.
            </p>
          </div>
        )}
        {!iosUnsupported && notifGranted === false && (
          <button
            onClick={handleNotifRequest}
            className="w-full rounded-2xl font-bold text-sm transition active:scale-[0.98] flex items-center justify-center gap-2 border-2"
            style={{ height: '52px', borderColor: '#E8622A', color: '#E8622A', backgroundColor: '#FFF4EE' }}
          >
            🔔 Activer les notifications
          </button>
        )}
        {!iosUnsupported && notifGranted === true && (
          <div
            className="w-full rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ height: '52px', backgroundColor: '#F0FDF4', color: '#16A34A' }}
          >
            ✅ Notifications activées
          </div>
        )}

        {/* Debug logs (temporairement toujours visible) */}
        {debugLogs.length > 0 && (
          <div className="rounded-xl p-3 space-y-0.5" style={{ backgroundColor: '#0F172A' }}>
            <p className="text-[10px] font-bold text-white/40 mb-1">DEBUG NOTIFICATIONS</p>
            {debugLogs.map((log, i) => (
              <p key={i} className="text-[10px] font-mono text-green-400 leading-tight">{log}</p>
            ))}
          </div>
        )}

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

      {/* CouponFlow plein écran */}
      {activeCoupon && (
        <CouponFlow
          assignment={activeCoupon}
          onClose={() => setActiveCoupon(null)}
        />
      )}

      {/* Modal plein écran QR Code */}
      {qrOpen && profile?.student_code && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-14 pb-4">
            <h2 className="text-lg font-extrabold" style={{ color: '#1D3550' }}>Mon QR Code</h2>
            <button
              onClick={() => setQrOpen(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#F3F4F6' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenu centré */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
            <p className="text-sm text-gray-400 text-center">
              Présente ce QR code à l&apos;entrée des événements BDE
            </p>

            <div className="p-6 rounded-3xl shadow-lg border border-gray-100 bg-white">
              <QRCodeSVG
                value={profile.student_code}
                size={220}
                fgColor="#1D3550"
                bgColor="#FFFFFF"
                level="M"
              />
            </div>

            <div className="flex flex-col items-center gap-1">
              <span
                className="text-3xl font-extrabold tracking-widest"
                style={{ color: '#E8622A', fontFamily: 'monospace' }}
              >
                {profile.student_code}
              </span>
              {profile.full_name && (
                <p className="text-sm text-gray-400">{profile.full_name}</p>
              )}
            </div>
          </div>

          {/* Bouton fermer bas */}
          <div className="px-5 pb-10">
            <button
              onClick={() => setQrOpen(false)}
              className="w-full h-13 rounded-2xl font-bold text-white transition active:scale-[0.98]"
              style={{ backgroundColor: '#1D3550', height: '52px' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
