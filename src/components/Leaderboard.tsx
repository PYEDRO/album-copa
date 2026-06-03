import React from 'react'
import { motion } from 'motion/react'
import { Trophy, Loader2, Crown, Medal, RefreshCw } from 'lucide-react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import type { DbProfile } from '../lib/supabase'

interface Props {
  currentUser: DbProfile | null
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Crown size={18} className="text-yellow-500" />,
  2: <Medal size={18} className="text-slate-400" />,
  3: <Medal size={18} className="text-orange-400" />,
}

export default function Leaderboard({ currentUser }: Props) {
  const { entries, loading, refreshing, forceRefresh } = useLeaderboard()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={40} className="animate-spin text-red-300" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-20 h-20 bg-red-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl border-4 border-red-400 mx-auto">
          <Trophy className="text-white" size={36} />
        </div>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter text-red-600">
          Hall of Fame
        </h2>
        <p className="text-slate-400 font-medium text-sm">
          Top 100 coletores — atualizado a cada 30 segundos
        </p>
        <button
          onClick={forceRefresh}
          disabled={refreshing}
          className="mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Atualizando...' : 'Atualizar Ranking'}
        </button>
      </div>

      {/* Podium (top 3) */}
      {entries.length >= 3 && (
        <div className="flex items-end justify-center gap-4 pt-4">
          {[entries[1], entries[0], entries[2]].map((e, i) => {
            const heights = ['h-24', 'h-32', 'h-20']
            const colors  = ['bg-slate-200', 'bg-yellow-400', 'bg-orange-300']
            const ranks   = [2, 1, 3]
            return (
              <div key={e.user_id} className="flex flex-col items-center gap-2">
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-700 max-w-[80px] truncate">
                    {e.name}
                  </p>
                  <p className="text-red-600 font-black text-sm">{e.score}pts</p>
                </div>
                <div className={`w-20 ${heights[i]} ${colors[i]} rounded-t-2xl flex items-start justify-center pt-2 border-2 border-white shadow-lg`}>
                  <span className="text-2xl font-black text-white">#{ranks[i]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full list */}
      <div className="bg-white rounded-[32px] border-4 border-red-100 overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-red-50 border-b-2 border-red-100 grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span className="col-span-1">#</span>
          <span className="col-span-5">Jogador</span>
          <span className="col-span-3 text-right">Figurinhas</span>
          <span className="col-span-3 text-right">Pontos</span>
        </div>

        <div className="divide-y divide-slate-50">
          {entries.map((entry, idx) => {
            const isSelf = entry.user_id === currentUser?.id
            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                className={`px-6 py-4 grid grid-cols-12 items-center transition-colors ${
                  isSelf ? 'bg-red-50 border-l-4 border-red-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="col-span-1 flex items-center">
                  {RANK_ICONS[entry.rank] ?? (
                    <span className="text-sm font-black text-slate-400">#{entry.rank}</span>
                  )}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <img
                    src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.name)}`}
                    alt={entry.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.name)}`; } }}
                    className={`w-8 h-8 rounded-full object-cover border-2 ${
                      isSelf ? 'border-red-600' : 'border-slate-200'
                    }`}
                  />
                  <span className={`text-sm font-bold truncate max-w-[120px] ${isSelf ? 'text-red-700' : 'text-slate-700'}`}>
                    {entry.name} {isSelf && <span className="text-[9px] text-red-400 font-black">(você)</span>}
                  </span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm font-black text-slate-500">{entry.total_stickers}</span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-sm font-black text-red-600">{entry.score}</span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {entries.length === 0 && (
          <div className="py-16 text-center text-slate-400 font-medium">
            Nenhum jogador no ranking ainda. Seja o primeiro!
          </div>
        )}
      </div>
    </div>
  )
}
