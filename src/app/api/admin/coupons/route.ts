import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { emoji, title, description, available_from, expires_at, target, recipient_ids } = body

    if (!title?.trim() || !available_from || !expires_at) {
      return NextResponse.json({ error: 'Champs obligatoires : title, available_from, expires_at' }, { status: 400 })
    }

    if (new Date(expires_at) <= new Date(available_from)) {
      return NextResponse.json({ error: 'La date de fin doit être après la date de début' }, { status: 400 })
    }

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

    // 1. Créer le coupon
    const { data: coupon, error: couponErr } = await supabase
      .from('coupons')
      .insert({
        emoji:          emoji?.trim() || '🎟️',
        title:          title.trim(),
        description:    description?.trim() || null,
        available_from,
        expires_at,
        target:         target ?? 'all',
        created_by:     user.id,
      })
      .select('id')
      .single()

    if (couponErr || !coupon) {
      console.error('[POST /api/admin/coupons] insert error:', couponErr)
      return NextResponse.json({ error: couponErr?.message ?? 'Erreur création' }, { status: 500 })
    }

    // 2. Déterminer les destinataires
    let recipientIds: string[] = recipient_ids ?? []
    if (target === 'all') {
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id')
        .neq('role', 'admin')
      recipientIds = (allUsers ?? []).map((u: { id: string }) => u.id)
    }

    // 3. Créer les assignments
    if (recipientIds.length > 0) {
      const { error: asgErr } = await supabase
        .from('coupon_assignments')
        .insert(recipientIds.map(uid => ({ coupon_id: coupon.id, user_id: uid })))

      if (asgErr) {
        console.error('[POST /api/admin/coupons] assignments error:', asgErr)
        return NextResponse.json({ error: asgErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success:           true,
      coupon_id:         coupon.id,
      assignments_count: recipientIds.length,
    })
  } catch (err) {
    console.error('[POST /api/admin/coupons] unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
