'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Protège les routes /admin : redirige vers /accueil si
 * l'utilisateur n'est pas authentifié ou n'a pas le rôle 'admin'.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router     = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (data?.role !== 'admin') {
        router.replace('/accueil')
        return
      }
      setOk(true)
    }
    check()
  }, [router])

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#E8622A' }} />
      </div>
    )
  }

  return <>{children}</>
}
