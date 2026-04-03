import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { title, message, eventId } = await req.json()

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Titre et message obligatoires' }, { status: 400 })
    }

    const appId  = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    const apiKey = process.env.ONESIGNAL_REST_API_KEY

    console.log('[send-notification] appId present:', !!appId)
    console.log('[send-notification] apiKey present:', !!apiKey)
    console.log('[send-notification] apiKey prefix:', apiKey?.substring(0, 12))

    if (!appId || !apiKey) {
      console.error('[send-notification] Missing env vars')
      return NextResponse.json({ error: 'Clés OneSignal non configurées côté serveur' }, { status: 500 })
    }

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

    // URL absolue pour OneSignal (relatif non accepté)
    const origin = process.env.NEXT_PUBLIC_APP_URL
      ?? (req.headers.get('origin') || req.headers.get('x-forwarded-host') ? `https://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}` : null)

    const body: Record<string, unknown> = {
      app_id:            appId,
      included_segments: ['All'],
      headings:          { fr: title.trim(), en: title.trim() },
      contents:          { fr: message.trim(), en: message.trim() },
    }

    if (eventId && origin) {
      body.url = `${origin}/accueil/${eventId}`
    }

    console.log('[send-notification] Sending to OneSignal:', JSON.stringify(body))

    // Envoi via OneSignal
    const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const osJson = await osRes.json()
    console.log('[send-notification] OneSignal status:', osRes.status)
    console.log('[send-notification] OneSignal response:', JSON.stringify(osJson))

    if (!osRes.ok) {
      const errorMsg = Array.isArray(osJson.errors) ? osJson.errors.join(', ') : (osJson.errors ?? osJson.error ?? 'Erreur OneSignal')
      return NextResponse.json(
        { error: errorMsg, detail: osJson },
        { status: 502 },
      )
    }

    // Sauvegarde dans l'historique
    await supabase.from('notifications_history').insert({
      title:      title.trim(),
      message:    message.trim(),
      event_id:   eventId || null,
      sent_by:    user.id,
      recipients: osJson.recipients ?? 0,
    })

    return NextResponse.json({ success: true, recipients: osJson.recipients ?? 0 })
  } catch (err) {
    console.error('[send-notification] Unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
