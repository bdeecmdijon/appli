'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Guard contre le double-init (StrictMode / HMR)
let oneSignalInitialized = false

export default function OneSignalProvider() {
  useEffect(() => {
    async function init() {
      if (oneSignalInitialized) return
      oneSignalInitialized = true

      try {
        const OneSignal = (await import('react-onesignal')).default

        await OneSignal.init({
          appId:                       process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath:           '/OneSignalSDKWorker.js',
        })

        console.log('[OneSignal] initialisé ✓')

        // Permission via API native (seule fiable sur iOS PWA)
        const permission = 'Notification' in window ? Notification.permission : 'unsupported'
        console.log('[OneSignal] permission navigateur:', permission)

        // Statut abonnement OneSignal
        const optedIn = OneSignal.User.PushSubscription.optedIn
        console.log('[OneSignal] optedIn:', optedIn)

        // Associe l'user Supabase si déjà connecté
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('[OneSignal] login avec userId:', user.id)
          await OneSignal.login(user.id)
        }
      } catch (err) {
        console.error('[OneSignal] Erreur init:', err)
      }
    }

    init()

    // Synchronise login/logout avec la session Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          const OneSignal = (await import('react-onesignal')).default
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('[OneSignal] SIGNED_IN → login', session.user.id)
            await OneSignal.login(session.user.id)
          } else if (event === 'SIGNED_OUT') {
            console.log('[OneSignal] SIGNED_OUT → logout')
            await OneSignal.logout()
          }
        } catch (err) {
          console.error('[OneSignal] Erreur auth sync:', err)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return null
}
