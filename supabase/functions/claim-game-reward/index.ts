/**
 * Edge Function: claim-game-reward
 * Concede 1 figurinha não possuída ao jogador que acertou no jogo do dia.
 * Limite: 1 recompensa por dia por usuário.
 * A figurinha é sempre nova (não possuída no álbum).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Sticker {
  id: string
  name: string
  role: string
  team: string
  rarity: string
  characteristics: Record<string, number>
  image_url: string
  bio: string
  achievements: string[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'Missing authorization header')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return errorResponse(401, 'Unauthorized')
    }

    // ── Verifica se já resgatou a recompensa hoje ─────────────
    const today = new Date().toISOString().split('T')[0]

    const { count, error: countError } = await supabaseAdmin
      .from('game_claims')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('claim_date', today)

    if (countError) {
      console.error('game_claims count error:', countError)
      return errorResponse(500, 'Failed to check game reward status')
    }

    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'GAME_REWARD_ALREADY_CLAIMED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Busca catálogo completo ───────────────────────────────
    const { data: allStickers, error: stickerError } = await supabaseAdmin
      .from('stickers')
      .select('*')

    if (stickerError || !allStickers?.length) {
      return errorResponse(500, 'Sticker catalog unavailable')
    }

    // ── Busca figurinhas já possuídas ─────────────────────────
    const { data: owned } = await supabaseAdmin
      .from('user_stickers')
      .select('sticker_id')
      .eq('user_id', user.id)

    const ownedIds = new Set((owned ?? []).map((s: { sticker_id: string }) => s.sticker_id))

    // ── Filtra cartas não possuídas ───────────────────────────
    const unowned = (allStickers as Sticker[]).filter((s) => !ownedIds.has(s.id))

    if (unowned.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'ALBUM_COMPLETE' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Escolhe figurinha aleatória dentre as não possuídas ───
    const sticker = unowned[Math.floor(Math.random() * unowned.length)]

    // ── Persiste via RPC atômico ──────────────────────────────
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('claim_game_reward', {
      p_user_id: user.id,
      p_sticker_id: sticker.id,
    })

    if (rpcError) {
      if (rpcError.message?.includes('GAME_REWARD_ALREADY_CLAIMED')) {
        return new Response(
          JSON.stringify({ success: false, error: 'GAME_REWARD_ALREADY_CLAIMED' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      console.error('RPC error:', rpcError)
      return errorResponse(500, 'Transaction failed')
    }

    if (result?.success === false) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Refresh leaderboard async (best-effort)
    supabaseAdmin.rpc('refresh_leaderboard').then(() => {}).catch(console.warn)

    return new Response(
      JSON.stringify({ success: true, sticker, score_gained: result?.score_gained ?? 1 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Internal server error')
  }
})

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
