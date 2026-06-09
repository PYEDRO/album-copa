/**
 * Edge Function: accept-trade
 * Atomically validates and executes a trade between two users.
 * Ownership validation + swap delegated to execute_trade() PL/pgSQL.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Missing authorization')

    const { tradeId } = await req.json()
    if (!tradeId) return errorResponse(400, 'Missing tradeId')

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
    if (authError || !user) return errorResponse(401, 'Unauthorized')

    // Delegate atomic execution to PL/pgSQL
    const { data, error } = await supabaseAdmin.rpc('execute_trade', {
      p_trade_id: tradeId,
      p_acceptor_id: user.id,
    })

    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('TRADE_NOT_FOUND'))    return errorResponse(404, 'Troca não encontrada.')
      if (msg.includes('TRADE_NOT_PENDING'))  return errorResponse(409, 'Esta troca não está mais pendente — pode já ter sido aceita, recusada ou cancelada.')
      if (msg.includes('TRADE_UNAUTHORIZED')) return errorResponse(403, 'Você não tem permissão para aceitar esta troca.')
      if (msg.includes('TRADE_NOT_ONE_FOR_ONE') || msg.includes('TRADE_MUST_BE_ONE_FOR_ONE'))
        return errorResponse(422, 'A troca precisa ser de 1 figurinha por 1 figurinha.')
      // Quem aceita é o destinatário (to_user). OFFERER = quem propôs; ACCEPTOR = você.
      if (msg.includes('OFFERER_MISSING_STICKER'))
        return errorResponse(422, 'Esta troca não é mais válida: quem propôs não tem mais essa figurinha repetida para oferecer.')
      if (msg.includes('ACCEPTOR_MISSING_STICKER'))
        return errorResponse(422, 'Você não tem mais a figurinha pedida repetida (qty ≥ 2) para concluir esta troca.')
      console.error('execute_trade error:', error)
      return errorResponse(500, 'Trade execution failed')
    }

    // Desde a migration 035, execute_trade NÃO lança erro para "trocas fantasma":
    // ele CANCELA a troca e devolve success:false. Aqui traduzimos para uma
    // mensagem clara — a troca já saiu dos pendentes (realtime atualiza o front).
    if (data?.success === false) {
      if (data.error === 'OFFERER_MISSING_STICKER')
        return errorResponse(422, 'Esta troca não é mais válida: quem propôs não tem mais essa figurinha repetida. A troca foi cancelada.')
      if (data.error === 'ACCEPTOR_MISSING_STICKER')
        return errorResponse(422, 'Você não tem mais a figurinha pedida repetida (qty ≥ 2). A troca foi cancelada.')
      return errorResponse(422, 'Esta troca não pôde ser concluída e foi cancelada.')
    }

    // Refresh leaderboard async (best-effort)
    supabaseAdmin.rpc('refresh_leaderboard').then(() => {}).catch(console.warn)

    return new Response(
      JSON.stringify({ success: true }),
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
