/**
 * Edge Function: claim-game-reward
 * Concede 1 figurinha NÃO POSSUÍDA ao jogador que acertou no jogo.
 * Uma recompensa por vitória (sem limite diário).
 * A figurinha é SEMPRE nova (não possuída no álbum do jogador).
 *
 * Estratégia: Backend filtra cartas já possuídas ANTES de sortear.
 * Resultado: nunca sorteará repetida, álbum é sempre coletável.
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

    // ── Busca catálogo completo ───────────────────────────────
    const { data: allStickers, error: stickerError } = await supabaseAdmin
      .from('stickers')
      .select('*')

    if (stickerError || !allStickers?.length) {
      return errorResponse(500, 'Sticker catalog unavailable')
    }

    // ── NOVO: Busca cartas que o usuário JÁ POSSUI ──────────────
    const { data: ownedStickers, error: ownedError } = await supabaseAdmin
      .from('user_stickers')
      .select('sticker_id')
      .eq('user_id', user.id)

    if (ownedError) {
      console.error('Error fetching owned stickers:', ownedError)
      return errorResponse(500, 'Inventory check failed')
    }

    const ownedIds = new Set((ownedStickers || []).map((o: any) => o.sticker_id))

    // ── NOVO: Filtra pool para SÓ cartas NÃO POSSUÍDAS ──────────
    const availablePool = (allStickers as Sticker[]).filter((s) => !ownedIds.has(s.id))

    // ── Trata caso: álbum completo (nenhuma carta disponível) ────
    if (availablePool.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ALBUM_COMPLETE',
          message: 'Parabéns! Você completou o álbum!',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Escolhe figurinha do pool FILTRADO, ponderada por raridade ──
    // ATUALIZADO (2026-06-11): Aumentado 10x as chances de ÉPICO e LENDÁRIO
    // Novo balanço:
    //   common:    72 (44.2%) - mantém base
    //   rare:      21 (12.9%) - mantém base
    //   epic:      50 (30.7%) - 10x mais (era 5%)
    //   legendary: 20 (12.3%) - 10x mais (era 2%)
    // Total peso: 163 (antes era 100)
    const GAME_REWARD_WEIGHTS: Record<string, number> = {
      common: 72,
      rare: 21,
      epic: 50,      // ← AUMENTADO DE 5 PARA 50 (10x)
      legendary: 20, // ← AUMENTADO DE 2 PARA 20 (10x)
    }

    const pool = availablePool
    const poolWeights = pool.map((s) => GAME_REWARD_WEIGHTS[s.rarity] ?? 72)
    const totalPoolWeight = poolWeights.reduce((a, b) => a + b, 0)
    let roll = Math.random() * totalPoolWeight
    let sticker = pool[pool.length - 1]
    for (let i = 0; i < pool.length; i++) {
      roll -= poolWeights[i]
      if (roll <= 0) {
        sticker = pool[i]
        break
      }
    }

    // ── Persiste via RPC atômico ──────────────────────────────
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('claim_game_reward', {
      p_user_id: user.id,
      p_sticker_id: sticker.id,
    })

    if (rpcError) {
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
