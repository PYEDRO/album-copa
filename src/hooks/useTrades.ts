import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbTrade } from '../lib/supabase'

export function useTrades(userId: string | undefined) {
  const [trades, setTrades]     = useState<DbTrade[]>([])
  const [loading, setLoading]   = useState(false)
  const [acting, setActing]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const fetchTrades = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    if (data) setTrades(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchTrades()

    if (!userId) return
    const channel = supabase
      .channel(`trades-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, fetchTrades)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchTrades])

  // Propose a new trade
  const proposeTrade = useCallback(async (
    toUserId: string,
    offeredStickerIds: string[],
    requestedStickerIds: string[],
  ) => {
    setActing(true)
    setError(null)
    const { error } = await supabase.from('trades').insert({
      from_user_id: userId,
      to_user_id: toUserId,
      offered_sticker_ids: offeredStickerIds,
      requested_sticker_ids: requestedStickerIds,
    })
    if (error) setError(error.message)
    else await fetchTrades()
    setActing(false)
    return !error
  }, [userId, fetchTrades])

  // Accept trade via Edge Function (atomic)
  const acceptTrade = useCallback(async (tradeId: string) => {
    setActing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/accept-trade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tradeId }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Trade failed')
        return false
      }

      await fetchTrades()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setActing(false)
    }
  }, [fetchTrades])

  // Reject or cancel
  const updateTradeStatus = useCallback(async (
    tradeId: string,
    status: 'rejected' | 'cancelled',
  ) => {
    setActing(true)
    const { error } = await supabase
      .from('trades')
      .update({ status })
      .eq('id', tradeId)
    if (error) setError(error.message)
    else await fetchTrades()
    setActing(false)
    return !error
  }, [fetchTrades])

  const pendingReceived = trades.filter(t => t.to_user_id === userId && t.status === 'pending')
  const pendingSent     = trades.filter(t => t.from_user_id === userId && t.status === 'pending')

  return {
    trades,
    pendingReceived,
    pendingSent,
    loading,
    acting,
    error,
    proposeTrade,
    acceptTrade,
    updateTradeStatus,
    refetch: fetchTrades,
  }
}
