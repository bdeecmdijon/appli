import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { title, message, eventId } = await req.json()

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Titre et message obligatoires' }, { status: 400 })
    }

    const appId      = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const apiKey     = process.env.ONESIGNAL_REST_API_KEY
    const vapidPub   = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPriv  = process.env.VAPID_PRIVATE_KEY

    console.log('[send-notification] appId:', !!appId, '| apiKey:', !!apiKey, '| vapid:', !!vapidPub && !!vapidPriv)

    // Vérifie que l'appelant est admin
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL
      ?? (req.headers.get('origin') || `https://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}`)

    let oneSignalRecipients = 0
    let vapidSent           = 0
    let vapidFailed         = 0

    // ── 1. Envoi OneSignal (non-iOS) ──────────────────────────────────────

    if (appId && apiKey) {
      const body: Record<string, unknown> = {
        app_id:            appId,
        included_segments: ['All'],
        headings:          { fr: title.trim(), en: title.trim() },
        contents:          { fr: message.trim(), en: message.trim() },
      }
      if (eventId && origin) body.url = `${origin}/accueil/${eventId}`

      const osRes  = await fetch('https://onesignal.com/api/v1/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
        body:    JSON.stringify(body),
      })
      const osJson = await osRes.json()
      console.log('[send-notification] OneSignal status:', osRes.status, '| recipients:', osJson.recipients)
      if (osRes.ok) oneSignalRecipients = osJson.recipients ?? 0
      else console.error('[send-notification] OneSignal error:', JSON.stringify(osJson))
    }

    // ── 2. Envoi VAPID (iOS + tout abonné natif) ──────────────────────────

    if (vapidPub && vapidPriv) {
      webpush.setVapidDetails('mailto:contact@bde-ecm-dijon.fr', vapidPub, vapidPriv)

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')

      const payload = JSON.stringify({
        title:   title.trim(),
        body:    message.trim(),
        message: message.trim(),
        url:     eventId ? `${origin}/accueil/${eventId}` : '/',
      })

      const staleIds: string[] = []

      await Promise.allSettled(
        (subs ?? []).map(async sub => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            )
            vapidSent++
          } catch (err: unknown) {
            vapidFailed++
            const status = (err as { statusCode?: number }).statusCode
            // 404 / 410 = subscription expirée → supprimer
            if (status === 404 || status === 410) staleIds.push(sub.id)
            else console.error('[send-notification] VAPID error for', sub.endpoint.slice(0, 40), err)
          }
        })
      )

      if (staleIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', staleIds)
        console.log('[send-notification] Supprimé', staleIds.length, 'subscriptions expirées')
      }

      console.log('[send-notification] VAPID — envoyées:', vapidSent, '| échouées:', vapidFailed)
    }

    // ── 3. Historique ─────────────────────────────────────────────────────

    const totalRecipients = oneSignalRecipients + vapidSent
    await supabase.from('notifications_history').insert({
      title:      title.trim(),
      message:    message.trim(),
      event_id:   eventId || null,
      sent_by:    user.id,
      recipients: totalRecipients,
    })

    return NextResponse.json({ success: true, recipients: totalRecipients, vapidSent, oneSignalRecipients })
  } catch (err) {
    console.error('[send-notification] Unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
