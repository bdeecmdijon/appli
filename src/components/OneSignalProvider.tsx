'use client'

import OneSignal from 'react-onesignal'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function OneSignalProvider() {
  useEffect(() => {
    let initialized = false

    async function init() {
      await OneSignal.init({
        appId:                       process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
        allowLocalhostAsSecureOrigin: true,   // dev local
      })
      initialized = true

      // Demande la permission push (slide-down natif OneSignal)
      OneSignal.Slidedown.promptPush()

      // Associe l'External User ID au user Supabase si déjà connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await OneSignal.login(user.id)
    }

    init().catch(console.error)

    // Écoute les changements de session pour login/logout en temps réel
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized) return
        if (event === 'SIGNED_IN' && session?.user) {
          await OneSignal.login(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          await OneSignal.logout()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return null
}
