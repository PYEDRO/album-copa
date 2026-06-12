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
    // ATUALIZADO (2026-06-12): "liberar lendária" no jogo. O peso é POR CARTA e
    // o pool já está filtrado p/ cartas NÃO possuídas. Como há muitas comuns e
    // poucas lendárias, a chance real de lendária é:
    //   P(lendária) = (nº lendárias faltando × peso_lendária) / soma dos pesos
    // Por isso a lendária precisa de peso MUITO maior p/ não ser "afogada".
    // Aqui cada LENDÁRIA pesa ~8× uma comum (120 vs 15): enquanto o jogador
    // tiver lendária faltando, ela vira o prêmio mais provável do acerto.
    //   common:    15
    //   rare:      20
    //   epic:      35
    //   legendary: 120
    // Ajuste o número da legendary aqui se quiser mais/menos.
    const GAME_REWARD_WEIGHTS: Record<string, number> = {
      common: 15,
      rare: 20,
      epic: 35,
      legendary: 120,
    }

    // ── REGRA "LENDÁRIA PRIMEIRO" (evento de finalização, 2026-06-12) ──
    // Enquanto o jogador AINDA tiver lendária faltando, o acerto entrega
    // EXCLUSIVAMENTE lendária (sorteio uniforme entre as que faltam). Só depois
    // de completar todas as lendárias o prêmio volta ao pool normal ponderado.
    // É a probabilidade MÁXIMA possível p/ quem só precisa de lendária.
    // Para desligar após o evento: troque PRIORITIZE_LEGENDARY para false.
    const PRIORITIZE_LEGENDARY = true
    const missingLegendaries = availablePool.filter((s) => s.rarity === 'legendary')
    const pool =
      PRIORITIZE_LEGENDARY && missingLegendaries.length > 0
        ? missingLegendaries
        : availablePool
    const poolWeights = pool.map((s) => GAME_REWARD_WEIGHTS[s.rarity] ?? 15)
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
