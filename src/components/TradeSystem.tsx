import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeftRight, Check, X, Loader2, ChevronRight, Plus, Copy, CheckCheck, Users } from 'lucide-react'
import { useTrades } from '../hooks/useTrades'
import { supabase } from '../lib/supabase'
import type { DbSticker, DbTrade } from '../lib/supabase'

interface Props {
  userId: string
  userStickers: Map<string, number>
  allStickers: DbSticker[]
  tradesHook: ReturnType<typeof useTrades>
}

const RARITY_COLORS: Record<string, string> = {
  common:    'bg-slate-100 text-slate-600',
  rare:      'bg-blue-100 text-blue-700',
  epic:      'bg-purple-100 text-purple-700',
  legendary: 'bg-yellow-100 text-yellow-700',
}

const RARITY_BORDER: Record<string, string> = {
  common:    'border-slate-200',
  rare:      'border-blue-300',
  epic:      'border-purple-300',
  legendary: 'border-yellow-400',
}

// ── Tipos ────────────────────────────────────────────────────
interface UserWithDups {
  id: string
  name: string
  duplicateCount: number
  stickerIds: string[]
}

// ── StickerBadge ─────────────────────────────────────────────
const StickerBadge: React.FC<{ stickerId: string; allStickers: DbSticker[] }> = ({
  stickerId, allStickers,
}) => {
  const s = allStickers.find(x => x.id === stickerId)
  if (!s) return <span className="text-xs text-slate-400">#{stickerId}</span>
  return (
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${RARITY_COLORS[s.rarity] ?? ''}`}>
      {s.name}
    </span>
  )
}

// ── StickerThumb — miniatura da figurinha ─────────────────────
const StickerThumb: React.FC<{ stickerId: string; allStickers: DbSticker[] }> = ({
  stickerId, allStickers,
}) => {
  const s = allStickers.find(x => x.id === stickerId)
  if (!s) return null
  return (
    <div className={`w-12 h-14 rounded-lg border-2 overflow-hidden flex-shrink-0 bg-white shadow-sm ${RARITY_BORDER[s.rarity] ?? 'border-slate-200'}`}>
      {s.image_url ? (
        <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
          <span className="text-[8px] font-black text-slate-300">#</span>
        </div>
      )}
    </div>
  )
}

// ── TradeCard ─────────────────────────────────────────────────
interface TradeCardProps {
  trade: DbTrade
  userId: string
  allStickers: DbSticker[]
  onAccept: () => void
  onReject: () => void
  onCancel: () => void
  acting: boolean
}

const TradeCard: React.FC<TradeCardProps> = ({
  trade, userId, allStickers, onAccept, onReject, onCancel, acting,
}) => {
  const isReceiver = trade.to_user_id === userId
  const isPending  = trade.status === 'pending'

  const statusStyles: Record<string, string> = {
    pending:   'bg-yellow-50 border-yellow-200 text-yellow-700',
    accepted:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    rejected:  'bg-red-50 border-red-200 text-red-700',
    cancelled: 'bg-slate-50 border-slate-200 text-slate-500',
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {isReceiver ? 'Recebida' : 'Enviada'}
        </span>
        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${statusStyles[trade.status]}`}>
          {trade.status}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Oferece</p>
          <div className="flex flex-wrap gap-1">
            {trade.offered_sticker_ids.map(id => (
              <StickerBadge key={id} stickerId={id} allStickers={allStickers} />
            ))}
          </div>
        </div>
        <ArrowLeftRight size={18} className="text-slate-300 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Pede</p>
          <div className="flex flex-wrap gap-1">
            {trade.requested_sticker_ids.map(id => (
              <StickerBadge key={id} stickerId={id} allStickers={allStickers} />
            ))}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex gap-2 pt-1">
          {isReceiver && (
            <button onClick={onAccept} disabled={acting}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aceitar
            </button>
          )}
          {isReceiver && (
            <button onClick={onReject} disabled={acting}
              className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              <X size={14} /> Recusar
            </button>
          )}
          {!isReceiver && (
            <button onClick={onCancel} disabled={acting}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── UserDupCard — card de usuário com repetidas ───────────────
const UserDupCard: React.FC<{
  user: UserWithDups
  allStickers: DbSticker[]
  onPropose: (userId: string) => void
}> = ({ user, allStickers, onPropose }) => {
  const thumbIds = user.stickerIds.slice(0, 4)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-slate-100 p-4 space-y-3 shadow-sm hover:shadow-md hover:border-red-200 transition-all"
    >
      {/* Usuário */}
      <div className="flex items-center gap-3">
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
          alt={user.name}
          className="w-10 h-10 rounded-full border-2 border-slate-100 bg-slate-50 flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
          <p className="text-[10px] font-bold text-slate-400">{user.duplicateCount} repetida{user.duplicateCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Miniaturas */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1 overflow-hidden">
          {thumbIds.map(id => (
            <StickerThumb key={id} stickerId={id} allStickers={allStickers} />
          ))}
          {user.stickerIds.length > 4 && (
            <div className="w-12 h-14 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-black text-slate-400">+{user.stickerIds.length - 4}</span>
            </div>
          )}
        </div>

        {/* Botão seta */}
        <button
          onClick={() => onPropose(user.id)}
          className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center flex-shrink-0 transition-all shadow-md hover:scale-110 active:scale-95"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Componente principal ──────────────────────────────────────
const USERS_PER_PAGE = 3

export default function TradeSystem({ userId, userStickers, allStickers, tradesHook }: Props) {
  const { trades, acting, error, acceptTrade, updateTradeStatus } = tradesHook

  const [showPropose, setShowPropose]     = useState(false)
  const [toUserId, setToUserId]           = useState('')
  const [offered, setOffered]             = useState<string[]>([])
  const [requested, setRequested]         = useState<string[]>([])
  const [proposing, setProposing]         = useState(false)
  const [copied, setCopied]               = useState(false)

  // Usuários com duplicatas
  const [usersWithDups, setUsersWithDups] = useState<UserWithDups[]>([])
  const [loadingUsers, setLoadingUsers]   = useState(false)
  const [showAllUsers, setShowAllUsers]   = useState(false)
  const [userPage, setUserPage]           = useState(0)

  // Busca usuários com figurinhas repetidas
  useEffect(() => {
    const fetchUsersWithDups = async () => {
      setLoadingUsers(true)
      try {
        const { data } = await supabase
          .from('user_stickers')
          .select('user_id, sticker_id, quantity, profiles(id, name)')
          .gt('quantity', 1)
          .neq('user_id', userId)

        if (data) {
          const byUser = new Map<string, UserWithDups>()
          for (const row of data as any[]) {
            const uid     = row.user_id
            const profile = row.profiles
            if (!byUser.has(uid)) {
              byUser.set(uid, {
                id: uid,
                name: profile?.name ?? 'Jogador',
                duplicateCount: 0,
                stickerIds: [],
              })
            }
            const u = byUser.get(uid)!
            u.duplicateCount += (row.quantity as number) - 1
            u.stickerIds.push(row.sticker_id)
          }
          setUsersWithDups(
            Array.from(byUser.values())
              .filter(u => u.duplicateCount >= 1)
              .sort((a, b) => b.duplicateCount - a.duplicateCount),
          )
        }
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsersWithDups()
  }, [userId])

  const copyId = () => {
    navigator.clipboard.writeText(userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const myStickers = allStickers.filter(s => (userStickers.get(s.id) ?? 0) > 0)

  const toggleSticker = (id: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const handlePropose = async () => {
    if (!toUserId || offered.length === 0 || requested.length === 0) return
    setProposing(true)
    await tradesHook.proposeTrade(toUserId, offered, requested)
    setShowPropose(false)
    setToUserId('')
    setOffered([])
    setRequested([])
    setProposing(false)
  }

  // Abre modal de proposta pré-preenchido com o ID do usuário
  const startTradeWith = (targetUserId: string) => {
    setToUserId(targetUserId)
    setShowPropose(true)
  }

  const pendingReceived = trades.filter(t => t.to_user_id === userId && t.status === 'pending')
  const pendingSent     = trades.filter(t => t.from_user_id === userId && t.status === 'pending')
  const history         = trades.filter(t => t.status !== 'pending')

  // Paginação dos usuários
  const displayedUsers  = showAllUsers ? usersWithDups : usersWithDups.slice(0, 9)
  const totalPages      = Math.ceil(displayedUsers.length / USERS_PER_PAGE)
  const pageUsers       = displayedUsers.slice(userPage * USERS_PER_PAGE, (userPage + 1) * USERS_PER_PAGE)

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-red-600">Trocas</h2>
          <p className="text-slate-400 text-sm font-medium">Negocie com outros jogadores</p>
        </div>
        <button
          onClick={() => setShowPropose(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg border-2 border-red-800"
        >
          <Plus size={16} /> Propor Troca
        </button>
      </div>

      {/* ── Meu ID ── */}
      <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Seu ID para trocas</p>
          <p className="text-xs font-mono text-slate-600 truncate">{userId}</p>
        </div>
        <button
          onClick={copyId}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
            copied
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-white border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'
          }`}
        >
          {copied ? <><CheckCheck size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 text-sm font-bold">{error}</div>
      )}

      {/* ── Trocas pendentes recebidas ── */}
      {pendingReceived.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
            <span className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]">
              {pendingReceived.length}
            </span>
            Aguardando sua resposta
          </h3>
          {pendingReceived.map(t => (
            <TradeCard key={t.id} trade={t} userId={userId} allStickers={allStickers}
              onAccept={() => acceptTrade(t.id)}
              onReject={() => updateTradeStatus(t.id, 'rejected')}
              onCancel={() => {}} acting={acting} />
          ))}
        </section>
      )}

      {/* ── Trocas enviadas ── */}
      {pendingSent.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Enviadas — aguardando</h3>
          {pendingSent.map(t => (
            <TradeCard key={t.id} trade={t} userId={userId} allStickers={allStickers}
              onAccept={() => {}} onReject={() => {}}
              onCancel={() => updateTradeStatus(t.id, 'cancelled')} acting={acting} />
          ))}
        </section>
      )}

      {/* ── Histórico ── */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Histórico</h3>
          {history.map(t => (
            <TradeCard key={t.id} trade={t} userId={userId} allStickers={allStickers}
              onAccept={() => {}} onReject={() => {}} onCancel={() => {}} acting={false} />
          ))}
        </section>
      )}

      {trades.length === 0 && !showPropose && (
        <div className="text-center py-16 bg-slate-50 rounded-[32px] border-4 border-dashed border-slate-200 space-y-4">
          <ArrowLeftRight size={40} className="text-slate-200 mx-auto" />
          <p className="text-slate-400 font-medium">Nenhuma troca ainda.</p>
          <button onClick={() => setShowPropose(true)}
            className="text-red-600 font-black text-sm uppercase italic flex items-center gap-1 mx-auto">
            Propor a primeira <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: USUÁRIOS PARA TROCAR
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-2 border-slate-100 rounded-[28px] p-6 shadow-sm space-y-5">

        {/* Cabeçalho da seção */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-red-600" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Usuários para Trocar</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Encontre jogadores que possuem figurinhas repetidas.</p>
          </div>
          {usersWithDups.length > 3 && (
            <button
              onClick={() => { setShowAllUsers(v => !v); setUserPage(0); }}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors"
            >
              {showAllUsers ? 'Ver menos' : 'Ver todos'}
              <motion.span animate={{ rotate: showAllUsers ? 180 : 0 }} className="inline-block">∨</motion.span>
            </button>
          )}
        </div>

        {/* Loading */}
        {loadingUsers && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-xs font-bold">Buscando jogadores...</span>
          </div>
        )}

        {/* Sem resultados */}
        {!loadingUsers && usersWithDups.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Users size={32} className="text-slate-200 mx-auto" />
            <p className="text-sm text-slate-400 font-medium">Nenhum jogador com repetidas no momento.</p>
          </div>
        )}

        {/* Grid de usuários (3 por página) */}
        {!loadingUsers && pageUsers.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={userPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {pageUsers.map(user => (
                <UserDupCard
                  key={user.id}
                  user={user}
                  allStickers={allStickers}
                  onPropose={startTradeWith}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Dots de paginação */}
        {!loadingUsers && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setUserPage(i)}
                className={`rounded-full transition-all ${
                  i === userPage
                    ? 'w-3 h-3 bg-red-600'
                    : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Modal Propor Troca ── */}
      <AnimatePresence>
        {showPropose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPropose(false)}
              className="absolute inset-0 bg-red-950/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              className="relative bg-white rounded-[32px] border-4 border-red-100 shadow-2xl p-8 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black italic uppercase text-red-600">Nova Troca</h3>
                <button onClick={() => setShowPropose(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    ID do destinatário
                  </label>
                  <input
                    type="text"
                    value={toUserId}
                    onChange={e => setToUserId(e.target.value)}
                    placeholder="UUID do usuário"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-red-400 outline-none text-sm font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">O outro jogador precisa compartilhar o UUID do perfil.</p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Você oferece (suas figurinhas)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                    {myStickers.map(s => (
                      <button key={s.id}
                        onClick={() => toggleSticker(s.id, offered, setOffered)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border-2 ${
                          offered.includes(s.id)
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
                        }`}
                      >
                        {s.name} {(userStickers.get(s.id) ?? 0) > 1 ? `(x${userStickers.get(s.id)})` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Você quer (do outro jogador)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                    {allStickers.map(s => (
                      <button key={s.id}
                        onClick={() => toggleSticker(s.id, requested, setRequested)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border-2 ${
                          requested.includes(s.id)
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handlePropose}
                  disabled={proposing || !toUserId || offered.length === 0 || requested.length === 0}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-black italic uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 border-red-800"
                >
                  {proposing ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeftRight size={18} />}
                  Enviar Proposta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
