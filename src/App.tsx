import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Book, Gamepad2, Package, Search, Trophy, ChevronRight, ChevronLeft,
  Sparkles, ArrowLeftRight, TrendingUp, LogOut,
  Flag, User, Loader2, BarChart3, ImagePlus,
} from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import AdminStickerEditor from './components/AdminStickerEditor';
import TradeSystem from './components/TradeSystem';
import { COLLABORATORS } from './constants';
import { Rarity, type Collaborator } from './types';
import { useAuth } from './hooks/useAuth';
import { usePacks } from './hooks/usePacks';
import { useLeaderboard } from './hooks/useLeaderboard';
import { useTrades } from './hooks/useTrades';
import { supabase, type DbSticker, type DbLeaderboardEntry } from './lib/supabase';
import AuthModal from './components/AuthModal';
import SplashScreen from './components/SplashScreen';

const STICKERS_PER_PAGE = 10;

function toCollaborator(s: DbSticker): Collaborator {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    team: s.team,
    rarity:
      s.rarity === 'legendary' ? Rarity.LEGENDARY
      : s.rarity === 'rare' || s.rarity === 'epic' ? Rarity.RARE
      : Rarity.COMMON,
    attributes: s.characteristics ?? { agility: 70, defense: 70, attack: 70 },
    achievements: s.achievements ?? [],
    imageUrl: s.image_url,
    bio: s.bio ?? '',
  };
}

const RobotMascot = ({ pageIndex, isPageComplete }: { pageIndex: number, isPageComplete?: boolean }) => {
  const phrases = isPageComplete
    ? ["Uau! Time completo!", "Que coleção incrível!", "Você é fera!", "Álbum de mestre!"]
    : ["Boa sorte no pack!", "Quase completando!", "Que figurinha top!", "Falta pouco agora!", "Rumo ao troféu!", "Show de bola!", "Incrível esse!", "Bora colecionar!"];
  const phrase = phrases[pageIndex % phrases.length];
  return (
    <motion.div initial={{ scale: 0, opacity: 0, x: 20 }} animate={{ scale: 1, opacity: 1, x: 0 }} whileHover={{ y: -8, scale: 1.1, rotate: 2 }} className="absolute -bottom-6 -right-6 z-30 hidden sm:block cursor-help drop-shadow-2xl">
      <div className="relative">
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 0.5 }} className="absolute -top-12 -left-20 bg-white text-slate-900 px-3 py-1.5 rounded-2xl rounded-br-none text-[8px] font-black uppercase shadow-2xl border-2 border-red-500/20 whitespace-nowrap z-40 transform -rotate-3">
          <div className="flex items-center gap-2"><span className="text-red-600">{phrase}</span><div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" /></div>
          <div className="absolute bottom-[-8px] right-2 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-white" />
        </motion.div>
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="50" height="35" rx="12" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" />
          <rect x="30" y="20" width="40" height="20" rx="6" fill="#1E293B" />
          <circle cx="40" cy="28" r="2" fill="#60A5FA" /><circle cx="60" cy="28" r="2" fill="#60A5FA" />
          <path d="M45 35 Q50 38 55 35" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M30 50 L70 50 L75 75 L25 75 Z" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
          <text x="50" y="68" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" style={{ fontStyle: 'italic' }}>F</text>
          <motion.g animate={{ rotate: [0, -30, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} style={{ transformOrigin: "30px 55px" }}>
            <path d="M30 55 L15 40" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
            <circle cx="15" cy="40" r="4" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
          </motion.g>
          <path d="M70 55 L82 62" stroke="#94A3B8" strokeWidth="5" strokeLinecap="round" />
          <g transform="translate(85, 70) scale(0.8)"><circle r="10" fill="white" stroke="#64748B" strokeWidth="1" /><circle r="3" fill="#1E293B" /></g>
          <rect x="35" y="75" width="8" height="12" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
          <rect x="57" y="75" width="8" height="12" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
          <rect x="32" y="85" width="12" height="5" rx="2.5" fill="#DC2626" />
          <rect x="56" y="85" width="12" height="5" rx="2.5" fill="#DC2626" />
        </svg>
      </div>
    </motion.div>
  );
};


const StickerCard = ({ collaborator, isCollected = true, onClick }: { collaborator: Collaborator; isCollected?: boolean; onClick?: () => void; key?: any; }) => {
  const isRare = collaborator.rarity === Rarity.RARE;
  const isLegendary = collaborator.rarity === Rarity.LEGENDARY;
  if (!isCollected) {
    return (
      <div className="flex flex-col gap-1.5 group">
        <div className="w-full aspect-[4/5] bg-slate-100 border-2 border-slate-200 rounded-lg flex items-center justify-center relative group transition-all shadow-inner overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[size:8px_8px]" />
          <div className="absolute inset-1.5 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center">
            <span className="text-xl font-black text-slate-200 italic tracking-tighter">#{collaborator.id}</span>
          </div>
        </div>
        <div className="h-1.5 bg-slate-100/50 w-1/2 mx-auto rounded-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 group">
      <motion.div layoutId={`card-${collaborator.id}`} whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.95 }} onClick={onClick}
        className={`relative w-full aspect-[4/5] rounded-lg overflow-hidden shadow-lg cursor-pointer transition-all duration-300 ${isLegendary ? 'bg-holographic' : isRare ? 'bg-gold-shiny animate-gold-glow' : 'bg-white'} border-2 ${isLegendary ? 'border-red-400' : isRare ? 'border-amber-300' : 'border-red-100'} ${isRare || isLegendary ? 'panini-shadow' : ''}`}>
        {(isRare || isLegendary) && <div className="absolute inset-0 shiny-overlay opacity-30 z-20 pointer-events-none" />}
        <div className={`absolute inset-0.5 rounded-md overflow-hidden flex flex-col p-1 ${isLegendary ? 'bg-white/90 backdrop-blur-sm' : isRare ? 'bg-gradient-to-b from-amber-50 to-white' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-0.5 px-0.5">
            <span className={`text-[4px] font-black uppercase tracking-widest leading-none ${isRare ? 'text-amber-800' : 'text-slate-400'}`}>{collaborator.team.split(' ')[0]}</span>
            <span className={`text-[5px] font-black ${isRare ? 'text-amber-600' : 'text-red-500'}`}>#{collaborator.id}</span>
          </div>
          <div className={`relative h-[55%] rounded border overflow-hidden mb-1 ${isRare ? 'border-amber-200 bg-amber-50' : 'border-slate-50 bg-slate-50'}`}>
            <img src={collaborator.imageUrl} alt={collaborator.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col gap-0 mb-0.5 min-h-0">
            <h3 className={`text-[7px] font-black uppercase tracking-tighter truncate leading-tight ${isRare ? 'text-amber-900' : 'text-slate-800'}`}>{collaborator.name}</h3>
            <p className={`text-[5px] font-bold uppercase leading-none truncate ${isRare ? 'text-amber-600' : 'text-slate-300'}`}>{collaborator.role}</p>
          </div>
          <div className="mt-auto pt-0.5 border-t border-slate-100/10">
            <div className="flex justify-between items-center text-[4px] uppercase font-black">
              <span className={isRare ? 'text-amber-600' : 'text-slate-300'}>{collaborator.team.split(' ')[0]}</span>
              <span className={isRare ? 'text-amber-500' : 'text-red-400'}>{collaborator.rarity === 'legendary' ? '★★★' : collaborator.rarity === 'rare' ? '★★' : '★'}</span>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="text-center px-0.5">
        <p className="text-[7px] font-black uppercase italic tracking-tighter text-slate-800 group-hover:text-red-600 transition-colors truncate">{collaborator.name}</p>
      </div>
    </div>
  );
};

const AlbumPage = ({ pageIndex, ownedStickers, onStickerClick, direction = 0, allStickers }: {
  pageIndex: number; ownedStickers: string[]; onStickerClick: (c: Collaborator) => void;
  direction?: number; allStickers: Collaborator[]; key?: any;
}) => {
  const startIdx = pageIndex * STICKERS_PER_PAGE;
  const pageStickers = allStickers.slice(startIdx, startIdx + STICKERS_PER_PAGE);
  const teamName = pageStickers[0]?.team || 'Seleção';
  const isPageComplete = pageStickers.length > 0 && pageStickers.every(s => ownedStickers.includes(s.id));
  return (
    <motion.div key={pageIndex}
      initial={{ opacity: 0, x: direction > 0 ? 100 : -100, rotateY: direction > 0 ? 45 : -45, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1, transition: { type: "spring", stiffness: 40, damping: 20, mass: 1.5 } }}
      exit={{ opacity: 0, x: direction > 0 ? -100 : 100, rotateY: direction > 0 ? -45 : 45, scale: 0.95, transition: { duration: 0.8, ease: "easeInOut" } }}
      style={{ perspective: 1200, transformOrigin: direction > 0 ? "left center" : "right center" }}
      className="relative bg-white min-h-[480px] md:min-h-[580px] h-full p-4 md:p-6 pt-10 overflow-visible flex flex-col w-full shadow-2xl rounded-[32px] border-2 border-slate-200 mx-auto max-w-2xl"
    >
      <motion.div initial={{ opacity: 0, x: '-100%' }} animate={{ x: '200%', opacity: [0, 0.2, 0] }} transition={{ duration: 1.5, ease: "easeInOut" }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-50 transform skew-x-12" />
      <div className="absolute inset-0 album-bg-pattern pointer-events-none opacity-20" />
      <div className="curled-corner scale-50 origin-top-right opacity-30" />
      <div className="relative z-10 flex flex-col h-full space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between border-b-2 border-red-600/30 pb-2 gap-2">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-base md:text-lg shadow-lg border-2 border-red-800 rotate-3 z-10 relative">{pageIndex + 1}</div>
            <div className="space-y-0 min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <Flag size={8} className={isPageComplete ? "text-amber-500 fill-amber-500" : "text-red-500 fill-red-500"} />
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Grupo {String.fromCharCode(65 + pageIndex)}</span>
                {isPageComplete && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-2 text-[6px] bg-amber-500 text-white px-1 py-0.5 rounded-full font-black uppercase tracking-tighter">Time Completo!</motion.span>}
              </div>
              <div className="flex gap-1">
                <span className="text-[5px] bg-red-600 text-white px-1 py-0.5 rounded font-black uppercase shadow-sm">Oficial</span>
                <div className="flex items-center gap-0.5 bg-emerald-600 text-white px-1 py-0.5 rounded font-black uppercase shadow-sm">
                  <User size={5} className="text-white" /><span className="text-[5px]">Copa Fanfortes</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-1 rounded-lg border border-slate-100 flex-shrink-0 shadow-sm">
            <div className="text-center px-1"><div className="text-[6px] font-black text-slate-400 uppercase leading-none">Copa</div><div className="text-xs font-black text-red-600 italic leading-none">Fanfortes</div></div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="text-center px-1"><div className="text-[6px] font-black text-slate-400 uppercase leading-none">Completo</div>
              <div className="text-xs font-black text-slate-800 leading-none">{Math.round((pageStickers.filter(c => ownedStickers.includes(c.id)).length / Math.max(pageStickers.length, 1)) * 100)}%</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 md:gap-3 overflow-visible relative">
          {pageStickers.map(c => (<StickerCard key={c.id} collaborator={c} isCollected={ownedStickers.includes(c.id)} onClick={() => onStickerClick(c)} />))}
        </div>
        <RobotMascot pageIndex={pageIndex} isPageComplete={isPageComplete} />
      </div>
    </motion.div>
  );
};

const RankingSection = ({ leaderboard, currentUserId }: { leaderboard: DbLeaderboardEntry[]; currentUserId?: string; }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
    <div className="text-center space-y-2">
      <h2 className="text-4xl font-black italic uppercase text-red-600 tracking-tighter">Ranking de Colecionadores</h2>
      <p className="text-slate-400 font-medium">Quem está mais perto de completar o álbum Fanfortes?</p>
    </div>
    <div className="bg-slate-50 rounded-[40px] border-4 border-red-100 p-8 shadow-inner">
      {leaderboard.length === 0 ? (
        <div className="py-16 text-center opacity-50 space-y-2">
          <Trophy className="mx-auto text-slate-300" size={32} />
          <p className="text-[10px] font-black uppercase text-slate-400">Nenhum colecionador ainda. Abra seu primeiro pack!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((entry, i) => {
            const isSelf = entry.user_id === currentUserId;
            return (
              <div key={entry.user_id} className={`flex items-center justify-between p-4 rounded-2xl transition-all ${isSelf ? 'bg-red-600 text-white shadow-xl scale-105' : 'bg-white border border-slate-100'}`}>
                <div className="flex items-center gap-4 md:gap-6">
                  <span className={`text-xl font-black italic w-8 ${isSelf ? 'text-white' : 'text-red-600'}`}>#{i + 1}</span>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.name)}`} alt={entry.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-200 bg-slate-50" />
                  <span className={`font-black uppercase tracking-tighter text-sm md:text-base ${isSelf ? 'text-white' : 'text-slate-800'}`}>{entry.name}{isSelf && <span className="ml-2 text-[9px] opacity-70">(você)</span>}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-xl font-black ${isSelf ? 'text-white' : 'text-red-600'}`}>{entry.total_stickers}</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isSelf ? 'text-red-200' : 'text-slate-400'}`}>FIGURINHAS</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </motion.div>
);


const MAX_GUESSES_PER_DAY = 3;

interface LocalGameStats { guessesRight: number; guessesTotal: number; lastGuessDate: string | null; dailyGuessCount: number; }
interface GameState { target: Collaborator | null; attemptsRemaining: number; options: Collaborator[]; feedback: string | null; won: boolean; canPlay: boolean; }

export default function App() {
  const auth = useAuth();
  const packs = usePacks(auth.user?.id);
  const { entries: leaderboard, refetch: refetchLeaderboard } = useLeaderboard();
  const tradesHook = useTrades(auth.user?.id);
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<'album'|'game'|'opening'|'ranking'|'trading'|'admin-dashboard'|'admin-stickers'>('album');
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [activePack, setActivePack] = useState<Collaborator[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<Collaborator | null>(null);
  const [localGameStats, setLocalGameStats] = useState<LocalGameStats>(() => {
    try {
      const s = localStorage.getItem('game_stats');
      const parsed = s ? JSON.parse(s) : {};
      return { guessesRight: 0, guessesTotal: 0, lastGuessDate: null, dailyGuessCount: 0, ...parsed };
    }
    catch { return { guessesRight: 0, guessesTotal: 0, lastGuessDate: null, dailyGuessCount: 0 }; }
  });

  // ── Pack status vem do servidor via usePacks ─────────────────
  const packsRemaining = packs.packsRemaining;
  const [gameState, setGameState] = useState<GameState>({ target: null, attemptsRemaining: 2, options: [], feedback: null, won: false, canPlay: true });

  useEffect(() => { localStorage.setItem('game_stats', JSON.stringify(localGameStats)); }, [localGameStats]);

  const allCollaborators = useMemo((): Collaborator[] => {
    const constantIds = new Set(COLLABORATORS.map(c => c.id));
    const dbExtras = packs.stickers
      .filter(s => !constantIds.has(s.id))
      .map(toCollaborator);
    return [...COLLABORATORS, ...dbExtras];
  }, [packs.stickers]);

  const TOTAL_PAGES = Math.ceil(allCollaborators.length / STICKERS_PER_PAGE);

  const paginate = (n: number) => { setDirection(n > currentPage ? 1 : -1); setCurrentPage(n); };

  const openPack = async () => {
    if (packsRemaining <= 0) {
      alert(`Você já resgatou ${packs.maxPacksPerDay} packs hoje! Volte amanhã.`);
      return;
    }
    const cards = await packs.claimDailyPack();
    if (!cards) {
      const err = (packs.error ?? '').toUpperCase();
      if (err.includes('PACK_LIMIT_REACHED')) {
        alert(`Você já resgatou ${packs.maxPacksPerDay} packs hoje! Volte amanhã.`);
      } else {
        alert('Erro ao abrir pack: ' + (packs.error || 'Tente novamente.'));
      }
      return;
    }
    setActivePack(cards.map(toCollaborator));
    setView('opening');
    // Atualiza ranking imediatamente após abrir pack
    refetchLeaderboard();
  };

  const startNewGame = () => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = localGameStats.lastGuessDate === today;
    const dailyCount = isToday ? (localGameStats.dailyGuessCount ?? 0) : 0;
    if (isToday && dailyCount >= MAX_GUESSES_PER_DAY) {
      setGameState(p => ({ ...p, feedback: `Você já jogou ${MAX_GUESSES_PER_DAY} vezes hoje! Volte amanhã.`, canPlay: false }));
      setView('game'); return;
    }
    const pool = allCollaborators.length > 0 ? allCollaborators : COLLABORATORS;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const opts = [target];
    while (opts.length < 4) { const o = pool[Math.floor(Math.random() * pool.length)]; if (!opts.find(x => x.id === o.id)) opts.push(o); }
    setGameState({ target, attemptsRemaining: 2, options: opts.sort(() => Math.random() - 0.5), feedback: null, won: false, canPlay: true });
    setView('game');
  };

  const submitGuess = (guessId: string) => {
    if (gameState.won || gameState.attemptsRemaining <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    if (guessId === gameState.target?.id) {
      setGameState(p => ({ ...p, won: true, feedback: 'Excelente! Você reconheceu o talento!' }));
      setLocalGameStats(p => {
        const isToday = p.lastGuessDate === today;
        return { ...p, guessesRight: p.guessesRight + 1, guessesTotal: p.guessesTotal + 1, lastGuessDate: today, dailyGuessCount: (isToday ? (p.dailyGuessCount ?? 0) : 0) + 1 };
      });
    } else {
      const rem = gameState.attemptsRemaining - 1;
      setGameState(p => ({ ...p, attemptsRemaining: rem, feedback: rem > 0 ? 'Tente novamente! Analise bem a bio e os atributos.' : `Era ${gameState.target?.name}!` }));
      if (rem === 0) setLocalGameStats(p => {
        const isToday = p.lastGuessDate === today;
        return { ...p, guessesTotal: p.guessesTotal + 1, lastGuessDate: today, dailyGuessCount: (isToday ? (p.dailyGuessCount ?? 0) : 0) + 1 };
      });
    }
  };

  if (auth.loading) return (
    <div className="min-h-screen bg-red-600 flex items-center justify-center">
      <div className="text-center space-y-4"><Loader2 size={48} className="animate-spin text-white mx-auto" /><p className="text-white font-black uppercase tracking-widest text-sm">Carregando álbum...</p></div>
    </div>
  );

  if (!auth.user) {
    if (showSplash) return <SplashScreen onEnter={() => setShowSplash(false)} />;
    return <AuthModal onAuth={auth} onBack={() => setShowSplash(true)} />;
  }

  // Usuário logado mas aguardando aprovação do admin — bloqueia o app inteiro
  if (auth.isPending) {
    return <AuthModal onAuth={auth} />;
  }

  const displayName = auth.profile?.name ?? auth.user.email?.split('@')[0] ?? 'Colaborador';

  return (
    <div className="min-h-screen vintage-paper text-slate-900 font-sans selection:bg-red-600 selection:text-white border-8 border-red-600">
      <nav className="sticky top-0 z-50 bg-red-600 border-b-4 border-red-800 shadow-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-red-800 shadow-[0_0_15px_rgba(255,255,255,0.4)]"><span className="text-red-600 font-black text-2xl italic">F</span></div>
          <div><h1 className="text-xl font-black tracking-tighter text-white uppercase leading-none">Copa Fanfortes</h1><p className="text-[10px] font-black text-red-100 tracking-[0.2em] uppercase mt-1">Álbum de Conquistas &amp; Talentos</p></div>
        </div>
        <div className="hidden lg:flex items-center gap-6">
          <div className="bg-red-800/40 px-4 py-2 rounded-lg border border-red-400/20">
            <p className="text-[10px] text-red-200 uppercase tracking-widest font-black">Coleção</p>
            <p className="text-lg font-black text-white leading-tight">{packs.uniqueOwned} <span className="text-red-300 text-xs font-bold">/ {packs.totalStickers || allCollaborators.length}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex flex-col items-end mr-2">
            <span className="text-[8px] font-black text-red-200 uppercase leading-none">Colaborador</span>
            <span className="text-[10px] font-bold text-white leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{displayName}</span>
          </div>
          <button onClick={() => auth.signOut()} title="Sair" className="flex items-center gap-2 bg-red-900/40 hover:bg-red-900 text-red-200 p-2 rounded-lg text-xs font-black transition-all border border-red-700/30"><LogOut size={16} /><span className="hidden lg:inline uppercase">Sair</span></button>
          <div className="h-8 w-px bg-red-400/20 mx-2" />
          <button onClick={() => setView('album')} title="Ver Álbum" className={`p-2 rounded-lg transition-all ${view === 'album' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><Book size={20} /></button>
          <button onClick={() => setView('ranking')} title="Ranking" className={`p-2 rounded-lg transition-all ${view === 'ranking' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><TrendingUp size={20} /></button>
          <button onClick={() => setView('trading')} title="Trocar" className={`p-2 rounded-lg transition-all ${view === 'trading' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><ArrowLeftRight size={20} /></button>
          <button onClick={startNewGame} title="Adivinhar" className={`p-2 rounded-lg transition-all ${view === 'game' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><Gamepad2 size={20} /></button>
          {auth.profile?.role === 'ADMIN' && (
            <>
              <div className="h-8 w-px bg-red-400/20 mx-1" />
              <button onClick={() => setView('admin-dashboard')} title="Admin Dashboard" className={`p-2 rounded-lg transition-all ${view === 'admin-dashboard' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><BarChart3 size={20} /></button>
              <button onClick={() => setView('admin-stickers')} title="Editor de Figurinhas" className={`p-2 rounded-lg transition-all ${view === 'admin-stickers' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><ImagePlus size={20} /></button>
            </>
          )}
          <button onClick={openPack} disabled={packs.claiming || packsRemaining <= 0} className="flex items-center gap-2 bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 px-4 py-2 rounded-lg text-sm font-black transition-all shadow-lg hover:scale-105 active:scale-95 ml-2 border-2 border-red-700">
            {packs.claiming ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
            <span className="hidden sm:inline italic uppercase">PACK</span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${packsRemaining > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{packsRemaining}/{packs.maxPacksPerDay}</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8 bg-white min-h-[calc(100vh-100px)]">
        <AnimatePresence mode="wait">
          {view === 'album' && (
            <motion.div key="album" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="space-y-12">
              {packs.ownedIds.length === 0 ? (
                <div className="text-center py-24 bg-slate-50 rounded-[40px] border-4 border-red-100 space-y-8 flex flex-col items-center">
                  <div className="w-24 h-24 bg-red-100 border-2 border-red-200 rounded-3xl flex items-center justify-center rotate-12 mx-auto"><Package className="text-red-500" size={48} /></div>
                  <div className="space-y-3"><h3 className="text-3xl font-black uppercase italic tracking-tighter text-slate-800">Álbum Vazio!</h3><p className="text-slate-500 max-w-sm mx-auto font-medium">Capture talentos exclusivos e complete sua coleção de raridades da empresa.</p></div>
                  <button onClick={openPack} disabled={packs.claiming} className="bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-10 py-4 rounded-2xl font-black italic uppercase tracking-widest transition-all shadow-xl flex items-center gap-3">
                    {packs.claiming && <Loader2 size={20} className="animate-spin" />}Resgatar Primeiro Pack <ChevronRight size={20} />
                  </button>
                </div>
              ) : (
                <div className="space-y-8 pb-12">
                  <div className="flex justify-center max-w-3xl mx-auto relative overflow-visible">
                    <AnimatePresence mode="wait" custom={direction}>
                      <AlbumPage key={currentPage} pageIndex={currentPage} ownedStickers={packs.ownedIds} onStickerClick={setSelectedSticker} direction={direction} allStickers={allCollaborators} />
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center justify-center gap-12 pt-12">
                    <button onClick={() => paginate(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="p-4 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm group"><ChevronLeft size={32} className="text-red-600 group-hover:-translate-x-1 transition-transform" /></button>
                    <div className="flex gap-3">{Array.from({ length: TOTAL_PAGES }).map((_, i) => (<button key={i} onClick={() => paginate(i)} className={`w-3 h-3 rounded-full transition-all ${currentPage === i ? 'bg-red-600 scale-125 shadow-lg' : 'bg-slate-200 hover:bg-slate-300'}`} />))}</div>
                    <button onClick={() => paginate(Math.min(TOTAL_PAGES - 1, currentPage + 1))} disabled={currentPage === TOTAL_PAGES - 1} className="p-4 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm group"><ChevronRight size={32} className="text-red-600 group-hover:translate-x-1 transition-transform" /></button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'ranking' && (
            <motion.div key="ranking" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <RankingSection leaderboard={leaderboard} currentUserId={auth.user.id} />
            </motion.div>
          )}

          {view === 'trading' && auth.user && (
            <motion.div key="trading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <TradeSystem userId={auth.user.id} userStickers={packs.userStickers} allStickers={packs.stickers} tradesHook={tradesHook} />
            </motion.div>
          )}

          {view === 'game' && (
            <motion.div key="game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto space-y-12 py-8">
              <div className="bg-red-50 border-4 border-red-100 rounded-[40px] p-8 md:p-12 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-200/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="w-20 h-20 bg-red-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl border-4 border-red-400 mb-8 mx-auto"><Search className="text-white" size={36} /></div>
                <h2 className="text-4xl md:text-5xl font-black uppercase italic text-red-600 mb-4 tracking-tighter">Quem é este Player?</h2>
                <p className="text-slate-500 font-medium mb-12">Desvende a identidade através dos atributos de combate.</p>
                {!gameState.canPlay && gameState.feedback ? (
                  <div className="space-y-6">
                    <p className="p-8 bg-white border-2 border-red-100 rounded-3xl text-red-600 font-black uppercase italic">{gameState.feedback}</p>
                    <button onClick={() => setView('album')} className="text-slate-400 hover:text-red-600 font-black uppercase italic tracking-widest text-xs transition-colors">Voltar ao Álbum</button>
                  </div>
                ) : gameState.target && (
                  <div className="w-full flex flex-col md:flex-row gap-12 items-start text-left">
                    <div className="w-full md:w-1/2 flex justify-center">
                      <div className="w-full max-w-[280px] aspect-[3/4] p-4 rounded-3xl bg-white border-4 border-red-200 shadow-2xl relative overflow-hidden">
                        {gameState.won ? (
                          <motion.img initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={gameState.target.imageUrl} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" alt={gameState.target.name} />
                        ) : (
                          <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center gap-6 rounded-2xl border border-slate-100">
                            <Search size={64} className="text-red-200 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-[0.4em] font-black text-red-300">Analisando...</span>
                          </div>
                        )}
                        <div className="absolute bottom-6 left-6 right-6 p-3 bg-red-600/90 backdrop-blur-md rounded-xl border border-red-400 text-center">
                          <span className="text-[10px] font-black text-white uppercase italic">✨ {gameState.target.rarity.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 w-full space-y-8">
                      <div className="grid grid-cols-1 gap-4 w-full">
                        <div className="bg-white p-4 rounded-2xl border border-red-100 text-left shadow-sm"><p className="text-red-400 font-black text-[10px] mb-1 uppercase tracking-widest">✨ RARIDADE</p><p className="text-red-600 font-black italic text-xl uppercase tracking-tighter">{gameState.target.rarity}</p></div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memória do Log</p>
                        <p className="text-xl italic text-slate-600 font-serif leading-relaxed font-light border-l-4 border-red-600 pl-6">"{gameState.target.bio}"</p>
                      </div>
                      <div className="pt-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          {gameState.options.map(option => (
                            <button key={option.id} disabled={gameState.won || gameState.attemptsRemaining === 0} onClick={() => submitGuess(option.id)}
                              className={`p-4 rounded-2xl font-black italic uppercase transition-all text-left flex items-center justify-between group text-sm ${gameState.won && option.id === gameState.target?.id ? 'bg-red-600 text-white translate-x-1 shadow-lg' : 'bg-white hover:bg-red-50 text-slate-500 border border-red-100 hover:border-red-400'} disabled:opacity-50`}>
                              {option.name}<ChevronRight size={18} className={`${gameState.won && option.id === gameState.target?.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} />
                            </button>
                          ))}
                        </div>
                        {gameState.feedback && (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`p-5 rounded-2xl text-center font-black italic uppercase text-xs border-2 tracking-widest ${gameState.won ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg' : 'bg-red-50 border-red-100 text-red-600'}`}>{gameState.feedback}</motion.div>
                        )}
                        <div className="flex items-center justify-between pt-6">
                          <div className="flex gap-2">{[...Array(2)].map((_, i) => (<div key={i} className={`w-3 h-3 rounded-full ${i < gameState.attemptsRemaining ? 'bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-slate-200'}`} />))}</div>
                          {(gameState.won || gameState.attemptsRemaining === 0) && (
                            <button onClick={startNewGame} className="text-red-600 hover:text-red-700 font-black italic uppercase tracking-widest flex items-center gap-2 group text-xs">Próximo Cartão <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'admin-dashboard' && auth.profile?.role === 'ADMIN' && (
            <motion.div key="admin-dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <AdminDashboard />
            </motion.div>
          )}

          {view === 'admin-stickers' && auth.profile?.role === 'ADMIN' && (
            <motion.div key="admin-stickers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <AdminStickerEditor />
            </motion.div>
          )}

          {view === 'opening' && (
            <motion.div key="opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-6xl mx-auto py-24 text-center">
              <div className="mb-16 space-y-4">
                <div className="w-20 h-20 bg-red-100 border-2 border-red-200 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce"><Sparkles className="text-red-600" size={40} /></div>
                <h2 className="text-6xl font-black italic uppercase tracking-tighter text-red-600">Novo Pack Resgatado!</h2>
                <p className="text-slate-500 font-medium">As entidades de talentos se manifestaram em sua coleção.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-16 px-4">
                {activePack.map((c, i) => {
                  const isDuplicate = (packs.userStickers.get(c.id) ?? 0) > 1;
                  return (
                    <motion.div key={`${c.id}-${i}`} initial={{ opacity: 0, scale: 0.5, rotateY: 180, y: 50 }} animate={{ opacity: 1, scale: 1.1, rotateY: 0, y: 0, transition: { delay: i * 0.4, type: 'spring', damping: 12, stiffness: 80 } }} className="w-72">
                      <StickerCard collaborator={c} />
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.4 + 0.6 } }} className={`mt-8 text-xs font-black italic uppercase tracking-[0.2em] ${isDuplicate ? 'text-slate-600' : 'text-emerald-400'}`}>{isDuplicate ? 'DUPLICADA' : 'NOVO TALENTO'}</motion.div>
                    </motion.div>
                  );
                })}
              </div>
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 1.8 } }} onClick={() => setView('album')} className="mt-24 bg-red-600 hover:bg-red-500 text-white px-12 py-4 rounded-2xl font-black italic uppercase tracking-widest text-sm border-2 border-red-800 transition-all hover:scale-105 active:scale-95 shadow-xl">Voltar ao Álbum</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto p-8 border-t border-red-100 text-center mt-auto">
        <p className="text-[10px] font-black font-mono tracking-[0.4em] uppercase text-red-200">Copa Fanfortes 2026 · Todos os Talentos Reservados · Álbum Oficial Fortes Tecnologia</p>
      </footer>

      <AnimatePresence>
        {selectedSticker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 sm:p-12">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSticker(null)} className="absolute inset-0 bg-red-950/40 backdrop-blur-md" />
            <div className="relative flex flex-col lg:flex-row items-center gap-16 z-10 w-full max-w-6xl">
              <motion.div layoutId={`card-${selectedSticker.id}`} className="w-full max-w-[360px] aspect-[3/4]"><StickerCard collaborator={selectedSticker} /></motion.div>
              <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="max-w-xl space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase italic tracking-widest ${selectedSticker.rarity === Rarity.LEGENDARY ? 'bg-red-600 text-white' : selectedSticker.rarity === Rarity.RARE ? 'bg-red-500 text-white' : 'bg-slate-700 text-white'}`}>{selectedSticker.rarity}</div>
                    <span className="text-red-400 font-black font-mono text-sm tracking-widest">REF ID #{String(selectedSticker.id).padStart(3, '0')}</span>
                  </div>
                  <h2 className="text-6xl md:text-7xl font-black italic tracking-tighter leading-none text-slate-900 uppercase">{selectedSticker.name}</h2>
                  <h3 className="text-2xl text-red-600 font-black italic uppercase tracking-tighter">{selectedSticker.role}</h3>
                </div>
                <div className="p-10 bg-white border-4 border-red-100 rounded-[40px] shadow-2xl relative">
                  <div className="absolute -top-5 -left-5 bg-red-600 p-4 rounded-2xl shadow-2xl rotate-12"><Sparkles className="text-white" size={24} /></div>
                  <p className="text-slate-600 leading-relaxed mb-10 font-serif italic text-2xl font-light">"{selectedSticker.bio}"</p>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-300">Conquistas Desbloqueadas</h4>
                    <div className="flex flex-wrap gap-3">{selectedSticker.achievements.map((a, i) => (<span key={i} className="px-6 py-3 bg-red-50 rounded-2xl text-xs border border-red-100 text-red-600 font-black italic uppercase tracking-widest">{a}</span>))}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedSticker(null)} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-3xl font-black italic uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all border-2 border-red-800 shadow-2xl"><ChevronLeft size={20} />Fechar Visualizacao</button>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
