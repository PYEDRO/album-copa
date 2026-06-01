import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, type DbLeaderboardEntry } from '../lib/supabase'

// Intervalo de polling em ms — 10s como fallback
const POLL_INTERVAL_MS = 10_000

export function useLeaderboard() {
  const [entries, setEntries] = useState<DbLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const initialized = useRef(false)
  const isFetching = useRef(false)

  /** Busca o cache local (leaderboard_cache) */
  const fetchLeaderboard = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const { data } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .order('rank', { ascending: true })
        .limit(100)
      if (data) {
        setEntries(data)
        setLoading(false)
      }
    } finally {
      isFetching.current = false
    }
  }, [])

  /** Força recalcular o ranking no banco (RPC) e depois busca os dados atualizados */
  const forceRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await supabase.rpc('refresh_leaderboard')
      await fetchLeaderboard()
    } finally {
      setRefreshing(false)
    }
  }, [fetchLeaderboard])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      // Na primeira carga, força refresh para garantir dados atuais
      forceRefresh()
    }

    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_cache' },
        () => { fetchLeaderboard() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stickers' },
        () => { fetchLeaderboard() },
      )
      .subscribe()

    const fallbackInterval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallbackInterval)
    }
  }, [fetchLeaderboard, forceRefresh])

  return { entries, loading, refreshing, refetch: fetchLeaderboard, forceRefresh }
}
