/**
 * Edge Function: claim-daily-pack
 * Regras de geração do pack:
 *  - Máx. 1 figurinha repetida (já no álbum) por pack
 *  - Nenhuma figurinha se repete dentro do mesmo pack
 *  - Pity system mantido para raridade
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sticker cache (TTL 5min per SDD §5.5)
let stickerCache: Sticker[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000

const SCORE_MAP: Record<string, number> = {
  common: 1,
  rare: 3,
  epic: 7,
  legendary: 15,
}

const STICKERS_PER_PACK = 3
const MAX_DUPLICATES_PER_PACK = 1

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

  const startTime = Date.now()

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

    // ── Fetch user profile ────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('pity_counter, score')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return errorResponse(500, 'Profile not found')
    }

    // ── Rate limiting 100% server-side via daily_claims ──────
    // "Dia do pack" no fuso de Fortaleza, virando às 12:00 (meio-dia): os 2
    // packs renovam ao meio-dia, não à meia-noite. Subtrai 12h da hora local
    // antes de extrair a data — igual ao RPC (current_pack_day).
    const brt = new Date(Date.now() - 3 * 60 * 60 * 1000) // UTC-3 (Fortaleza, sem horário de verão)
    brt.setUTCHours(brt.getUTCHours() - 12)                // vira ao meio-dia
    const today = brt.toISOString().split('T')[0]
    const MAX_PACKS_PER_DAY = 2

    const { count: packsToday, error: countError } = await supabaseAdmin
      .from('daily_claims')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('claim_date', today)
      .eq('status', 'completed')

    if (countError) {
      console.error('daily_claims count error:', countError)
      return errorResponse(500, 'Failed to check pack status')
    }

    if ((packsToday ?? 0) >= MAX_PACKS_PER_DAY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PACK_LIMIT_REACHED',
          packs_remaining: 0,
          max_packs: MAX_PACKS_PER_DAY,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Load sticker catalog (cached) ─────────────────────────
    const now = Date.now()
    if (!stickerCache || now - cacheTimestamp > CACHE_TTL_MS) {
      const { data: stickers, error: stickerError } = await supabaseAdmin
        .from('stickers')
        .select('*')

      if (stickerError || !stickers?.length) {
        return errorResponse(500, 'Sticker catalog unavailable')
      }

      stickerCache = stickers
      cacheTimestamp = now
    }

    // ── Fetch owned sticker counts (snapshot do álbum antes do pack) ──
    const { data: owned } = await supabaseAdmin
      .from('user_stickers')
      .select('sticker_id, quantity')
      .eq('user_id', user.id)

    // albumOwnedMap: estado do álbum ANTES deste pack — não é alterado durante a geração
    const albumOwnedMap = new Map<string, number>(
      (owned ?? []).map((s: { sticker_id: string; quantity: number }) => [s.sticker_id, s.quantity]),
    )

    // ── Gera figurinhas do pack com novas regras ───────────────
    //   • Nenhuma figurinha se repete dentro do pack (pickedIds)
    //   • Máx. MAX_DUPLICATES_PER_PACK cartas já possuídas no álbum
    const generatedStickers: Sticker[] = []
    const pickedIds = new Set<string>()
    let duplicatesInPack = 0
    let pityCounter = profile.pity_counter ?? 0

    for (let i = 0; i < STICKERS_PER_PACK; i++) {
      const mustBeNew = duplicatesInPack >= MAX_DUPLICATES_PER_PACK
      const sticker = generateSticker(stickerCache!, albumOwnedMap, pityCounter, pickedIds, mustBeNew)
      generatedStickers.push(sticker)

      // Conta duplicata (carta que já estava no álbum antes deste pack)
      if ((albumOwnedMap.get(sticker.id) ?? 0) > 0) {
        duplicatesInPack++
      }

      pickedIds.add(sticker.id)

      // Atualiza pity counter (SDD §5.3)
      if (sticker.rarity === 'epic' || sticker.rarity === 'legendary') {
        pityCounter = 0
      } else {
        pityCounter++
      }
    }

    const scoreGained = generatedStickers.reduce(
      (sum, s) => sum + (SCORE_MAP[s.rarity] ?? 1),
      0,
    )

    // ── Atomic DB transaction (PL/pgSQL) ─────────────────────
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('claim_daily_pack', {
      p_user_id: user.id,
      p_stickers: generatedStickers,
      p_score_gained: scoreGained,
      p_pity_counter: pityCounter,
    })

    if (rpcError) {
      if (rpcError.message?.includes('PACK_LIMIT_REACHED')) {
        return new Response(
          JSON.stringify({ success: false, error: 'PACK_LIMIT_REACHED', packs_remaining: 0 }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      if (rpcError.message?.includes('CLAIM_ALREADY')) {
        return errorResponse(409, 'ALREADY_CLAIMED_TODAY')
      }
      console.error('RPC error:', rpcError)
      return errorResponse(500, 'Transaction failed')
    }

    // Refresh leaderboard async (best-effort)
    supabaseAdmin.rpc('refresh_leaderboard').then(() => {}).catch(console.warn)

    const executionMs = Date.now() - startTime
    const packsRemaining = Math.max(0, MAX_PACKS_PER_DAY - (packsToday ?? 0) - 1)

    return new Response(
      JSON.stringify({
        success: true,
        stickers: generatedStickers,
        scoreGained,
        executionMs,
        idempotent: result?.idempotent ?? false,
        packs_remaining: packsRemaining,
        max_packs: MAX_PACKS_PER_DAY,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Internal server error')
  }
})

// ── Geração de figurinha com pity + novas restrições ────────────
//
// Parâmetros:
//   albumOwnedMap  — estado do álbum ANTES do pack (não muta)
//   pickedInThisPack — IDs já escolhidos neste pack
//   mustBeNew      — se true, força carta não possuída no álbum
//
function generateSticker(
  allStickers: Sticker[],
  albumOwnedMap: Map<string, number>,
  pityCounter: number,
  pickedInThisPack: Set<string>,
  mustBeNew: boolean,
): Sticker {
  const BASE_WEIGHTS: Record<string, number> = {
    common: 70,
    rare: 20,
    epic: 9,
    legendary: 1,
  }

  // boostFactor = min(1 + pityCounter * 0.1, 3)
  const boostFactor = Math.min(1 + pityCounter * 0.1, 3)

  const weights: Record<string, number> = {
    common: BASE_WEIGHTS.common,
    rare: BASE_WEIGHTS.rare * boostFactor,
    epic: BASE_WEIGHTS.epic * boostFactor,
    legendary: BASE_WEIGHTS.legendary * boostFactor,
  }

  // Weighted rarity roll
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * totalWeight
  let selectedRarity = 'common'

  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) {
      selectedRarity = rarity
      break
    }
  }

  // Pool by rarity, excluding cards already picked in this pack
  let pool = allStickers
    .filter((s) => s.rarity === selectedRarity)
    .filter((s) => !pickedInThisPack.has(s.id))

  // Fallback: se não sobrou nenhuma da raridade selecionada, abre para todas
  if (pool.length === 0) {
    pool = allStickers.filter((s) => !pickedInThisPack.has(s.id))
  }

  // Fallback extremo: se já escolhemos todas as cartas (não deve ocorrer com 55+)
  if (pool.length === 0) {
    pool = allStickers
  }

  // Se deve ser nova (mustBeNew): filtra para cartas não possuídas no álbum
  let candidates = pool
  if (mustBeNew) {
    const newOnes = pool.filter((s) => (albumOwnedMap.get(s.id) ?? 0) === 0)
    if (newOnes.length > 0) candidates = newOnes
    // Se não há cartas novas disponíveis (álbum quase completo), usa pool sem filtro
  }

  // Pesos: preferência forte por cartas novas quando não é mustBeNew
  const poolWeights = candidates.map((s) => {
    const owned = albumOwnedMap.get(s.id) ?? 0
    return owned === 0 ? 5 : 1
  })

  const totalPoolWeight = poolWeights.reduce((a, b) => a + b, 0)
  let poolRoll = Math.random() * totalPoolWeight

  for (let i = 0; i < candidates.length; i++) {
    poolRoll -= poolWeights[i]
    if (poolRoll <= 0) return candidates[i]
  }

  return candidates[candidates.length - 1]
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
