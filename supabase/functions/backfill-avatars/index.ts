/**
 * Edge Function: backfill-avatars
 *
 * Recupera profiles.avatar_url para usuários que estão sem foto, lendo a fonte
 * de verdade do Google via Admin API: user_metadata E identities[].identity_data.
 *
 * Por que existe: o avatar do Google nem sempre aparece em user_metadata — em
 * vários casos ele só está em identity_data (por provider). Backfills antigos
 * (migrations 008/011) liam apenas raw_user_meta_data, deixando alguns usuários
 * com avatar_url = NULL mesmo tendo foto.
 *
 * Uso (somente ADMIN):
 *   POST /functions/v1/backfill-avatars            → corrige + retorna relatório
 *   POST /functions/v1/backfill-avatars  {dryRun:true} → só diagnostica, não grava
 *
 * O relatório inclui, para cada usuário que continua sem foto, o conteúdo bruto
 * de user_metadata e identity_data — assim dá pra ver se o Google realmente não
 * expõe a foto (limitação de visibilidade no Workspace) ou se é outro problema.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pickAvatar(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null
  const v = (meta.avatar_url ?? meta.picture) as string | undefined
  return typeof v === 'string' && v.length > 0 ? v : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing authorization header' })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // ── Auth + checagem de ADMIN ──────────────────────────────
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json(401, { error: 'Unauthorized' })

    const { data: caller } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'ADMIN') return json(403, { error: 'Admin only' })

    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun === true

    // ── 1. Coleta o melhor avatar de cada usuário via Admin API ──
    //   Fonte 1: user_metadata
    //   Fonte 2: identities[].identity_data  (mais confiável p/ Google)
    const authAvatars = new Map<string, string>()       // userId -> avatar
    const authDebug = new Map<string, {
      email: string | undefined
      metadata: Record<string, unknown>
      identities: { provider: string; identity_data: Record<string, unknown> }[]
    }>()

    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) return json(500, { error: 'listUsers failed: ' + error.message })
      const users = data?.users ?? []

      for (const u of users) {
        const identities = (u.identities ?? []).map((i) => ({
          provider: i.provider,
          identity_data: (i.identity_data ?? {}) as Record<string, unknown>,
        }))
        authDebug.set(u.id, {
          email: u.email,
          metadata: (u.user_metadata ?? {}) as Record<string, unknown>,
          identities,
        })

        const fromMeta = pickAvatar(u.user_metadata as Record<string, unknown>)
        const fromIdentity = identities.map((i) => pickAvatar(i.identity_data)).find(Boolean) ?? null
        const avatar = fromMeta ?? fromIdentity
        if (avatar) authAvatars.set(u.id, avatar)
      }

      if (users.length < perPage) break
      page++
    }

    // ── 2. Quais profiles estão sem avatar ────────────────────
    const { data: missingProfiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .is('avatar_url', null)
    if (profErr) return json(500, { error: 'profiles query failed: ' + profErr.message })

    const updated: { id: string; name: string; avatar_url: string }[] = []
    const stillMissing: {
      id: string; name: string; email?: string
      metadata_keys: string[]
      identity_providers: string[]
      identity_data: Record<string, unknown>[]
    }[] = []

    for (const p of missingProfiles ?? []) {
      const avatar = authAvatars.get(p.id)
      if (avatar) {
        if (!dryRun) {
          const { error: upErr } = await supabaseAdmin
            .from('profiles').update({ avatar_url: avatar }).eq('id', p.id)
          if (upErr) {
            console.error('update failed for', p.id, upErr.message)
            continue
          }
        }
        updated.push({ id: p.id, name: p.name, avatar_url: avatar })
      } else {
        const dbg = authDebug.get(p.id)
        stillMissing.push({
          id: p.id,
          name: p.name,
          email: dbg?.email,
          metadata_keys: dbg ? Object.keys(dbg.metadata) : [],
          identity_providers: dbg ? dbg.identities.map((i) => i.provider) : [],
          identity_data: dbg ? dbg.identities.map((i) => i.identity_data) : [],
        })
      }
    }

    // ── 3. Atualiza o ranking ─────────────────────────────────
    if (!dryRun && updated.length > 0) {
      await supabaseAdmin.rpc('refresh_leaderboard').catch(() => {})
    }

    return json(200, {
      success: true,
      dryRun,
      total_auth_users: authDebug.size,
      profiles_missing_before: (missingProfiles ?? []).length,
      updated_count: updated.length,
      updated,
      still_missing_count: stillMissing.length,
      still_missing: stillMissing,
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return json(500, { error: String(err) })
  }
})

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
