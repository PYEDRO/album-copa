import React from 'react'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'

interface Props {
  onEnter: () => void
}

const Spiral = ({ side }: { side: 'left' | 'right' }) => {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-4 sm:left-8' : 'right-4 sm:right-8'} flex flex-col gap-1 pointer-events-none`}>
      {colors.map((color, i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.07, duration: 0.4 }}
          style={{ backgroundColor: color }}
          className="w-3 h-8 sm:w-4 sm:h-10 rounded-full"
        />
      ))}
    </div>
  )
}

const CoverCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 40, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, type: 'spring', stiffness: 60 }}
    className="relative w-[240px] sm:w-[280px] bg-white rounded-[28px] shadow-2xl overflow-hidden border-4 border-white"
    style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}
  >
    {/* top gradient stripe */}
    <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)' }} />

    {/* card inner */}
    <div className="px-5 pt-4 pb-5">
      {/* header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[7px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none">Álbum</p>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-800 leading-none mt-0.5">Fanfortes</p>
        </div>
        <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-[11px]">F</span>
        </div>
      </div>

      {/* arch panel */}
      <div className="relative mx-auto w-full bg-slate-50 rounded-t-[999px] rounded-b-2xl border border-slate-100 py-6 flex flex-col items-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #fff9e6 0%, #f8fafc 100%)' }}>
        {/* watermark */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[52px] font-black italic uppercase tracking-tighter select-none pointer-events-none"
          style={{ color: 'rgba(239,68,68,0.08)', zIndex: 0 }}
        >COPA</span>

        {/* trophy icon */}
        <div className="relative z-10 mb-1">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* cup body */}
            <path d="M14 6h24v18c0 8-6 13-12 14C20 37 14 32 14 24V6Z" fill="url(#tgold)" />
            {/* handles */}
            <path d="M14 10H8a4 4 0 000 8h6" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M38 10h6a4 4 0 010 8h-6" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* stem */}
            <rect x="23" y="37" width="6" height="7" fill="#d97706" rx="1" />
            {/* base */}
            <rect x="17" y="44" width="18" height="3" rx="1.5" fill="#b45309" />
            {/* shine */}
            <ellipse cx="21" cy="14" rx="2" ry="5" fill="rgba(255,255,255,0.35)" transform="rotate(-15 21 14)" />
            <defs>
              <linearGradient id="tgold" x1="14" y1="6" x2="38" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fde68a" />
                <stop offset="0.4" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* text */}
        <p className="relative z-10 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 leading-none">Copa</p>
        <p className="relative z-10 text-[20px] font-black italic uppercase tracking-tighter text-red-600 leading-tight">Fanfortes</p>
        <div className="relative z-10 w-10 h-0.5 bg-slate-800 my-1.5 rounded-full" />
        <p className="relative z-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 leading-none">2026</p>
      </div>

      {/* bottom text */}
      <div className="mt-4 text-center">
        <p className="text-[28px] font-black italic uppercase tracking-tighter text-red-600 leading-none">Talentos</p>
      </div>
    </div>
  </motion.div>
)

export default function SplashScreen({ onEnter }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 100%)' }}>

      {/* background glow blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-red-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {/* spirals */}
      <Spiral side="left" />
      <Spiral side="right" />

      {/* center content */}
      <div className="flex flex-col items-center gap-8 z-10 px-4">
        <CoverCard />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <button
            onClick={onEnter}
            className="group flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-widest text-sm transition-all shadow-xl hover:scale-105 active:scale-95 border-2 border-red-800"
          >
            Acessar o Álbum
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            Copa Fanfortes · Talentos 2026
          </p>
        </motion.div>
      </div>
    </div>
  )
}
