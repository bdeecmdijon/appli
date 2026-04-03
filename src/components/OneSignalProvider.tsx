'use client'

import Script from 'next/script'
import { useEffect } from 'react'

declare global {
  interface Window {
    OneSignalDeferred?: ((oneSignal: OneSignal) => Promise<void> | void)[]
  }
}

interface OneSignal {
  init: (config: {
    appId: string
    serviceWorkerParam?: { scope: string }
    serviceWorkerPath?: string
    notifyButton?: { enable: boolean }
  }) => Promise<void>
}

export default function OneSignalProvider() {
  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
        notifyButton: { enable: false },
      })
    })
  }, [])

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  )
}
