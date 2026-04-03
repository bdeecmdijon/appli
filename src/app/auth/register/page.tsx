'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { FORMATIONS_ECM } from '@/lib/formations'

// ── Données ────────────────────────────────────────────────────────────────

const ECOLES = ['ECM', 'Autre école']

// ── Composant champ select réutilisable ────────────────────────────────────

function SelectField({
  label, name, value, onChange, options, placeholder, required = false,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: string[]
  placeholder: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20 bg-white appearance-none"
          style={{ color: value ? '#1D3550' : '#9ca3af' }}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth={2}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    phone: '',
    email: '',
    password: '',
    ecole: '',
    formation: '',
    autre_ecole: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isECM = form.ecole === 'ECM'

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value,
      // Réinitialise formation et autre_ecole si l'école change
      ...(name === 'ecole' ? { formation: '', autre_ecole: '' } : {}),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fullName   = `${form.prenom.trim()} ${form.nom.trim()}`.trim()
    const phoneClean = form.phone.replace(/[\s.]/g, '')
    if (!/^(06|07)\d{8}$/.test(phoneClean)) {
      setError('Numéro invalide. Format attendu : 06 12 34 56 78 ou 07 12 34 56 78')
      setLoading(false)
      return
    }

    // 1. Créer le compte auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Erreur lors de la création du compte.')
      setLoading(false)
      return
    }

    // 2. Forcer la session dans les cookies AVANT l'upsert
    // Sans ça, auth.uid() est null côté RLS et l'upsert est bloqué silencieusement
    if (data.session) {
      await supabase.auth.setSession({
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }

    // 3. Sauvegarder le profil complet (sans total_points géré côté DB)
    const profilePayload = {
      id:          userId,
      email:       form.email,
      full_name:   fullName,
      phone:       phoneClean       || null,
      ecole:       form.ecole       || null,
      formation:   form.formation   || null,
      autre_ecole: form.autre_ecole || null,
    }

    console.log('[Register] saving profile →', profilePayload)

    // Tentative 1 : upsert (INSERT or UPDATE selon si le trigger a déjà créé la ligne)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (upsertError) {
      console.warn('[Register] upsert failed, trying UPDATE →', {
        message: upsertError.message, code: upsertError.code,
      })
      // Tentative 2 : update direct (le trigger handle_new_user a déjà créé la ligne)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name:   fullName,
          phone:       phoneClean       || null,
          ecole:       form.ecole       || null,
          formation:   form.formation   || null,
          autre_ecole: form.autre_ecole || null,
        })
        .eq('id', userId)

      if (updateError) {
        console.error('[Register] UPDATE also failed →', {
          message: updateError.message, code: updateError.code,
          details: updateError.details, hint: updateError.hint,
        })
        // On continue quand même — le compte est créé, le profil peut être complété plus tard
      } else {
        console.log('[Register] UPDATE succeeded')
      }
    } else {
      console.log('[Register] upsert succeeded')
    }

    // TODO: Réactiver la confirmation email avant la mise en production
    router.refresh()
    router.push('/accueil')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-6 px-6">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
          <Image src="/logobde.PNG" alt="Logo BDE" width={64} height={64} className="object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-center" style={{ color: '#1D3550' }}>
          Créer mon compte
        </h1>
        <p className="text-sm text-gray-400 mt-1 text-center">
          Rejoins la communauté BDE ECM Dijon
        </p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 gap-4 pb-10">
        {error && (
          <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Prénom + Nom */}
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prénom</label>
            <input
              type="text" name="prenom" value={form.prenom} onChange={handleChange}
              placeholder="Thomas" required autoComplete="given-name"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
              style={{ color: '#1D3550' }}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nom</label>
            <input
              type="text" name="nom" value={form.nom} onChange={handleChange}
              placeholder="Dupont" required autoComplete="family-name"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
              style={{ color: '#1D3550' }}
            />
          </div>
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
          <input
            type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="prenom.nom@ecm-dijon.fr" required autoComplete="email"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        {/* Téléphone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Téléphone</label>
          <input
            type="tel" name="phone" value={form.phone} onChange={handleChange}
            placeholder="06 12 34 56 78" required autoComplete="tel"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        {/* Mot de passe */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mot de passe</label>
          <input
            type="password" name="password" value={form.password} onChange={handleChange}
            placeholder="8 caractères minimum" required minLength={8} autoComplete="new-password"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
            style={{ color: '#1D3550' }}
          />
        </div>

        {/* École */}
        <SelectField
          label="École"
          name="ecole"
          value={form.ecole}
          onChange={handleChange}
          options={ECOLES}
          placeholder="Sélectionne ton école"
          required
        />

        {/* Formation ECM — apparaît dynamiquement */}
        {isECM && (
          <div
            className="rounded-xl overflow-hidden transition-all"
            style={{ border: '1px solid #E8622A30', backgroundColor: '#E8622A08' }}
          >
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E8622A' }} />
              <p className="text-xs font-semibold" style={{ color: '#E8622A' }}>Formation ECM Dijon</p>
            </div>
            <div className="px-4 pb-4">
              <div className="relative mt-1.5">
                <select
                  name="formation"
                  value={form.formation}
                  onChange={handleChange}
                  required
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20 bg-white appearance-none"
                  style={{ color: form.formation ? '#1D3550' : '#9ca3af' }}
                >
                  <option value="" disabled>Sélectionne ta formation</option>
                  {FORMATIONS_ECM.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Nom de l'école libre — si pas ECM */}
        {form.ecole && !isECM && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nom de l'école
            </label>
            <input
              type="text"
              name="autre_ecole"
              value={form.autre_ecole}
              onChange={handleChange}
              placeholder="ex: Université de Bourgogne, Sciences Po…"
              required
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-[#E8622A] focus:ring-2 focus:ring-[#E8622A]/20"
              style={{ color: '#1D3550' }}
            />
          </div>
        )}

        {/* Submit */}
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
              Création du compte…
            </span>
          ) : (
            'Créer mon compte'
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-1">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="font-semibold" style={{ color: '#E8622A' }}>
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  )
}
