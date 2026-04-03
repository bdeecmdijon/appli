'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Protège les routes /admin :
 * - Non connecté → redirige vers /admin/login
 * - Connecté mais pas admin → affiche écran "Accès refusé"
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/admin/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data?.role !== 'admin') {
        setState('denied')
        return
      }
      setState('ok')
    }
    check()
  }, [router])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#E8622A' }} />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEE2E2' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold mb-2" style={{ color: '#1D3550' }}>Accès refusé</h1>
        <p className="text-sm text-gray-500 mb-8">
          Ton compte n&apos;a pas les droits administrateur.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace('/admin/login')
          }}
          className="px-6 h-11 rounded-2xl font-bold text-white text-sm"
          style={{ backgroundColor: '#E8622A' }}
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  return <>{children}</>
}
