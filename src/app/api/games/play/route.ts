import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const { gameId } = await req.json()
    if (!gameId) return NextResponse.json({ error: 'gameId requis' }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // ── Vérification des crédits ──────────────────────────────────────────
    const { data: creditRow } = await supabase
      .from('game_credits')
      .select('credits')
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (!creditRow || creditRow.credits < 1) {
      return NextResponse.json({ error: 'Aucun crédit disponible' }, { status: 422 })
    }

    // ── Récupère les lots configurés ──────────────────────────────────────
    const { data: prizes, error: prizesErr } = await supabase
      .from('game_prizes')
      .select('*')
      .eq('game_id', gameId)
      .order('sort_order', { ascending: true })

    if (prizesErr || !prizes?.length) {
      return NextResponse.json({ error: 'Jeu non configuré' }, { status: 500 })
    }

    // ── Tirage au sort côté serveur ───────────────────────────────────────
    let cumulative = 0
    const ranges = prizes.map(p => {
      const start = cumulative
      cumulative += p.probability
      return { ...p, start, end: cumulative }
    })
    const roll = Math.random() * 100
    const winner = ranges.find(r => roll >= r.start && roll < r.end) ?? ranges[ranges.length - 1]
    console.log('[play] roll:', roll.toFixed(2), '→ winner:', winner.zone, '| generates_coupon:', winner.generates_coupon)

    // ── Décrémente 1 crédit ───────────────────────────────────────────────
    const { error: creditErr } = await supabase
      .from('game_credits')
      .update({ credits: creditRow.credits - 1, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('game_id', gameId)

    if (creditErr) {
      console.error('[play] credit update error:', creditErr)
      return NextResponse.json({ error: creditErr.message }, { status: 500 })
    }

    // ── Génère un coupon si le lot le prévoit ─────────────────────────────
    let couponAssignmentId: string | null = null
    let couponDebug: string | null = null

    if (winner.generates_coupon) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      console.log('[play] inserting coupon for zone:', winner.zone, '| expires:', expiresAt)

      const { data: coupon, error: couponErr } = await supabase
        .from('coupons')
        .insert({
          emoji:          winner.emoji,
          title:          winner.prize_name,
          description:    `Gagné au ${winner.zone === 'jackpot' ? '🎉 ' : ''}Lancer du Cochonnet`,
          available_from: new Date().toISOString(),
          expires_at:     expiresAt,
          target:         'specific',
          quantity:       1,
        })
        .select('id')
        .single()

      if (couponErr) {
        console.error('[play] coupon INSERT error:', JSON.stringify(couponErr))
        couponDebug = `coupon_err: ${couponErr.message} (${couponErr.code})`
      } else if (coupon) {
        console.log('[play] coupon created:', coupon.id)

        const { data: assignment, error: assignErr } = await supabase
          .from('coupon_assignments')
          .insert({ coupon_id: coupon.id, user_id: user.id })
          .select('id')
          .single()

        if (assignErr) {
          console.error('[play] coupon_assignment INSERT error:', JSON.stringify(assignErr))
          couponDebug = `assign_err: ${assignErr.message} (${assignErr.code})`
        } else {
          couponAssignmentId = assignment?.id ?? null
          console.log('[play] assignment created:', couponAssignmentId)
        }
      }
    }

    // ── Enregistre la partie ──────────────────────────────────────────────
    const { error: playErr } = await supabase.from('game_plays').insert({
      user_id:    user.id,
      game_id:    gameId,
      result:     winner.zone,
      prize_name: winner.prize_name,
      coupon_id:  couponAssignmentId ?? null,
    })
    if (playErr) console.error('[play] game_plays INSERT error:', playErr)

    return NextResponse.json({
      result:           winner.zone,
      prizeName:        winner.prize_name,
      emoji:            winner.emoji,
      color:            winner.color,
      generatesCoupon:  winner.generates_coupon,
      couponId:         couponAssignmentId,
      creditsRemaining: creditRow.credits - 1,
      ...(couponDebug ? { _couponDebug: couponDebug } : {}),
    })
  } catch (err) {
    console.error('[/api/games/play] unexpected:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
