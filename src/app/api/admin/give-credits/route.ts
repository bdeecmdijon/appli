import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { userId, gameId, credits } = await req.json()

    if (!userId || !gameId || typeof credits !== 'number' || credits < 1) {
      return NextResponse.json({ error: 'userId, gameId et credits (≥1) requis' }, { status: 400 })
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

    // Récupère le solde actuel (peut ne pas exister encore)
    const { data: existing } = await supabase
      .from('game_credits')
      .select('credits')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle()

    const newCredits = (existing?.credits ?? 0) + credits

    const { error } = await supabase
      .from('game_credits')
      .upsert(
        { user_id: userId, game_id: gameId, credits: newCredits, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,game_id' }
      )

    if (error) {
      console.error('[/api/admin/give-credits]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, credits: newCredits })
  } catch (err) {
    console.error('[/api/admin/give-credits] unexpected:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
