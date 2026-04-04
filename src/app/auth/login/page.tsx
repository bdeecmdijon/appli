'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('Email ou mot de passe incorrect.')
        setLoading(false)
        return
      }

      // Succès — on redirige sans vérifier data.session
      // (peut être null avec certaines configs Supabase mais le user est bien auth)
      console.log('LOGIN SUCCESS, redirecting now...')
      window.location.href = '/accueil'
    } catch (err) {
      setError('Une erreur est survenue. Réessaie.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
          <Image src="/logobde.PNG" alt="Logo BDE" width={80} height={80} className="object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-center" style={{ color: '#1D3550' }}>
          Bienvenue sur l'application du BDE ECM Dijon
        </h1>
        <p className="text-sm text-gray-400 mt-1 text-center">
          Connecte-toi pour découvrir notre application
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
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ton@email.com"
            required
            autoComplete="email"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-13 mt-2 rounded-xl font-bold text-white text-base transition active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: '#E8622A', height: '52px' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Connexion…
            </span>
          ) : (
            'Se connecter'
          )}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">ou</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <p className="text-center text-sm text-gray-500">
          Pas encore de compte ?{' '}
          <Link
            href="/auth/register"
            className="font-semibold"
            style={{ color: '#E8622A' }}
          >
            S'inscrire
          </Link>
        </p>
      </form>

      <div className="pb-10 pt-6 px-6 text-center">
        <p className="text-xs text-gray-300">BDE ECM Dijon © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
