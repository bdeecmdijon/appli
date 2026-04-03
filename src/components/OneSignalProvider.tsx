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
        // iOS utilise le push natif VAPID — pas besoin d'OneSignal
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return

        const OneSignal = (await import('react-onesignal')).default

        await OneSignal.init({
          appId:                       process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath:           '/OneSignalSDKWorker.js',
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (user) await OneSignal.login(user.id)
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
            await OneSignal.login(session.user.id)
          } else if (event === 'SIGNED_OUT') {
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
