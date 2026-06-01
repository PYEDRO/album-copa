import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, type DbLeaderboardEntry } from '../lib/supabase'

// Polling a cada 60s — ranking não precisa de atualização em tempo real
const POLL_INTERVAL_MS = 60_000

export function useLeaderboard() {
  const [entries, setEntries] = useState<DbLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const isFetching = useRef(false)

  /** Lê o cache já calculado (leitura simples, sem RPC pesado) */
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

  /** Recalcula o ranking no banco (RPC) — só chamado pelo botão manual */
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
    // Carga inicial: só lê o cache, sem recalcular
    fetchLeaderboard()

    // Polling leve como fallback (sem WebSocket para evitar erros no StrictMode)
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  return { entries, loading, refreshing, refetch: fetchLeaderboard, forceRefresh }
}
