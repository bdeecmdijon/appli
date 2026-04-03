import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { assignment_id } = await req.json()
    if (!assignment_id) {
      return NextResponse.json({ error: 'assignment_id requis' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('use_coupon', {
      p_user_id:       user.id,
      p_assignment_id: assignment_id,
    })

    if (error) {
      console.error('[/api/coupons/use] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as Record<string, unknown>

    if (result.error) {
      const status =
        result.error === 'not_found'         ? 404
        : result.error === 'already_used'    ? 409
        : result.error === 'expired'         ? 410
        : result.error === 'qr_expired'      ? 410
        : result.error === 'not_yet_available' ? 403
        : result.error === 'unauthorized'    ? 403
        : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/coupons/use] unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
