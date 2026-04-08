import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, gameId, credits } = body
    console.log('[give-credits] body reçu:', { userId, gameId, credits })

    if (!userId || !gameId || typeof credits !== 'number' || credits < 1) {
      console.error('[give-credits] validation échouée:', { userId, gameId, credits })
      return NextResponse.json({ error: 'userId, gameId et credits (≥1) requis' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    console.log('[give-credits] auth:', { userId: user?.id, authErr })
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    console.log('[give-credits] profile:', { role: profile?.role, profileErr })

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Récupère le solde actuel
    const { data: existing, error: readErr } = await supabase
      .from('game_credits')
      .select('credits')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle()
    console.log('[give-credits] lecture existante:', { existing, readErr })

    const newCredits = (existing?.credits ?? 0) + credits
    console.log('[give-credits] upsert → newCredits:', newCredits)

    const { error: upsertErr } = await supabase
      .from('game_credits')
      .upsert(
        { user_id: userId, game_id: gameId, credits: newCredits, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,game_id' }
      )

    if (upsertErr) {
      console.error('[give-credits] upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message, detail: upsertErr }, { status: 500 })
    }

    console.log('[give-credits] succès → credits:', newCredits)
    return NextResponse.json({ success: true, credits: newCredits })
  } catch (err) {
    console.error('[give-credits] exception:', err)
    return NextResponse.json({ error: 'Erreur serveur', detail: String(err) }, { status: 500 })
  }
}
