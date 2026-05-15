import { useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, ChevronLeft, Clock, AlertTriangle } from 'lucide-react'
import type { useAuth } from '../hooks/useAuth'

interface Props {
  onAuth: ReturnType<typeof useAuth>
  onBack?: () => void
}

const CORPORATE_DOMAIN = (import.meta as any).env?.VITE_CORPORATE_DOMAIN ?? 'fortestecnologia.com.br'

export default function AuthModal({ onAuth, onBack }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ── Tela: aguardando aprovação do admin ──────────────────────
  if (onAuth.isPending) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 60 }}
          className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-red-900/40 relative z-10 p-10 text-center space-y-6"
        >
          <div className="h-1.5 w-full absolute top-0 left-0" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)' }} />
          <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-200 flex items-center justify-center mx-auto mt-4">
            <Clock size={36} className="text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Aguardando Aprovação</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Sua conta foi criada com sucesso! Um administrador precisa aprovar o seu acesso antes de continuar.
            </p>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
              Você receberá acesso em breve.
            </p>
          </div>
          <button
            onClick={() => onAuth.signOut()}
            className="text-slate-400 hover:text-red-600 font-black uppercase text-xs tracking-widest transition-colors"
          >
            Sair
          </button>
        </motion.div>
      </div>
    )
  }

  // ── Handler Google OAuth ─────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setPending(true)
    setError(null)
    try {
      const { error } = await onAuth.signInWithGoogle()
      if (error) setError(error.message)
      // sucesso → browser redireciona para o Google automaticamente
    } finally {
      setPending(false)
    }
  }

  // ── Tela principal de login ──────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%)' }}
    >
      {/* glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 60 }}
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-red-900/40 relative z-10"
      >
        {/* stripe */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)' }} />

        {/* Header */}
        <div
          className="relative px-8 py-8 text-center"
          style={{ background: 'linear-gradient(160deg, #dc2626 0%, #991b1b 100%)' }}
        >
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-red-200 hover:text-white hover:bg-red-800/40 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* mini trophy icon */}
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center border-2 border-red-900/30 shadow-lg overflow-hidden rotate-3">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg,#ef4444,#f97316,#eab308)' }} />
              <svg width="32" height="32" viewBox="0 0 52 52" fill="none">
                <path d="M14 6h24v18c0 8-6 13-12 14C20 37 14 32 14 24V6Z" fill="url(#hgold2)" />
                <path d="M14 10H8a4 4 0 000 8h6" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M38 10h6a4 4 0 010 8h-6" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <rect x="23" y="37" width="6" height="7" fill="#d97706" rx="1" />
                <rect x="17" y="44" width="18" height="3" rx="1.5" fill="#b45309" />
                <defs>
                  <linearGradient id="hgold2" x1="14" y1="6" x2="38" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fde68a" /><stop offset="0.4" stopColor="#f59e0b" /><stop offset="1" stopColor="#b45309" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-tight">
            Copa Fanfortes
          </h1>
          <p className="text-red-200 text-[10px] font-black tracking-[0.2em] uppercase mt-1">
            Álbum Oficial de Talentos · 2026
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-8 space-y-5 bg-white">

          <div className="text-center space-y-1">
            <p className="text-slate-700 font-black uppercase tracking-widest text-xs">Acesso Corporativo</p>
            <p className="text-slate-400 text-xs font-medium">
              Use sua conta <span className="font-black text-red-500">@{CORPORATE_DOMAIN}</span> para entrar
            </p>
          </div>

          {/* Erro de domínio (retorno OAuth com conta errada) */}
          {onAuth.domainError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl text-xs font-bold border-2 flex items-start gap-2 bg-red-50 border-red-200 text-red-600"
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {onAuth.domainError}
            </motion.div>
          )}

          {/* Erro genérico */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl text-xs font-bold border-2 flex items-start gap-2 bg-red-50 border-red-200 text-red-600"
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}

          {/* Botão Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={pending}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-black text-sm text-slate-700 shadow-md hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={20} className="animate-spin text-slate-400" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            {pending ? 'Redirecionando...' : 'Entrar com Google Corporativo'}
          </button>

          <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 pt-2">
            Copa Fanfortes 2026 · Acesso restrito a colaboradores
          </p>
        </div>
      </motion.div>
    </div>
  )
}
