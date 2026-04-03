import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'token requis' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { data, error } = await supabase.rpc('validate_coupon', {
      p_token:    token,
      p_admin_id: user.id,
    })

    if (error) {
      console.error('[/api/admin/validate-coupon] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as Record<string, unknown>

    if (result.error) {
      const status =
        result.error === 'not_found'    ? 404
        : result.error === 'already_used' ? 409
        : result.error === 'qr_expired' ? 410
        : result.error === 'expired'    ? 410
        : result.error === 'unauthorized' ? 403
        : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/admin/validate-coupon] unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
