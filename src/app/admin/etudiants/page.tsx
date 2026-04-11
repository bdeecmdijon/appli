'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Types ──────────────────────────────────────────────────────────────────

interface Student {
  id:             string
  student_code:   string | null
  full_name:      string | null
  email:          string | null
  phone:          string | null
  formation:      string | null
  ecole:          string | null
  autre_ecole:    string | null
  points_balance: number
  created_at:     string
  is_bde_member:  boolean
}

interface PointsEntry {
  id:         string
  amount:     number
  reason:     string | null
  created_at: string
}

type SortCol = 'student_code' | 'full_name' | 'formation' | 'points_balance'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20
const QUICK_AMOUNTS = [10, 50, 100, -10, -50, -100]

// ── Helpers ────────────────────────────────────────────────────────────────

function displayFormation(s: Student) {
  if (s.ecole === 'ECM') return s.formation ?? '—'
  return s.autre_ecole ?? s.ecole ?? '—'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Composant Modal Étudiant ───────────────────────────────────────────────

function StudentModal({
  student,
  onClose,
  onPointsUpdated,
}: {
  student: Student
  onClose: () => void
  onPointsUpdated: (id: string, newBalance: number) => void
}) {
  const [history,     setHistory]     = useState<PointsEntry[]>([])
  const [histLoading, setHistLoading] = useState(true)
  const [amount,      setAmount]      = useState<number>(0)
  const [customAmt,   setCustomAmt]   = useState('')
  const [reason,      setReason]      = useState('')
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [isMember,    setIsMember]    = useState(student.is_bde_member ?? false)
  const [togglingMember, setTogglingMember] = useState(false)

  const effectiveAmount = customAmt !== '' ? Number(customAmt) : amount

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('points_history')
        .select('id, amount, reason, created_at')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setHistory(data ?? [])
      setHistLoading(false)
    }
    loadHistory()
  }, [student.id])

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSave() {
    if (!effectiveAmount || effectiveAmount === 0) return
    if (!reason.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const newBalance = (student.points_balance ?? 0) + effectiveAmount

    const [updateResult, histResult] = await Promise.all([
      supabase.from('profiles').update({ points_balance: newBalance }).eq('id', student.id),
      supabase.from('points_history').insert({
        user_id:  student.id,
        amount:   effectiveAmount,
        reason:   reason.trim() || null,
        admin_id: user?.id ?? null,
      }),
    ])

    if (updateResult.error) {
      flash(`Erreur : ${updateResult.error.message}`)
      setSaving(false)
      return
    }
    if (histResult.error) {
      console.warn('points_history insert error:', histResult.error.message)
    }

    flash(`${effectiveAmount > 0 ? '+' : ''}${effectiveAmount} pts appliqués`)
    onPointsUpdated(student.id, newBalance)

    // Refresh history
    const { data: newHist } = await supabase
      .from('points_history')
      .select('id, amount, reason, created_at')
      .eq('user_id', student.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setHistory(newHist ?? [])

    setAmount(0)
    setCustomAmt('')
    setReason('')
    setSaving(false)
  }

  async function handleToggleMember() {
    setTogglingMember(true)
    const newVal = !isMember
    const { error } = await supabase
      .from('profiles')
      .update({ is_bde_member: newVal })
      .eq('id', student.id)
    if (error) {
      flash(`Erreur : ${error.message}`)
    } else {
      setIsMember(newVal)
      flash(newVal ? '⭐ Marqué comme adhérent BDE' : 'Statut adhérent retiré')
    }
    setTogglingMember(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pt-2 pb-10 space-y-5">
          {/* Toast */}
          {toast && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white text-center"
              style={{ backgroundColor: '#1D3550' }}
            >
              {toast}
            </div>
          )}

          {/* En-tête étudiant */}
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0"
              style={{ backgroundColor: '#E8622A' }}
            >
              {(student.full_name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold truncate" style={{ color: '#1D3550' }}>
                {student.full_name ?? 'Profil incomplet'}
              </h2>
              <p className="text-xs text-gray-400 truncate">{student.email ?? '—'}</p>
              {student.student_code && (
                <span
                  className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ backgroundColor: '#E8622A' + '15', color: '#E8622A', fontFamily: 'monospace' }}
                >
                  {student.student_code}
                </span>
              )}
            </div>
          </div>

          {/* Infos */}
          <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {[
              { label: 'Téléphone',    value: student.phone      ?? '—' },
              { label: 'Formation',    value: displayFormation(student) },
              { label: 'École',        value: student.ecole      ?? '—' },
              { label: 'Inscription',  value: formatDate(student.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-400 font-medium">{label}</span>
                <span className="text-sm font-semibold text-right truncate max-w-[180px]" style={{ color: '#1D3550' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Solde de points */}
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ backgroundColor: '#1D3550' + '08', border: '1px solid ' + '#1D3550' + '15' }}
          >
            <span className="text-sm font-semibold text-gray-500">Solde actuel</span>
            <span className="text-2xl font-extrabold" style={{ color: '#E8622A' }}>
              {student.points_balance.toLocaleString('fr-FR')} pts
            </span>
          </div>

          {/* Statut adhérent BDE */}
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ backgroundColor: isMember ? '#FFF7ED' : '#F9FAFB', border: `1px solid ${isMember ? '#FED7AA' : '#E5E7EB'}` }}
          >
            <div>
              <p className="text-sm font-bold" style={{ color: '#1D3550' }}>
                ⭐ Adhérent BDE
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isMember ? 'Badge visible sur le profil étudiant' : 'Non adhérent'}
              </p>
            </div>
            <button
              onClick={handleToggleMember}
              disabled={togglingMember}
              className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
              style={{ backgroundColor: isMember ? '#E8622A' : '#D1D5DB' }}
            >
              <span
                className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: isMember ? 'translateX(22px)' : 'translateX(3px)' }}
              />
            </button>
          </div>

          {/* Attribution de points */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Attribuer / retirer des points
            </p>

            {/* Montants rapides */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_AMOUNTS.map(v => (
                <button
                  key={v}
                  onClick={() => { setAmount(v); setCustomAmt('') }}
                  className="h-11 rounded-xl text-sm font-bold border-2 transition active:scale-[0.97]"
                  style={{
                    borderColor: amount === v && customAmt === '' ? '#E8622A' : '#E5E7EB',
                    backgroundColor: amount === v && customAmt === '' ? '#E8622A' + '10' : 'white',
                    color: v > 0 ? '#16A34A' : '#DC2626',
                  }}
                >
                  {v > 0 ? `+${v}` : v}
                </button>
              ))}
            </div>

            {/* Montant personnalisé */}
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setAmount(0) }}
                placeholder="Montant personnalisé (ex: -25 ou +200)"
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition"
                style={{ color: '#1D3550' }}
              />
            </div>

            {/* Raison */}
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Raison (obligatoire)"
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition mb-3"
              style={{ color: '#1D3550' }}
            />

            {/* Aperçu + bouton */}
            {effectiveAmount !== 0 && (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-3"
                style={{ backgroundColor: effectiveAmount > 0 ? '#DCFCE7' : '#FEE2E2' }}
              >
                <span className="text-xs font-medium" style={{ color: effectiveAmount > 0 ? '#16A34A' : '#DC2626' }}>
                  Nouveau solde
                </span>
                <span className="text-sm font-bold" style={{ color: effectiveAmount > 0 ? '#16A34A' : '#DC2626' }}>
                  {(student.points_balance + effectiveAmount).toLocaleString('fr-FR')} pts
                  ({effectiveAmount > 0 ? '+' : ''}{effectiveAmount})
                </span>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || effectiveAmount === 0 || !reason.trim()}
              className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: '#E8622A' }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          {/* Historique */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Historique des attributions
            </p>
            {histLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune attribution enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {history.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ backgroundColor: entry.amount > 0 ? '#F0FDF4' : '#FFF1F2', border: '1px solid ' + (entry.amount > 0 ? '#BBF7D0' : '#FECDD3') }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#1D3550' }}>
                        {entry.reason ?? '—'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(entry.created_at)}</p>
                    </div>
                    <span
                      className="text-sm font-extrabold ml-3 flex-shrink-0"
                      style={{ color: entry.amount > 0 ? '#16A34A' : '#DC2626' }}
                    >
                      {entry.amount > 0 ? '+' : ''}{entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Composant Saisie manuelle ──────────────────────────────────────────────

function ManualCodeModal({
  onClose,
  onStudentFound,
}: {
  onClose: () => void
  onStudentFound: (s: Student) => void
}) {
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError(null)

    const { data } = await supabase
      .from('profiles')
      .select('id, student_code, full_name, email, phone, formation, ecole, autre_ecole, points_balance, created_at, is_bde_member')
      .eq('student_code', trimmed)
      .single()

    if (data) {
      onClose()
      onStudentFound(data as Student)
    } else {
      setError(`Aucun étudiant trouvé pour le code « ${trimmed} »`)
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-6 lg:inset-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold" style={{ color: '#1D3550' }}>Saisir un code étudiant</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(null) }}
            placeholder="ECM-XXXXXX"
            autoFocus
            autoCapitalize="characters"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-base font-bold outline-none focus:border-[#E8622A] transition"
            style={{ color: '#E8622A', fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />

          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#E8622A' }}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Recherche…</>
            ) : (
              'Rechercher'
            )}
          </button>
        </form>
      </div>
    </>
  )
}

// ── Composant Scanner QR ───────────────────────────────────────────────────

function QrScanModal({
  onClose,
  onStudentFound,
}: {
  onClose: () => void
  onStudentFound: (s: Student) => void
}) {
  const [status,   setStatus]   = useState<'scanning' | 'loading' | 'not_found'>('scanning')
  const [lastCode, setLastCode] = useState('')
  const cooldownRef = useRef(false)

  async function handleScan(code: string) {
    if (cooldownRef.current || status !== 'scanning') return
    if (!code.match(/^ECM-[A-Z0-9]{5,8}$/)) return
    if (code === lastCode) return

    cooldownRef.current = true
    setLastCode(code)
    setStatus('loading')

    const { data } = await supabase
      .from('profiles')
      .select('id, student_code, full_name, email, phone, formation, ecole, autre_ecole, points_balance, created_at, is_bde_member')
      .eq('student_code', code)
      .single()

    if (data) {
      onClose()
      onStudentFound(data as Student)
    } else {
      setStatus('not_found')
      setTimeout(() => {
        setStatus('scanning')
        setLastCode('')
        cooldownRef.current = false
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-14 pb-4 bg-black">
        <h2 className="text-lg font-extrabold text-white">Scanner un étudiant</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          {status === 'scanning' && (
            <QrScanner
              onScan={(codes) => { const raw = codes?.[0]?.rawValue; if (raw) handleScan(raw) }}
              constraints={{ facingMode: 'environment' }}
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
            />
          )}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {status === 'not_found' && (
            <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl">❌</div>
              <p className="text-white font-bold">Code non reconnu</p>
              <p className="text-white/50 text-sm font-mono" style={{ color: '#E8622A' }}>{lastCode}</p>
            </div>
          )}
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl','top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl','bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl','bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#E8622A' }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-6 bg-black">
          <p className="text-white/60 text-sm text-center">Pointe la caméra sur le QR code de l&apos;étudiant</p>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EtudiantsPage() {
  const [students,     setStudents]     = useState<Student[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(0)
  const [sortCol,      setSortCol]      = useState<SortCol>('full_name')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [selected,     setSelected]     = useState<Student | null>(null)
  const [scannerOpen,  setScannerOpen]  = useState(false)
  const [codeModalOpen, setCodeModalOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────

  async function fetchStudents(q: string, pg: number, col: SortCol, dir: SortDir) {
    setLoading(true)

    let query = supabase
      .from('profiles')
      .select('id, student_code, full_name, email, phone, formation, ecole, autre_ecole, points_balance, created_at, is_bde_member', { count: 'exact' })
      .order(col, { ascending: dir === 'asc' })
      .range(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE - 1)

    if (q.trim()) {
      const like = `%${q.trim()}%`
      query = query.or(`student_code.ilike.${like},full_name.ilike.${like},email.ilike.${like}`)
    }

    const { data, count, error } = await query

    if (!error) {
      setStudents(data ?? [])
      setTotal(count ?? 0)
    } else {
      console.error('fetchStudents error:', error.message)
    }
    setLoading(false)
  }

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      fetchStudents(search, 0, sortCol, sortDir)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Refetch on page/sort change
  useEffect(() => {
    fetchStudents(search, page, sortCol, sortDir)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(0)
  }

  function handlePointsUpdated(id: string, newBalance: number) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, points_balance: newBalance } : s))
    setSelected(prev => prev && prev.id === id ? { ...prev, points_balance: newBalance } : prev)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1" style={{ color: '#E8622A' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-5 pt-14 pb-5"
        style={{ background: 'linear-gradient(160deg, #1D3550 0%, #2E5A8A 100%)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/50 font-medium">Administration</p>
            <h1 className="text-2xl font-extrabold text-white mt-0.5">Étudiants</h1>
            <p className="text-sm text-white/40 mt-0.5">{total} étudiant{total !== 1 ? 's' : ''} au total</p>
          </div>
          <div className="flex gap-2 mt-1">
            {/* Bouton saisie manuelle */}
            <button
              onClick={() => setCodeModalOpen(true)}
              className="h-11 px-3 rounded-2xl flex items-center gap-1.5 flex-shrink-0 transition active:scale-[0.93] text-xs font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
              aria-label="Saisir un code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
              Code
            </button>
            {/* Bouton scanner */}
            <button
              onClick={() => setScannerOpen(true)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition active:scale-[0.93]"
              style={{ backgroundColor: '#E8622A' }}
              aria-label="Scanner QR code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou code (ECM-XXXXX)…"
            className="w-full h-11 pl-10 pr-4 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          />
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {/* Tableau */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* En-têtes */}
          <div
            className="grid text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 border-b border-gray-100"
            style={{ gridTemplateColumns: '110px 1fr 80px 60px 44px' }}
          >
            <button onClick={() => handleSort('student_code')} className="text-left hover:text-gray-600 transition">
              Code <SortIcon col="student_code" />
            </button>
            <button onClick={() => handleSort('full_name')} className="text-left hover:text-gray-600 transition">
              Nom <SortIcon col="full_name" />
            </button>
            <button onClick={() => handleSort('formation')} className="text-left hover:text-gray-600 transition">
              Formation <SortIcon col="formation" />
            </button>
            <button onClick={() => handleSort('points_balance')} className="text-right hover:text-gray-600 transition">
              Pts <SortIcon col="points_balance" />
            </button>
            <div />
          </div>

          {/* Lignes */}
          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-4 py-3.5 animate-pulse">
                  <div className="h-4 w-20 bg-gray-100 rounded-full" />
                  <div className="flex-1 h-4 bg-gray-100 rounded-full" />
                  <div className="h-4 w-16 bg-gray-100 rounded-full" />
                  <div className="h-4 w-10 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {search ? 'Aucun résultat.' : 'Aucun étudiant inscrit.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full grid items-center px-4 py-3.5 text-left hover:bg-gray-50 transition active:bg-gray-100"
                  style={{ gridTemplateColumns: '110px 1fr 80px 60px 44px' }}
                >
                  <span
                    className="text-xs font-bold truncate"
                    style={{ color: '#E8622A', fontFamily: 'monospace' }}
                  >
                    {s.student_code ?? '—'}
                  </span>
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1D3550' }}>
                      {s.full_name ?? <em className="text-gray-400 font-normal not-italic">Incomplet</em>}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{s.email ?? '—'}</p>
                  </div>
                  <span className="text-xs text-gray-500 truncate">{displayFormation(s)}</span>
                  <span className="text-sm font-bold text-right" style={{ color: '#1D3550' }}>
                    {s.points_balance.toLocaleString('fr-FR')}
                  </span>
                  <div className="flex justify-end">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 disabled:opacity-40 active:scale-[0.97] transition bg-white"
              style={{ color: '#1D3550' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Précédent
            </button>
            <span className="text-sm text-gray-400">
              Page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 disabled:opacity-40 active:scale-[0.97] transition bg-white"
              style={{ color: '#1D3550' }}
            >
              Suivant
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Modal étudiant */}
      {selected && (
        <StudentModal
          student={selected}
          onClose={() => setSelected(null)}
          onPointsUpdated={handlePointsUpdated}
        />
      )}

      {/* Scanner QR */}
      {scannerOpen && (
        <QrScanModal
          onClose={() => setScannerOpen(false)}
          onStudentFound={(s) => { setScannerOpen(false); setSelected(s) }}
        />
      )}

      {/* Saisie manuelle code */}
      {codeModalOpen && (
        <ManualCodeModal
          onClose={() => setCodeModalOpen(false)}
          onStudentFound={(s) => { setCodeModalOpen(false); setSelected(s) }}
        />
      )}
    </div>
  )
}
