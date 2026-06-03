import { useState, useCallback, useEffect } from 'react'
import { supabase, type DbSticker } from '../lib/supabase'
import { MAX_STICKERS } from '../constants'

export interface AdminUser {
  id: string
  name: string
  role: 'USER' | 'ADMIN'
  score: number
  total_stickers: number
  packs_opened: number
  last_pack_at: string | null
  created_at: string
  approved: boolean | null
  avatar_url: string | null
}

export interface AdminMetrics {
  totalUsers: number
  activeToday: number
  activeLast7Days: number
  packsOpenedToday: number
  totalStickersIssued: number
  uniqueStickers: number
}

export interface GameWinner {
  id: string
  user_id: string
  name: string
  position: number
  total_stickers: number
  completed_at: string
  acknowledged: boolean
}

export function useAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0, activeToday: 0, activeLast7Days: 0,
    packsOpenedToday: 0, totalStickersIssued: 0, uniqueStickers: 0,
  })
  const [winners, setWinners] = useState<GameWinner[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Métricas agregadas no banco (SUM/DISTINCT). Evita o limite de 1000 linhas
      // do PostgREST, que antes capava os totais em ~1000.
      const { data, error: rpcError } = await supabase.rpc('get_admin_metrics').single()
      if (rpcError) throw rpcError

      const m = data as {
        total_users: number
        active_today: number
        active_last_7_days: number
        packs_opened_today: number
        total_stickers_issued: number
        unique_stickers: number
      }

      setMetrics({
        totalUsers:          m?.total_users           ?? 0,
        activeToday:         m?.active_today           ?? 0,
        activeLast7Days:     m?.active_last_7_days     ?? 0,
        packsOpenedToday:    m?.packs_opened_today     ?? 0,
        totalStickersIssued: m?.total_stickers_issued  ?? 0,
        uniqueStickers:      m?.unique_stickers        ?? 0,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, role, score, last_pack_at, created_at, approved, avatar_url')
      .order('score', { ascending: false })

    if (!profiles) return

    const { data: stickerRows } = await supabase
      .from('user_stickers').select('user_id, quantity')

    const { data: packRows } = await supabase
      .from('pack_logs').select('user_id')

    const stickerMap = new Map<string, number>()
    for (const row of stickerRows ?? []) {
      stickerMap.set(row.user_id, (stickerMap.get(row.user_id) ?? 0) + (row.quantity ?? 0))
    }

    const packMap = new Map<string, number>()
    for (const row of packRows ?? []) {
      packMap.set(row.user_id, (packMap.get(row.user_id) ?? 0) + 1)
    }

    setUsers(profiles.map((p: {
      id: string; name: string; role: 'USER'|'ADMIN'; score: number;
      last_pack_at: string|null; created_at: string; approved: boolean|null;
      avatar_url: string|null
    }) => ({
      ...p,
      total_stickers: stickerMap.get(p.id) ?? 0,
      packs_opened:   packMap.get(p.id)   ?? 0,
    })))
  }, [])

  // ── Vencedores (álbum completo) ─────────────────────────────
  const fetchWinners = useCallback(async () => {
    const { data } = await supabase
      .from('game_winners')
      .select('id, user_id, name, position, total_stickers, completed_at, acknowledged')
      .order('position', { ascending: true })
    setWinners((data ?? []) as GameWinner[])
  }, [])

  const acknowledgeWinner = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('game_winners')
      .update({ acknowledged: true })
      .eq('id', id)
    if (!error) await fetchWinners()
    return error
  }, [fetchWinners])

  useEffect(() => {
    fetchMetrics()
    fetchUsers()
    fetchWinners()
  }, [fetchMetrics, fetchUsers, fetchWinners])

  const promoteUser = useCallback(async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ role: 'ADMIN' }).eq('id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  const demoteUser = useCallback(async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ role: 'USER' }).eq('id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  // Override manual da foto do usuário. Útil quando o Google não expõe o avatar
  // via OAuth (foto restrita no Workspace) e o backfill não consegue recuperar.
  // RLS "Admins can update any profile" (migration 002) permite a gravação, e o
  // trigger de avatar_url (migration 009) atualiza o ranking automaticamente.
  const setUserAvatar = useCallback(async (userId: string, url: string | null) => {
    const value = url && url.trim().length > 0 ? url.trim() : null
    const { error } = await supabase.from('profiles').update({ avatar_url: value }).eq('id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  const resetUserCollection = useCallback(async (userId: string) => {
    const { error } = await supabase.from('user_stickers').delete().eq('user_id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  // Aprovacao de usuarios pendentes
  const approveUser = useCallback(async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ approved: true }).eq('id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  const rejectUser = useCallback(async (userId: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (!error) await fetchUsers()
    return error
  }, [fetchUsers])

  // Sticker CRUD
  const createSticker = useCallback(async (sticker: Omit<DbSticker, 'id'> & { id?: string }) => {
    // Cap de MAX_STICKERS: nunca cadastrar além do limite do álbum.
    const { count } = await supabase
      .from('stickers')
      .select('*', { count: 'exact', head: true })
    if ((count ?? 0) >= MAX_STICKERS) {
      return { message: `Limite de ${MAX_STICKERS} figurinhas atingido. Exclua uma antes de adicionar outra.` }
    }
    const id = sticker.id?.trim() || ('s' + Date.now())
    const { error } = await supabase.from('stickers').insert({ ...sticker, id })
    return error
  }, [])

  const updateSticker = useCallback(async (id: string, sticker: Partial<DbSticker>) => {
    // Remove o campo `id` do payload — não pode atualizar a PK
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = sticker
    const { error } = await supabase.from('stickers').update(rest).eq('id', id)
    return error
  }, [])

  const deleteSticker = useCallback(async (id: string) => {
    // Os FKs de user_stickers/game_claims/quiz_questions têm ON DELETE
    // CASCADE/SET NULL (migration 014), então o banco remove as dependências
    // automaticamente ao excluir a figurinha.
    const { error } = await supabase.from('stickers').delete().eq('id', id)
    return error
  }, [])

  const uploadStickerImage = useCallback(async (file: File, stickerId: string): Promise<string | null> => {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = 'stickers/' + stickerId + '.' + ext

    const uploadPromise = supabase.storage
      .from('sticker-images')
      .upload(path, file, { upsert: true, contentType: file.type })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(
        'Timeout de upload (20s). Verifique se o bucket "sticker-images" existe no Supabase Storage e se as políticas de RLS permitem INSERT/UPDATE para admins.'
      )), 20_000)
    )

    try {
      const { error } = await Promise.race([uploadPromise, timeoutPromise])
      if (error) { console.error('Upload error:', error); return null }
    } catch (e) {
      console.error('Upload falhou:', e)
      return null
    }

    const { data } = supabase.storage.from('sticker-images').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }, [])

  const pendingUsers = users.filter(u => u.approved === false)

  return {
    users,
    pendingUsers,
    winners,
    metrics,
    loading,
    error,
    fetchMetrics,
    fetchUsers,
    fetchWinners,
    acknowledgeWinner,
    promoteUser,
    demoteUser,
    setUserAvatar,
    resetUserCollection,
    approveUser,
    rejectUser,
    createSticker,
    updateSticker,
    deleteSticker,
    uploadStickerImage,
  }
}
