import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, type DbLeaderboardEntry } from '../lib/supabase'

// Intervalo de polling em ms — 5s para atualizações mais rápidas
const POLL_INTERVAL_MS = 5_000

export function useLeaderboard() {
  const [entries, setEntries] = useState<DbLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  // Evita múltiplas requisições simultâneas
  const isFetching = useRef(false)

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

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      fetchLeaderboard()
    }

    // Supabase Realtime: reage imediatamente a qualquer mudança na tabela
    // Requer Replication habilitado no Supabase Studio para essa tabela
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_cache' },
        () => { fetchLeaderboard() },
      )
      // Também escuta mudanças em user_stickers para refletir novo pack instantaneamente
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stickers' },
        () => { fetchLeaderboard() },
      )
      .subscribe()

    // Polling de 5s como fallback (caso Realtime não esteja habilitado no plano)
    const fallbackInterval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallbackInterval)
    }
  }, [fetchLeaderboard])

  return { entries, loading, refetch: fetchLeaderboard }
}
