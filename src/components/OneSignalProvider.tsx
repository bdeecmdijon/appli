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
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath:           '/OneSignalSDKWorker.js',
        promptOptions: {
          slidedown: {
            prompts: [{
              type:       'push',
              autoPrompt: true,
              text: {
                actionMessage: 'Recevoir les notifications du BDE ECM Dijon ?',
                acceptButton:  'Autoriser',
                cancelButton:  'Plus tard',
              },
            }],
          },
        },
      } as unknown as Parameters<typeof OneSignal.init>[0])

      initialized = true

      // Debug permission (API native, fonctionne iOS PWA)
      if ('Notification' in window) {
        console.log('OneSignal permission:', Notification.permission)
      }

      // Associe l'External User ID au user Supabase si déjà connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await OneSignal.login(user.id)
    }

    init().catch(console.error)

    // Synchronise login/logout avec la session Supabase
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
