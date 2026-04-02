'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

// ── Scanner importé dynamiquement (browser only) ──────────────────────────

const QrScanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => ({ default: m.Scanner })),
  { ssr: false }
)

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Composant Scanner Modal ────────────────────────────────────────────────

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
    if (!student || effectiveAmount === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const newBalance = student.points_balance + effectiveAmount

    await Promise.all([
      supabase.from('profiles').update({ points_balance: newBalance }).eq('id', student.id),
      supabase.from('points_history').insert({
        user_id:  student.id,
        amount:   effectiveAmount,
        reason:   reason.trim() || null,
        admin_id: user?.id ?? null,
      }),
    ])

    setStudent(prev => prev ? { ...prev, points_balance: newBalance } : prev)
    setSuccess(true)
    setSaving(false)
    setTimeout(() => {
      setSuccess(false)
      resetScanner()
    }, 1800)
  }

  function displayFormation(s: StudentResult) {
    if (s.ecole === 'ECM') return s.formation ?? '—'
    return s.autre_ecole ?? s.ecole ?? '—'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 bg-black">
        <h2 className="text-lg font-extrabold text-white">
          {step === 'scanning' ? 'Scanner un étudiant' : step === 'found' ? 'Étudiant trouvé' : 'Code non reconnu'}
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Étape scan ── */}
      {step === 'scanning' && (
        <div className="flex-1 flex flex-col">
          {/* Scanner caméra */}
          <div className="flex-1 relative overflow-hidden">
            <QrScanner
              onScan={(codes) => {
                const raw = codes?.[0]?.rawValue
                if (raw) handleScan(raw)
              }}
              constraints={{ facingMode: 'environment' }}
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
            />
            {/* Overlay viseur */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                {/* Coins du viseur */}
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
                ].map((cls, i) => (
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

      {/* ── Étape non trouvé ── */}
      {step === 'not_found' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl">
            ❌
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">Code non reconnu</p>
            <p className="text-white/50 text-sm mt-1">
              <span className="font-mono" style={{ color: '#E8622A' }}>{lastCode}</span>
              {' '}n&apos;est associé à aucun compte.
            </p>
          </div>
          <button
            onClick={resetScanner}
            className="mt-4 px-6 py-3 rounded-2xl font-bold text-white"
            style={{ backgroundColor: '#E8622A' }}
          >
            Rescanner
          </button>
        </div>
      )}

      {/* ── Étape trouvé ── */}
      {step === 'found' && student && (
        <div className="flex-1 overflow-y-auto bg-[#F5F5F5]">

          {/* Succès overlay */}
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

            {/* Carte étudiant */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0"
                style={{ backgroundColor: '#E8622A' }}
              >
                {(student.full_name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold truncate" style={{ color: '#1D3550' }}>
                  {student.full_name ?? 'Profil incomplet'}
                </p>
                <p className="text-xs text-gray-400 truncate">{displayFormation(student)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs font-bold"
                    style={{ color: '#E8622A', fontFamily: 'monospace' }}
                  >
                    {student.student_code}
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs font-bold" style={{ color: '#1D3550' }}>
                    {student.points_balance.toLocaleString('fr-FR')} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Attribution rapide */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Attribuer des points
              </p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUICK_PTS.map(v => (
                  <button
                    key={v}
                    onClick={() => { setAmount(v); setCustomAmt('') }}
                    className="h-12 rounded-xl text-sm font-bold border-2 transition active:scale-[0.97]"
                    style={{
                      borderColor: amount === v && customAmt === '' ? '#E8622A' : '#E5E7EB',
                      backgroundColor: amount === v && customAmt === '' ? '#E8622A10' : 'white',
                      color: '#16A34A',
                    }}
                  >
                    +{v}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); setAmount(0) }}
                placeholder="Montant personnalisé (ex: -25 ou 200)"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition mb-3"
                style={{ color: '#1D3550' }}
              />

              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Raison (ex: Participation soirée…)"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E8622A] transition mb-3"
                style={{ color: '#1D3550' }}
              />

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
                  </span>
                </div>
              )}

              <button
                onClick={handleAttribuer}
                disabled={saving || effectiveAmount === 0}
                className="w-full h-12 rounded-2xl font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: '#E8622A' }}
              >
                {saving ? 'Enregistrement…' : 'Attribuer les points'}
              </button>
            </div>

            <button
              onClick={resetScanner}
              className="w-full h-11 rounded-2xl font-semibold text-sm border border-gray-200 bg-white"
              style={{ color: '#1D3550' }}
            >
              ← Scanner un autre étudiant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [scannerOpen, setScannerOpen] = useState(false)

  // Désactiver le scroll body quand le scanner est ouvert
  useEffect(() => {
    document.body.style.overflow = scannerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [scannerOpen])

  return (
    <>
      {children}

      {/* FAB Scanner */}
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

      {/* Scanner Modal */}
      {scannerOpen && <ScannerModal onClose={() => setScannerOpen(false)} />}
    </>
  )
}
