'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)

    if (error) {
      console.error('[ForgotPassword]', error.message)
      // On affiche toujours le message générique pour ne pas révéler
      // si un email existe ou non dans la base
    }

    // Message identique que l'email existe ou non (sécurité)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="text-6xl mb-6">📬</div>
        <h1 className="text-2xl font-extrabold mb-3" style={{ color: '#1D3550' }}>
          Vérifie ta boîte mail
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-xs">
          Si un compte existe avec cet email, tu recevras un lien de réinitialisation.
        </p>
        <Link
          href="/auth/login"
          className="w-full max-w-xs h-12 rounded-2xl font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: '#E8622A' }}
        >
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8 px-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
          <Image src="/logobde.PNG" alt="Logo BDE" width={80} height={80} className="object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-center" style={{ color: '#1D3550' }}>
          Mot de passe oublié ?
        </h1>
        <p className="text-sm text-gray-400 mt-1 text-center">
          Saisis ton email pour recevoir un lien de réinitialisation
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
              Envoi…
            </span>
          ) : (
            'Envoyer le lien de réinitialisation'
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-2">
          <Link href="/auth/login" className="font-semibold" style={{ color: '#E8622A' }}>
            ← Retour à la connexion
          </Link>
        </p>
      </form>

      <div className="pb-10 pt-6 px-6 text-center">
        <p className="text-xs text-gray-300">BDE ECM Dijon © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
