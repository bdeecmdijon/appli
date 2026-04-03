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

    if (!appId || !apiKey) {
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

    // Envoi via OneSignal
    const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id:            appId,
        included_segments: ['All'],
        headings:  { fr: title.trim() },
        contents:  { fr: message.trim() },
        ...(eventId ? { url: `/accueil/${eventId}` } : {}),
      }),
    })

    const osJson = await osRes.json()
    if (!osRes.ok) {
      return NextResponse.json(
        { error: osJson.errors?.[0] ?? 'Erreur OneSignal' },
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
    console.error('[send-notification]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
