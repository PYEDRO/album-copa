import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbSticker, type DbUserSticker } from '../lib/supabase'

const MAX_PACKS_PER_DAY = 2

export function usePacks(userId: string | undefined) {
  const [stickers, setStickers]             = useState<DbSticker[]>([])
  const [userStickers, setUserStickers]     = useState<Map<string, number>>(new Map())
  const [loading, setLoading]               = useState(false)
  const [claiming, setClaiming]             = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [packsRemaining, setPacksRemaining] = useState<number>(MAX_PACKS_PER_DAY)

  // Fetch full sticker catalog
  const fetchStickers = useCallback(async () => {
    const { data } = await supabase.from('stickers').select('*').order('id')
    if (data) setStickers(data)
  }, [])

  useEffect(() => {
    fetchStickers()

    // Realtime: atualiza catálogo quando admin edita/cria/remove figurinhas
    const channel = supabase
      .channel('stickers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stickers' }, fetchStickers)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchStickers])

  // Fetch server-side pack status (removes localStorage dependency)
  const fetchPackStatus = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.rpc('get_pack_status', { p_user_id: userId })
    if (data) {
      setPacksRemaining(data.packs_remaining ?? MAX_PACKS_PER_DAY)
    }
  }, [userId])

  // Fetch user inventory
  const fetchInventory = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('user_stickers')
      .select('sticker_id, quantity')
      .eq('user_id', userId)
    if (data) {
      setUserStickers(new Map(data.map((s: DbUserSticker) => [s.sticker_id, s.quantity])))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchInventory()
    fetchPackStatus()
  }, [fetchInventory, fetchPackStatus])

  // Claim daily pack via Edge Function
  const claimDailyPack = useCallback(async (): Promise<DbSticker[] | null> => {
    if (!userId) return null
    setClaiming(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/claim-daily-pack`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 429 || json.error === 'PACK_LIMIT_REACHED') {
          setPacksRemaining(0)
          setError('PACK_LIMIT_REACHED')
        } else {
          setError(json.error ?? 'Failed to claim pack')
        }
        return null
      }

      // Update remaining packs from server response
      if (typeof json.packs_remaining === 'number') {
        setPacksRemaining(json.packs_remaining)
      }

      // Refresh inventory
      await fetchInventory()
      return json.stickers as DbSticker[]
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      return null
    } finally {
      setClaiming(false)
    }
  }, [userId, fetchInventory])

  const ownedIds: string[] = Array.from(userStickers.keys())
  const uniqueOwned = ownedIds.length
  const totalStickers = stickers.length

  return {
    stickers,
    userStickers,
    ownedIds,
    uniqueOwned,
    totalStickers,
    loading,
    claiming,
    error,
    packsRemaining,
    maxPacksPerDay: MAX_PACKS_PER_DAY,
    claimDailyPack,
    refetchInventory: fetchInventory,
    refetchPackStatus: fetchPackStatus,
  }
}
