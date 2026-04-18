'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status,    setStatus]    = useState<Status>('loading')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    // Supabase détecte le token dans le hash et émet PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // Timeout de sécurité : si aucun événement en 3 s, le token est absent/invalide
    const timer = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'invalid' : prev)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      console.error('[ResetPassword]', error.message)
      setError('Une erreur est survenue. Le lien est peut-être expiré.')
      return
    }

    // Déconnexion propre puis redirection avec message
    await supabase.auth.signOut()
    router.push('/auth/login?reset=success')
  }

  // ── Écran de chargement ───────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24" style={{ color: '#E8622A' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      </div>
    )
  }

  // ── Token invalide ou expiré ──────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-extrabold mb-3" style={{ color: '#1D3550' }}>
          Lien invalide ou expiré
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-xs">
          Ce lien de réinitialisation n'est plus valide. Fais une nouvelle demande.
        </p>
        <Link
          href="/auth/forgot-password"
          className="w-full max-w-xs h-12 rounded-2xl font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: '#E8622A' }}
        >
          Nouvelle demande
        </Link>
        <Link href="/auth/login" className="mt-4 text-sm font-semibold" style={{ color: '#1D3550' }}>
          Retour à la connexion
        </Link>
      </div>
    )
  }

  // ── Formulaire de réinitialisation ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
          <Image src="/logobde.PNG" alt="Logo BDE" width={80} height={80} className="object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-center" style={{ color: '#1D3550' }}>
          Nouveau mot de passe
        </h1>
        <p className="text-sm text-gray-400 mt-1 text-center">
          Choisis un mot de passe sécurisé (6 caractères min.)
        </p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 gap-4">
        {error && (
          <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 rounded-xl font-bold text-white text-base transition active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: '#E8622A', height: '52px' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Mise à jour…
            </span>
          ) : (
            'Mettre à jour le mot de passe'
          )}
        </button>
      </form>

      <div className="pb-10 pt-6 px-6 text-center">
        <p className="text-xs text-gray-300">BDE ECM Dijon © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
