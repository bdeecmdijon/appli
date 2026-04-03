import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { subscription, deviceType } = await req.json()

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id:     user.id,
      endpoint:    subscription.endpoint,
      p256dh:      subscription.keys.p256dh,
      auth:        subscription.keys.auth,
      device_type: deviceType ?? 'unknown',
    }, { onConflict: 'user_id,endpoint' })

    if (error) {
      console.error('[push/subscribe]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[push/subscribe] Subscription enregistrée pour', user.id, '-', deviceType)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
