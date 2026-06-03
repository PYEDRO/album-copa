import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users, Activity, Package, Star, Shield, UserX,
  RefreshCw, ChevronUp, ChevronDown, Loader2, BarChart3,
  CheckCircle2, XCircle, Clock, Trophy, ImageIcon,
} from 'lucide-react'
import { useAdmin, type AdminUser } from '../hooks/useAdmin'

// ── Metric Card ──────────────────────────────────────────────
const MetricCard = ({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; sub?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-5"
  >
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={28} className="text-white" />
    </div>
    <div>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-3xl font-black text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
)

// ── Role Badge ───────────────────────────────────────────────
const RoleBadge = ({ role }: { role: 'USER' | 'ADMIN' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
    role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
  }`}>
    {role === 'ADMIN' && <Shield size={9} />}
    {role}
  </span>
)

// ── Main Component ───────────────────────────────────────────
export default function AdminDashboard() {
  const admin = useAdmin()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof AdminUser>('score')
  const [sortAsc, setSortAsc] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'promote' | 'demote' | 'reset'; userId: string; name: string
  } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [approvalLoading, setApprovalLoading] = useState<string | null>(null)
  // Override manual de avatar
  const [avatarEdit, setAvatarEdit] = useState<{ userId: string; name: string } | null>(null)
  const [avatarInput, setAvatarInput] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)

  const openAvatarEditor = (userId: string, name: string, current: string | null) => {
    setAvatarInput(current ?? '')
    setAvatarEdit({ userId, name })
  }

  // Upload de arquivo do computador → Storage → grava no perfil (igual cartinhas)
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reenviar o mesmo arquivo
    if (!file || !avatarEdit) return
    setAvatarUploading(true)
    const url = await admin.uploadUserAvatar(file, avatarEdit.userId)
    if (!url) { setAvatarUploading(false); alert('Falha no upload da imagem.'); return }
    setAvatarInput(url) // mostra no preview
    const err = await admin.setUserAvatar(avatarEdit.userId, url) // já persiste
    setAvatarUploading(false)
    if (err) { alert('Erro ao salvar avatar: ' + err.message); return }
  }

  const saveAvatar = async () => {
    if (!avatarEdit) return
    setAvatarSaving(true)
    const err = await admin.setUserAvatar(avatarEdit.userId, avatarInput)
    setAvatarSaving(false)
    if (err) { alert('Erro ao salvar avatar: ' + err.message); return }
    setAvatarEdit(null)
  }

  const handleSort = (key: keyof AdminUser) => {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = admin.users
    .filter(u => u.approved !== false) // exclui pendentes da tabela principal
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortAsc
        ? (av < bv ? -1 : av > bv ? 1 : 0)
        : (av > bv ? -1 : av < bv ? 1 : 0)
    })

  const SortIcon = ({ col }: { col: keyof AdminUser }) =>
    sortKey === col
      ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : <ChevronDown size={12} className="opacity-20" />

  const runAction = async () => {
    if (!confirmAction) return
    setActionLoading(confirmAction.userId)
    setConfirmAction(null)
    const { type, userId } = confirmAction
    if (type === 'promote') await admin.promoteUser(userId)
    else if (type === 'demote') await admin.demoteUser(userId)
    else await admin.resetUserCollection(userId)
    setActionLoading(null)
    await admin.fetchMetrics()
  }

  const handleApprove = async (userId: string) => {
    setApprovalLoading(userId)
    await admin.approveUser(userId)
    setApprovalLoading(null)
  }

  const handleReject = async (userId: string) => {
    setApprovalLoading(userId)
    await admin.rejectUser(userId)
    setApprovalLoading(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-red-600">
            Admin Dashboard
          </h2>
          <p className="text-slate-400 font-medium mt-1">
            Monitoramento de uso e gestão de usuários
          </p>
        </div>
        <button
          onClick={() => { admin.fetchMetrics(); admin.fetchUsers(); admin.fetchWinners() }}
          disabled={admin.loading}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-black text-sm transition-all disabled:opacity-50"
        >
          {admin.loading
            ? <Loader2 size={16} className="animate-spin" />
            : <RefreshCw size={16} />}
          Atualizar
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Usuários" value={admin.metrics.totalUsers}
          icon={Users} color="bg-blue-500" />
        <MetricCard label="Ativos Hoje" value={admin.metrics.activeToday}
          icon={Activity} color="bg-emerald-500" sub="packs abertos hoje" />
        <MetricCard label="Ativos 7d" value={admin.metrics.activeLast7Days}
          icon={BarChart3} color="bg-violet-500" sub="últimos 7 dias" />
        <MetricCard label="Packs Hoje" value={admin.metrics.packsOpenedToday}
          icon={Package} color="bg-amber-500" />
        <MetricCard label="Figurinhas" value={admin.metrics.totalStickersIssued}
          icon={Star} color="bg-red-500" sub="total distribuídas" />
        <MetricCard label="Catálogo" value={admin.metrics.uniqueStickers}
          icon={Star} color="bg-slate-600" sub="figurinhas únicas" />
      </div>

      {/* ── 🏆 Vencedores do Álbum ───────────────────────────── */}
      <AnimatePresence>
        {admin.winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-2xl overflow-hidden shadow-md"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-yellow-200 bg-yellow-100">
              <Trophy size={20} className="text-yellow-600" />
              <h3 className="text-base font-black italic uppercase tracking-tighter text-yellow-800">
                Álbum Completo — Vencedores!
              </h3>
              <span className="ml-auto bg-yellow-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {admin.winners.length}
              </span>
            </div>
            <div className="divide-y divide-yellow-100">
              {admin.winners.map(winner => (
                <div key={winner.id} className="flex items-center justify-between px-6 py-4 gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 text-white font-black text-sm shadow-sm">
                      {winner.position}º
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                        {winner.name}
                        {winner.position === 1 && <span className="text-yellow-600">🏆 1º lugar</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Completou {winner.total_stickers} figurinhas em{' '}
                        {new Date(winner.completed_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {!winner.acknowledged && (
                    <button
                      onClick={() => admin.acknowledgeWinner(winner.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-black text-xs uppercase transition-all shadow-sm"
                    >
                      <CheckCircle2 size={14} />
                      Marcar como visto
                    </button>
                  )}
                  {winner.acknowledged && (
                    <span className="text-[10px] font-black uppercase text-yellow-600/70 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Visto
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Aprovações Pendentes ─────────────────────────────── */}
      <AnimatePresence>
        {admin.pendingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-200 bg-amber-100">
              <Clock size={20} className="text-amber-600" />
              <h3 className="text-base font-black italic uppercase tracking-tighter text-amber-800">
                Aprovações Pendentes
              </h3>
              <span className="ml-auto bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {admin.pendingUsers.length}
              </span>
            </div>
            <div className="divide-y divide-amber-100">
              {admin.pendingUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between px-6 py-4 gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`; } }}
                      className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-200 object-cover"
                    />
                    <div>
                      <p className="font-black text-slate-800 text-sm">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Cadastrado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {approvalLoading === user.id ? (
                      <Loader2 size={18} className="animate-spin text-amber-500" />
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase transition-all shadow-sm"
                        >
                          <CheckCircle2 size={14} />
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-black text-xs uppercase transition-all"
                        >
                          <XCircle size={14} />
                          Rejeitar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-800">
            Usuários Ativos ({filtered.length})
          </h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 w-64 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest font-black text-slate-400">
                {([
                  ['name',           'Nome'],
                  ['role',           'Papel'],
                  ['total_stickers', 'Figurinhas'],
                  ['packs_opened',   'Packs'],
                  ['score',          'Score'],
                  ['last_pack_at',   'Último Pack'],
                ] as [keyof AdminUser, string][]).map(([col, lbl]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="text-left px-6 py-3 cursor-pointer hover:text-red-600 transition-colors select-none whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">{lbl} <SortIcon col={col} /></span>
                  </th>
                ))}
                <th className="text-left px-6 py-3 whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-300 font-black italic uppercase">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`; } }}
                        className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 object-cover"
                      />
                      <span className="font-bold text-slate-800 truncate max-w-[160px]">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                  <td className="px-6 py-4 font-black text-slate-700">{user.total_stickers}</td>
                  <td className="px-6 py-4 font-black text-slate-700">{user.packs_opened}</td>
                  <td className="px-6 py-4 font-black text-red-600">{user.score}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                    {user.last_pack_at
                      ? new Date(user.last_pack_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {actionLoading === user.id ? (
                      <Loader2 size={16} className="animate-spin text-red-400" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {user.role === 'USER' ? (
                          <button
                            onClick={() => setConfirmAction({ type: 'promote', userId: user.id, name: user.name })}
                            title="Promover a Admin"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Shield size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmAction({ type: 'demote', userId: user.id, name: user.name })}
                            title="Remover Admin"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-red-500 hover:text-slate-600 transition-colors"
                          >
                            <Shield size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openAvatarEditor(user.id, user.name, user.avatar_url)}
                          title="Editar foto (override manual)"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <ImageIcon size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'reset', userId: user.id, name: user.name })}
                          title="Resetar coleção"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <UserX size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avatar Override Modal */}
      {avatarEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setAvatarEdit(null)} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 z-10 space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-blue-100">
                <ImageIcon size={28} className="text-blue-600" />
              </div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Editar Foto</h4>
              <p className="text-slate-500 text-sm font-medium">{avatarEdit.name}</p>
            </div>

            {/* Preview */}
            <div className="flex justify-center">
              <img
                src={avatarInput.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarEdit.name)}`}
                alt="preview"
                referrerPolicy="no-referrer"
                onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarEdit.name)}`; } }}
                className="w-20 h-20 rounded-full border-2 border-slate-200 bg-slate-50 object-cover"
              />
            </div>

            {/* Upload de arquivo (igual às figurinhas) */}
            <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
            <button
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              disabled={avatarUploading || avatarSaving}
              className="w-full py-3 border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl text-xs font-black uppercase text-blue-500 hover:text-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {avatarUploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
              {avatarUploading ? 'Enviando...' : 'Enviar foto do computador'}
            </button>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ou cole uma URL</label>
              <input
                value={avatarInput}
                onChange={e => setAvatarInput(e.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <p className="text-[10px] text-slate-400">Envie um arquivo ou cole a URL. Deixe em branco e salve para voltar ao avatar gerado.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAvatarEdit(null)}
                disabled={avatarSaving}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-black uppercase text-xs text-slate-600 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveAvatar}
                disabled={avatarSaving}
                className="flex-1 py-3 rounded-xl font-black uppercase text-xs text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {avatarSaving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 z-10 text-center space-y-6"
          >
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
              confirmAction.type === 'reset' ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {confirmAction.type === 'reset'
                ? <UserX size={28} className="text-red-600" />
                : <Shield size={28} className="text-blue-600" />}
            </div>
            <div>
              <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                {confirmAction.type === 'promote' && 'Promover a Admin'}
                {confirmAction.type === 'demote'  && 'Remover Admin'}
                {confirmAction.type === 'reset'   && 'Resetar Coleção'}
              </h4>
              <p className="text-slate-500 text-sm mt-2 font-medium">
                {confirmAction.type === 'promote' &&
                  `Dar acesso de admin para ${confirmAction.name}?`}
                {confirmAction.type === 'demote' &&
                  `Remover acesso de admin de ${confirmAction.name}?`}
                {confirmAction.type === 'reset' &&
                  `Apagar todas as figurinhas de ${confirmAction.name}? Esta ação não pode ser desfeita.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 font-black uppercase text-xs text-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={runAction}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-xs text-white transition-all ${
                  confirmAction.type === 'reset'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
