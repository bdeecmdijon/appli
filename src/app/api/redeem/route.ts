import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { reward_id } = await req.json()
    if (!reward_id) {
      return NextResponse.json({ error: 'reward_id requis' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    // Vérifie l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Appelle la fonction RPC atomique (SECURITY DEFINER)
    const { data, error } = await supabase.rpc('create_redemption', {
      p_user_id:  user.id,
      p_reward_id: reward_id,
    })

    if (error) {
      console.error('[/api/redeem] rpc error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // La fonction retourne un objet JSON — Supabase le parse automatiquement
    const result = data as Record<string, unknown>

    if (result.error) {
      const status = result.error === 'insufficient_points' ? 422
        : result.error === 'out_of_stock'    ? 422
        : result.error === 'reward_not_found' ? 404
        : result.error === 'unauthorized'     ? 403
        : 500
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/redeem] unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
