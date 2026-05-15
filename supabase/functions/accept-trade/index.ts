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
      if (msg.includes('TRADE_NOT_FOUND'))    return errorResponse(404, 'Trade not found')
      if (msg.includes('TRADE_NOT_PENDING'))  return errorResponse(409, 'Trade is no longer pending')
      if (msg.includes('TRADE_UNAUTHORIZED')) return errorResponse(403, 'Not authorized to accept this trade')
      if (msg.includes('MISSING_STICKER'))    return errorResponse(422, `Sticker not owned: ${msg.split(':')[1]}`)
      console.error('execute_trade error:', error)
      return errorResponse(500, 'Trade execution failed')
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
