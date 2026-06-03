/**
 * Edge Function: claim-game-reward
 * Concede 1 figurinha não possuída ao jogador que acertou no jogo.
 * Uma recompensa por vitória (sem limite diário).
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

    // ── Busca catálogo completo ───────────────────────────────
    const { data: allStickers, error: stickerError } = await supabaseAdmin
      .from('stickers')
      .select('*')

    if (stickerError || !allStickers?.length) {
      return errorResponse(500, 'Sticker catalog unavailable')
    }

    // ── Escolhe figurinha do CATÁLOGO COMPLETO, ponderada por raridade ──
    // O jogo agora pode premiar figurinhas que o usuário JÁ tem (repetidas),
    // não só as inéditas. Mantém a distribuição de raridade (não vira atalho
    // para cartas raras). Se vier repetida, a RPC claim_game_reward incrementa
    // a quantidade (ON CONFLICT) — por isso não há mais "álbum completo".
    const GAME_REWARD_WEIGHTS: Record<string, number> = {
      common: 72,
      rare: 21,
      epic: 5,
      legendary: 2,
    }

    const pool = allStickers as Sticker[]
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
