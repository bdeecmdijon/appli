'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase'

// ── Scanner dynamique ─────────────────────────────────────────────────────

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Navigation ────────────────────────────────────────────────────────────

const NAV = [
  {
    href: '/admin',
    label: 'Tableau de bord',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/admin/evenements',
    label: 'Événements',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/admin/etudiants',
    label: 'Étudiants',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/bds',
    label: 'BDS',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
  },
  {
    href: '/admin/partenaires',
    label: 'Partenaires',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
  },
  {
    href: '/admin/notifications',
    label: 'Notifications',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
]

// ── Scanner modal ─────────────────────────────────────────────────────────

interface StudentResult {
  id:             string
  student_code:   string
  full_name:      string | null
  formation:      string | null
  ecole:          string | null
  autre_ecole:    string | null
  points_balance: number
}

const QUICK_PTS = [10, 50, 100]

function ScannerModal({ onClose }: { onClose: () => void }) {
  type Step = 'scanning' | 'found' | 'not_found'

  const [step,      setStep]      = useState<Step>('scanning')
  const [student,   setStudent]   = useState<StudentResult | null>(null)
  const [amount,    setAmount]    = useState<number>(0)
  const [customAmt, setCustomAmt] = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [lastCode,  setLastCode]  = useState('')
  const cooldownRef = useRef(false)

  const effectiveAmount = customAmt !== '' ? Number(customAmt) : amount

  async function handleScan(code: string) {
    if (cooldownRef.current || step !== 'scanning') return
    if (!code.match(/^ECM-[A-Z0-9]{6}$/)) return
    if (code === lastCode) return

    cooldownRef.current = true
    setLastCode(code)

    const { data } = await supabase
      .from('profiles')
      .select('id, student_code, full_name, formation, ecole, autre_ecole, points_balance')
      .eq('student_code', code)
      .single()

    if (data) {
      setStudent(data)
      setStep('found')
    } else {
      setStep('not_found')
    }

    setTimeout(() => { cooldownRef.current = false }, 2000)
  }

  function resetScanner() {
    setStep('scanning')
    setStudent(null)
    setAmount(0)
    setCustomAmt('')
    setReason('')
    setSuccess(false)
    setLastCode('')
    cooldownRef.current = false
  }

  async function handleAttribuer() {
    if (!student || effectiveAmount === 0 || !reason.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const newBalance = student.points_balance + effectiveAmount

    await Promise.all([
      supabase.from('profiles').update({ points_balance: newBalance }).eq('id', student.id),
      supabase.from('points_history').insert({
        user_id:  student.id,
        amount:   effectiveAmount,
        reason:   reason.trim(),
        admin_id: user?.id ?? null,
      }),
    ])

    setStudent(prev => prev ? { ...prev, points_balance: newBalance } : prev)
    setSuccess(true)
    setSaving(false)
    setTimeout(() => { setSuccess(false); resetScanner() }, 1800)
  }

  function displayFormation(s: StudentResult) {
    if (s.ecole === 'ECM') return s.formation ?? '—'
    return s.autre_ecole ?? s.ecole ?? '—'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-14 pb-4 bg-black">
        <h2 className="text-lg font-extrabold text-white">
          {step === 'scanning' ? 'Scanner un étudiant' : step === 'found' ? 'Étudiant trouvé' : 'Code non reconnu'}
        </h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {step === 'scanning' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            <QrScanner
              onScan={(codes) => { const raw = codes?.[0]?.rawValue; if (raw) handleScan(raw) }}
              constraints={{ facingMode: 'environment' }}
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl','top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl','bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl','bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#E8622A' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 py-6 bg-black">
            <p className="text-white/60 text-sm text-center">Pointe la caméra sur le QR code de l&apos;étudiant</p>
          </div>
        </div>
      )}

      {step === 'not_found' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl">❌</div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Code non reconnu</p>
            <p className="text-white/50 text-sm mt-1">
              <span className="font-mono" style={{ color: '#E8622A' }}>{lastCode}</span>
              {' '}n&apos;est associé à aucun compte.
            </p>
          </div>
          <button onClick={resetScanner} className="mt-4 px-6 py-3 rounded-2xl font-bold text-white" style={{ backgroundColor: '#E8622A' }}>
            Rescanner
          </button>
        </div>
      )}

      {step === 'found' && student && (
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F5F5F5' }}>
          {success && (
            <div className="fixed inset-0 z-10 bg-black/60 flex items-center justify-center">
              <div className="bg-white rounded-3xl p-8 text-center mx-8 shadow-2xl">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-extrabold" style={{ color: '#1D3550' }}>Points attribués !</p>
                <p className="text-sm text-gray-400 mt-1">
                  {effectiveAmount > 0 ? '+' : ''}{effectiveAmount} pts → {student.points_balance.toLocaleString('fr-FR')} pts
                </p>
              </div>
            </div>
          )}
          <div className="px-4 py-5 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0" style={{ backgroundColor: '#E8622A' }}>
                {(student.full_name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold truncate" style={{ color: '#1D3550' }}>{student.full_name ?? 'Profil incomplet'}</p>
                <p className="text-xs text-gray-400 truncate">{displayFormation(student)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold font-mono" style={{ color: '#E8622A' }}>{student.student_code}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs font-bold" style={{ color: '#1D3550' }}>{student.points_balance.toLocaleString('fr-FR')} pts</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Attribuer des points</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUICK_PTS.map(v => (
                  <button key={v} onClick={() => { setAmount(v); setCustomAmt('') }}
                    className="h-12 rounded-xl text-sm font-bold border-2 transition active:scale-[0.97]"
                    style={{ borderColor: amount === v && customAmt === '' ? '#E8622A' : '#E5E7EB', backgroundColor: amount === v && customAmt === '' ? '#E8622A10' : 'white', color: '#16A34A' }}>
                    +{v}
                  </button>
                ))}
              </div>
              <input type="number" value={customAmt} onChange={e => { setCustomAmt(e.target.value); setAmount(0) }}
                placeholder="Montant personnalisé (ex: -25 ou 200)"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition mb-3"
                style={{ color: '#1D3550' }} />
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Raison (obligatoire)"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition mb-3"
                style={{ color: '#1D3550' }} />
              {effectiveAmount !== 0 && (
                <div className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-3"
                  style={{ backgroundColor: effectiveAmount > 0 ? '#DCFCE7' : '#FEE2E2' }}>
                  <span className="text-xs font-medium" style={{ color: effectiveAmount > 0 ? '#16A34A' : '#DC2626' }}>Nouveau solde</span>
                  <span className="text-sm font-bold" style={{ color: effectiveAmount > 0 ? '#16A34A' : '#DC2626' }}>
                    {(student.points_balance + effectiveAmount).toLocaleString('fr-FR')} pts
                  </span>
                </div>
              )}
              <button onClick={handleAttribuer} disabled={saving || effectiveAmount === 0 || !reason.trim()}
                className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#E8622A' }}>
                {saving ? 'Enregistrement…' : 'Attribuer les points'}
              </button>
            </div>

            <button onClick={resetScanner} className="w-full h-11 rounded-2xl font-semibold text-sm border border-gray-200 bg-white" style={{ color: '#1D3550' }}>
              ← Scanner un autre étudiant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sidebar content ───────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  adminName,
  onNavClick,
}: {
  pathname: string
  adminName: string
  onNavClick?: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo + identité */}
      <div className="px-5 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Image src="/logobde.PNG" alt="BDE" width={36} height={36} className="rounded-xl object-contain bg-gray-50" />
          <div>
            <p className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">BDE ECM Dijon</p>
            <p className="text-sm font-bold" style={{ color: '#1D3550' }}>Espace Admin</p>
          </div>
        </div>
        {adminName && (
          <div className="mt-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#E8622A' }}>
              {adminName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <p className="text-xs font-semibold text-gray-700 truncate">{adminName}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
              style={{
                backgroundColor: active ? '#E8622A' : 'transparent',
                color:           active ? '#ffffff' : '#6B7280',
                fontWeight:      active ? 700 : 500,
              }}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Lien retour app */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link
          href="/accueil"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          App utilisateur
        </Link>
      </div>
    </div>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const [adminName,   setAdminName]   = useState('')
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.full_name) setAdminName(data.full_name) })
    })
  }, [])

  // Ferme le drawer quand la route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  return (
    <AdminGuard>
      <div className="min-h-screen lg:flex" style={{ backgroundColor: '#F3F4F6' }}>

        {/* ── Sidebar desktop ── */}
        <aside className="hidden lg:flex lg:flex-col w-60 fixed top-0 left-0 bottom-0 z-20 shadow-sm border-r border-gray-200">
          <SidebarContent pathname={pathname} adminName={adminName} />
        </aside>

        {/* ── Header mobile ── */}
        <header
          className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 flex items-center justify-between px-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#F3F4F6' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <Image src="/logobde.PNG" alt="BDE" width={26} height={26} className="rounded-lg object-contain" />
            <span className="text-sm font-bold" style={{ color: '#1D3550' }}>Admin</span>
          </div>

          {/* Spacer */}
          <div className="w-9" />
        </header>

        {/* ── Drawer mobile ── */}
        {drawerOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 shadow-2xl flex flex-col">
              <div className="flex justify-end border-b border-gray-100 bg-white"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '0.75rem', marginTop: 'env(safe-area-inset-top, 0px)' }}
              >
                <button onClick={() => setDrawerOpen(false)} className="mt-2 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent pathname={pathname} adminName={adminName} onNavClick={() => setDrawerOpen(false)} />
              </div>
            </aside>
          </>
        )}

        {/* ── Contenu principal ── */}
        <main className="flex-1 lg:ml-60">
          {/* Spacer mobile uniquement */}
          <div
            className="lg:hidden"
            style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
          />
          {children}
        </main>

        {/* ── FAB Scanner ── */}
        {!scannerOpen && (
          <button
            onClick={() => setScannerOpen(true)}
            className="fixed bottom-6 right-5 w-14 h-14 rounded-full shadow-xl z-30 flex items-center justify-center transition active:scale-[0.93]"
            style={{ backgroundColor: '#E8622A' }}
            aria-label="Scanner QR code étudiant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </button>
        )}

        {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} />}
      </div>
    </AdminGuard>
  )
}
