import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Book, Gamepad2, Package, Search, Trophy, ChevronRight, ChevronLeft,
  Sparkles, ArrowLeftRight, TrendingUp, LogOut, RefreshCw,
  User, Loader2, BarChart3, ImagePlus, Clock, Lock,
} from 'lucide-react';
import fortesLogo from './public/fortes-logo.png';
import AdminDashboard from './components/AdminDashboard';
import AdminStickerEditor from './components/AdminStickerEditor';
import TradeSystem from './components/TradeSystem';
import { COLLABORATORS, MAX_STICKERS } from './constants';
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



const StickerCard = ({ collaborator, isCollected = true, onClick, large = false }: { collaborator: Collaborator; isCollected?: boolean; onClick?: () => void; key?: any; large?: boolean; }) => {
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

  if (large) {
    // ── Versão grande — usada na abertura de pack ──────────────
    return (
      <motion.div layoutId={`card-${collaborator.id}`} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.97 }} onClick={onClick}
        className={`relative w-full rounded-xl overflow-hidden shadow-2xl cursor-pointer transition-all duration-300
          ${isLegendary ? 'bg-holographic' : isRare ? 'bg-gold-shiny animate-gold-glow' : 'bg-white'}
          border-[3px] ${isLegendary ? 'border-red-400' : isRare ? 'border-amber-300' : 'border-red-200'}
          ${isRare || isLegendary ? 'panini-shadow' : ''}`}>
        {(isRare || isLegendary) && <div className="absolute inset-0 shiny-overlay opacity-30 z-20 pointer-events-none" />}

        {/* Foto — ocupa ~60% do card */}
        <div className={`relative w-full ${isRare ? 'bg-amber-50' : 'bg-slate-50'}`} style={{ aspectRatio: '3/2.2' }}>
          <img src={collaborator.imageUrl} alt={collaborator.name} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
          {/* Badge raridade */}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
            ${isLegendary ? 'bg-red-600 text-white border-red-700' : isRare ? 'bg-amber-400 text-amber-900 border-amber-500' : 'bg-white/80 text-slate-500 border-slate-200'}`}>
            {isLegendary ? '★★★ Lendário' : isRare ? '★★ Raro' : '★ Comum'}
          </div>
          {/* Número */}
          <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <span className="text-[9px] font-black text-white leading-none">#{collaborator.id}</span>
          </div>
        </div>

        {/* Área branca — nome, cargo e talentos */}
        <div className={`flex flex-col gap-1 px-3 py-2.5 ${isLegendary ? 'bg-white/95' : isRare ? 'bg-gradient-to-b from-amber-50 to-white' : 'bg-white'}`}>
          {/* Time */}
          <span className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none ${isRare ? 'text-amber-500' : 'text-slate-300'}`}>
            {collaborator.team}
          </span>
          {/* Nome em destaque */}
          <h3 className={`text-base font-black uppercase tracking-tight leading-tight ${isRare ? 'text-amber-900' : 'text-slate-900'}`}>
            {collaborator.name}
          </h3>
          {/* Cargo */}
          <p className={`text-[10px] font-bold uppercase leading-none ${isRare ? 'text-amber-600' : 'text-slate-400'}`}>
            {collaborator.role}
          </p>
          {/* Talentos */}
          {collaborator.bio && (
            <p className={`text-[10px] leading-snug mt-0.5 ${isRare ? 'text-amber-800' : 'text-slate-500'}`}
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {collaborator.bio}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Versão compacta — álbum, game reward, modal ───────────────
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
            <h3 className={`text-[9px] font-black uppercase tracking-tighter truncate leading-tight ${isRare ? 'text-amber-900' : 'text-slate-800'}`}>{collaborator.name}</h3>
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

// Card individual do álbum — design novo
const AlbumCard = ({ collaborator, globalIndex, isCollected, onClick }: {
  collaborator: Collaborator; globalIndex: number; isCollected: boolean; onClick: () => void;
}) => {
  if (!isCollected) {
    return (
      <div className="w-full aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center select-none">
        <span className="text-2xl md:text-3xl font-black italic text-slate-300">{globalIndex + 1}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="w-full aspect-[3/4] bg-white border-[3px] border-red-500 rounded-2xl overflow-hidden relative shadow-md cursor-pointer group hover:shadow-xl transition-shadow" onClick={onClick}>
        <img src={collaborator.imageUrl} alt={collaborator.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
        <div className="absolute top-1.5 right-1.5 bg-red-600/80 backdrop-blur-sm rounded-md px-1 py-0.5">
          <span className="text-[6px] font-black text-white leading-none">{globalIndex + 1}</span>
        </div>
      </div>
      <p className="text-center font-black uppercase truncate text-slate-800 leading-tight" style={{ fontSize: '7px', letterSpacing: '0.04em' }}>
        {collaborator.name}
      </p>
    </div>
  );
};

const AlbumPage = ({ pageIndex, ownedStickers, onStickerClick, direction = 0, allStickers, zoom = 100 }: {
  pageIndex: number; ownedStickers: string[]; onStickerClick: (c: Collaborator) => void;
  direction?: number; allStickers: Collaborator[]; key?: any; zoom?: number;
}) => {
  const startIdx = pageIndex * STICKERS_PER_PAGE;
  const pageStickers = allStickers.slice(startIdx, startIdx + STICKERS_PER_PAGE);
  const completionPct = Math.round((pageStickers.filter(c => ownedStickers.includes(c.id)).length / Math.max(pageStickers.length, 1)) * 100);
  const isPageComplete = pageStickers.length > 0 && pageStickers.every(s => ownedStickers.includes(s.id));
  const groupLetter = String.fromCharCode(65 + pageIndex);
  const firstTwo = pageStickers.slice(0, 2);
  const restEight = pageStickers.slice(2);

  return (
    <motion.div key={pageIndex}
      initial={{ opacity: 0, x: direction > 0 ? 100 : -100, rotateY: direction > 0 ? 45 : -45, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1, transition: { type: 'spring', stiffness: 40, damping: 20, mass: 1.5 } }}
      exit={{ opacity: 0, x: direction > 0 ? -100 : 100, rotateY: direction > 0 ? -45 : 45, scale: 0.95, transition: { duration: 0.8, ease: 'easeInOut' } }}
      style={{ perspective: 1200, transformOrigin: direction > 0 ? 'left center' : 'right center', maxWidth: `${(42 * zoom) / 100}rem` }}
      className="relative bg-white w-full shadow-2xl rounded-[32px] border-2 border-slate-100 mx-auto overflow-hidden"
    >
      {/* ── Marca d'água: logo iF oficial da Fortes ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src={fortesLogo}
          alt=""
          className="absolute w-[72%] max-w-[420px]"
          style={{
            top: '50%',
            right: '-10%',
            transform: 'translateY(-50%)',
            opacity: 0.18,
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* ── Gradiente inferior branco → vermelho (forte, igual referência) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-[1]"
        style={{
          height: '38%',
          background: 'linear-gradient(to top, rgba(220,38,38,0.22) 0%, rgba(220,38,38,0.08) 40%, transparent 100%)',
        }}
      />

      {/* Brilho de entrada */}
      <motion.div initial={{ opacity: 0, x: '-100%' }} animate={{ x: '200%', opacity: [0, 0.15, 0] }} transition={{ duration: 1.6, ease: 'easeInOut' }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none z-50 transform skew-x-12" />

      <div className="relative z-10 p-5 md:p-8 space-y-4">
        {/* Linha 1: Painel de info (2 colunas) + 2 primeiros cards */}
        <div className="grid grid-cols-4 gap-3 items-end">
          {/* Painel esquerdo */}
          <div className="col-span-2 space-y-2 pb-1">
            <div className="leading-none">
              <p className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-red-600 leading-none">COPA</p>
              <p className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">FANFORTES</p>
            </div>
            <div>
              <p className="text-5xl md:text-6xl font-black leading-none text-red-600">{completionPct}%</p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mt-0.5">Página Completa</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-wide px-3 py-1 rounded-full ${isPageComplete ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'}`}>
                Grupo {groupLetter}
              </span>
              {isPageComplete && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[8px] font-black uppercase text-amber-500">✓ Completo!</motion.span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <User size={10} className="text-slate-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Copa Fanfortes</span>
            </div>
          </div>

          {/* Cards 1 e 2 */}
          {firstTwo.map((c, i) => (
            <AlbumCard key={c.id} collaborator={c} globalIndex={startIdx + i} isCollected={ownedStickers.includes(c.id)} onClick={() => onStickerClick(c)} />
          ))}
        </div>

        {/* Linha 2+: 8 cards restantes em 4 colunas */}
        <div className="grid grid-cols-4 gap-3">
          {restEight.map((c, i) => (
            <AlbumCard key={c.id} collaborator={c} globalIndex={startIdx + i + 2} isCollected={ownedStickers.includes(c.id)} onClick={() => onStickerClick(c)} />
          ))}
        </div>
      </div>

      {/* Rodapé vermelho */}
      <div className="h-2 bg-red-600 w-full" />
    </motion.div>
  );
};

const RankingSection = ({ leaderboard, currentUserId, onForceRefresh, refreshing }: { leaderboard: DbLeaderboardEntry[]; currentUserId?: string; onForceRefresh: () => void; refreshing: boolean; }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
    <div className="text-center space-y-2">
      <h2 className="text-4xl font-black italic uppercase text-red-600 tracking-tighter">Ranking de Colecionadores</h2>
      <p className="text-slate-400 font-medium">Quem está mais perto de completar o álbum Fanfortes?</p>
      <button
        onClick={onForceRefresh}
        disabled={refreshing}
        className="mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Atualizando...' : 'Atualizar Ranking'}
      </button>
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
                  <img src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(entry.name)}`} alt={entry.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-200 bg-slate-50 object-cover" referrerPolicy="no-referrer" />
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


const MAX_GUESSES_PER_DAY = 5;
// Altere esta chave para resetar as partidas diárias de todos os usuários
const GAME_RESET_KEY = '2026-05-26-v1';

interface LocalGameStats { guessesRight: number; guessesTotal: number; lastGuessDate: string | null; dailyGuessCount: number; resetKey?: string; }
interface GameState { target: Collaborator | null; attemptsRemaining: number; options: Collaborator[]; feedback: string | null; won: boolean; canPlay: boolean; }

export default function App() {
  const auth = useAuth();
  const packs = usePacks(auth.user?.id);
  const { entries: leaderboard, refetch: refetchLeaderboard, forceRefresh: forceRefreshLeaderboard, refreshing: leaderboardRefreshing } = useLeaderboard();
  const tradesHook = useTrades(auth.user?.id);
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<'album'|'game'|'opening'|'ranking'|'trading'|'admin-dashboard'|'admin-stickers'>('album');
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [albumZoom, setAlbumZoom] = useState(100);
  const [activePack, setActivePack] = useState<Collaborator[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<Collaborator | null>(null);
  const [localGameStats, setLocalGameStats] = useState<LocalGameStats>(() => {
    try {
      const s = localStorage.getItem('game_stats');
      const parsed = s ? JSON.parse(s) : {};
      const base = { guessesRight: 0, guessesTotal: 0, lastGuessDate: null, dailyGuessCount: 0, ...parsed };
      // Se a chave de reset mudou, zera o contador diário
      if (base.resetKey !== GAME_RESET_KEY) {
        return { ...base, dailyGuessCount: 0, lastGuessDate: null, resetKey: GAME_RESET_KEY };
      }
      return base;
    }
    catch { return { guessesRight: 0, guessesTotal: 0, lastGuessDate: null, dailyGuessCount: 0, resetKey: GAME_RESET_KEY }; }
  });

  // ── Relógio BRT (Fortaleza/CE — UTC-3, sem horário de verão) ──
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // Converte UTC → BRT (UTC-3)
  const brt = useMemo(() => new Date(now.getTime() - 3 * 60 * 60 * 1000), [now]);
  const brtH  = brt.getUTCHours();
  const brtM  = brt.getUTCMinutes();
  const brtS  = brt.getUTCSeconds();
  const brtClock = `${String(brtH).padStart(2,'0')}:${String(brtM).padStart(2,'0')}:${String(brtS).padStart(2,'0')}`;
  // Janela permitida: 12:00 – 23:59
  const isWindowOpen = brtH >= 12;
  // Contagem regressiva até 12:00 (só quando fechado)
  const countdown = useMemo(() => {
    if (isWindowOpen) return null;
    const secsLeft = (12 * 3600) - (brtH * 3600 + brtM * 60 + brtS);
    const h = Math.floor(secsLeft / 3600);
    const m = Math.floor((secsLeft % 3600) / 60);
    const s = secsLeft % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }, [isWindowOpen, brtH, brtM, brtS]);

  // ── Pack status vem do servidor via usePacks ─────────────────
  const packsRemaining = packs.packsRemaining;
  const [gameState, setGameState] = useState<GameState>({ target: null, attemptsRemaining: 1, options: [], feedback: null, won: false, canPlay: true });
  const [gameReward, setGameReward] = useState<DbSticker | null>(null);
  const [gameRewardClaiming, setGameRewardClaiming] = useState(false);

  useEffect(() => { localStorage.setItem('game_stats', JSON.stringify(localGameStats)); }, [localGameStats]);

  const allCollaborators = useMemo((): Collaborator[] => {
    // O roster real é a tabela `stickers` do banco. Antes da carga inicial
    // (banco vazio) usamos os placeholders só para não quebrar o jogo.
    if (packs.stickers.length === 0) return COLLABORATORS.slice(0, MAX_STICKERS);
    return packs.stickers
      .map(toCollaborator)
      .sort((a, b) => {
        const na = Number(a.id), nb = Number(b.id);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, MAX_STICKERS);
  }, [packs.stickers]);

  const TOTAL_PAGES = Math.ceil(allCollaborators.length / STICKERS_PER_PAGE);

  const paginate = (n: number) => { setDirection(n > currentPage ? 1 : -1); setCurrentPage(n); };

  const openPack = async () => {
    if (!isWindowOpen) {
      alert(`Os packs ficam disponíveis das 12:00 às 23:59 (horário de Fortaleza). Aguarde: ${countdown}`);
      return;
    }
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

  const claimGameReward = useCallback(async (): Promise<DbSticker | null> => {
    if (!auth.user) return null;
    setGameRewardClaiming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/claim-game-reward`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (res.ok && json.success && json.sticker) {
        await packs.refetchInventory();
        return json.sticker as DbSticker;
      }
      return null;
    } catch {
      return null;
    } finally {
      setGameRewardClaiming(false);
    }
  }, [auth.user, packs]);

  const startNewGame = () => {
    if (!isWindowOpen) {
      setGameState({ target: null, attemptsRemaining: 1, options: [], feedback: `O jogo fica disponível das 12:00 às 23:59 (horário de Fortaleza).`, won: false, canPlay: false });
      setView('game');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const isToday = localGameStats.lastGuessDate === today;
    const dailyCount = isToday ? (localGameStats.dailyGuessCount ?? 0) : 0;
    if (isToday && dailyCount >= MAX_GUESSES_PER_DAY) {
      setGameState(p => ({ ...p, feedback: `Você já jogou ${MAX_GUESSES_PER_DAY} vezes hoje! Volte amanhã.`, canPlay: false }));
      setView('game'); return;
    }
    setGameReward(null);
    const pool = packs.stickers.length > 0 ? packs.stickers.map(toCollaborator) : allCollaborators;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const opts = [target];
    while (opts.length < 4) { const o = pool[Math.floor(Math.random() * pool.length)]; if (!opts.find(x => x.id === o.id)) opts.push(o); }
    setGameState({ target, attemptsRemaining: 1, options: opts.sort(() => Math.random() - 0.5), feedback: null, won: false, canPlay: true });
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
      setGameReward(null);
      claimGameReward().then(sticker => { if (sticker) setGameReward(sticker); });
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
        <div className="hidden lg:flex items-center gap-4">
          <div className="bg-red-800/40 px-4 py-2 rounded-lg border border-red-400/20">
            <p className="text-[10px] text-red-200 uppercase tracking-widest font-black">Coleção</p>
            <p className="text-lg font-black text-white leading-tight">{packs.uniqueOwned} <span className="text-red-300 text-xs font-bold">/ {allCollaborators.length}</span></p>
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
          <button onClick={startNewGame} title={isWindowOpen ? 'Adivinhar' : 'Disponível das 12:00 às 23:59'} className={`p-2 rounded-lg transition-all relative ${view === 'game' ? 'bg-white text-red-600 shadow-lg scale-110' : isWindowOpen ? 'hover:bg-black/10 text-white/70' : 'text-white/30 cursor-not-allowed'}`}>
            <Gamepad2 size={20} />
            {!isWindowOpen && <Lock size={8} className="absolute -top-0.5 -right-0.5 text-white/50" />}
          </button>
          {auth.profile?.role === 'ADMIN' && (
            <>
              <div className="h-8 w-px bg-red-400/20 mx-1" />
              <button onClick={() => setView('admin-dashboard')} title="Admin Dashboard" className={`p-2 rounded-lg transition-all ${view === 'admin-dashboard' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><BarChart3 size={20} /></button>
              <button onClick={() => setView('admin-stickers')} title="Editor de Figurinhas" className={`p-2 rounded-lg transition-all ${view === 'admin-stickers' ? 'bg-white text-red-600 shadow-lg scale-110' : 'hover:bg-black/10 text-white/70'}`}><ImagePlus size={20} /></button>
            </>
          )}
          <button onClick={openPack} disabled={packs.claiming || packsRemaining <= 0 || !isWindowOpen} className="flex items-center gap-2 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 px-4 py-2 rounded-lg text-sm font-black transition-all shadow-lg hover:scale-105 active:scale-95 ml-2 border-2 border-red-700">
            {packs.claiming ? <Loader2 size={18} className="animate-spin" /> : !isWindowOpen ? <Lock size={18} /> : <Package size={18} />}
            <span className="hidden sm:inline italic uppercase">PACK</span>
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
                  {/* Controle de zoom do álbum */}
                  <div className="flex items-center justify-end gap-2 max-w-3xl mx-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho</span>
                    <button
                      onClick={() => setAlbumZoom(z => Math.max(50, z - 10))}
                      disabled={albumZoom <= 50}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 font-black text-sm flex items-center justify-center transition-colors"
                    >−</button>
                    <span className="text-xs font-black text-slate-700 w-10 text-center">{albumZoom}%</span>
                    <button
                      onClick={() => setAlbumZoom(z => Math.min(150, z + 10))}
                      disabled={albumZoom >= 150}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 font-black text-sm flex items-center justify-center transition-colors"
                    >+</button>
                    {albumZoom !== 100 && (
                      <button
                        onClick={() => setAlbumZoom(100)}
                        className="text-[9px] font-black uppercase tracking-wide text-red-500 hover:text-red-700 px-2 py-1 rounded-full border border-red-200 hover:border-red-400 transition-colors"
                      >↺ Padrão</button>
                    )}
                  </div>
                  <div className="flex justify-center mx-auto relative overflow-visible">
                    <AnimatePresence mode="wait" custom={direction}>
                      <AlbumPage key={currentPage} pageIndex={currentPage} ownedStickers={packs.ownedIds} onStickerClick={setSelectedSticker} direction={direction} allStickers={allCollaborators} zoom={albumZoom} />
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
              <RankingSection leaderboard={leaderboard} currentUserId={auth.user.id} onForceRefresh={forceRefreshLeaderboard} refreshing={leaderboardRefreshing} />
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
                <p className="text-slate-500 font-medium mb-12">Desvende as habilidades ocultas de cada jogador</p>
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
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Talentos Ocultos</p>
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
                        {gameState.won && (
                          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-center space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Recompensa de Vitória</p>
                            {gameRewardClaiming ? (
                              <div className="flex items-center justify-center gap-2 text-amber-600"><Loader2 size={20} className="animate-spin" /><span className="text-xs font-black italic uppercase">Buscando figurinha...</span></div>
                            ) : gameReward ? (
                              <div className="flex flex-col items-center gap-2">
                                <p className="text-xs font-black italic uppercase text-amber-600">Nova figurinha desbloqueada!</p>
                                <div className="w-28 mx-auto"><StickerCard collaborator={toCollaborator(gameReward)} /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{gameReward.name}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] italic text-amber-500">Recompensa já coletada hoje ou álbum completo.</p>
                            )}
                          </motion.div>
                        )}
                        <div className="flex items-center justify-between pt-6">
                          <div className="flex gap-2">{[...Array(1)].map((_, i) => (<div key={i} className={`w-3 h-3 rounded-full ${i < gameState.attemptsRemaining ? 'bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-slate-200'}`} />))}</div>
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
              <div className="flex flex-wrap justify-center gap-10 px-4">
                {activePack.map((c, i) => {
                  const isDuplicate = (packs.userStickers.get(c.id) ?? 0) > 1;
                  return (
                    <motion.div key={`${c.id}-${i}`} initial={{ opacity: 0, scale: 0.5, rotateY: 180, y: 50 }} animate={{ opacity: 1, scale: 1.1, rotateY: 0, y: 0, transition: { delay: i * 0.4, type: 'spring', damping: 12, stiffness: 80 } }} className="w-64">
                      <StickerCard collaborator={c} large />
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.4 + 0.6 } }} className={`mt-4 text-xs font-black italic uppercase tracking-[0.2em] ${isDuplicate ? 'text-slate-400' : 'text-emerald-400'}`}>{isDuplicate ? 'DUPLICADA' : 'NOVO TALENTO'}</motion.div>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedSticker(null)} className="absolute inset-0 bg-red-950/60 backdrop-blur-md" />
            <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-14 z-10 w-full max-w-5xl">

              {/* ── Foto completa ── */}
              <motion.div
                layoutId={`card-${selectedSticker.id}`}
                className="w-full max-w-[320px] lg:max-w-[380px] flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-white"
              >
                <img
                  src={selectedSticker.imageUrl}
                  alt={selectedSticker.name}
                  className="w-full h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              {/* ── Info ── */}
              <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="flex flex-col gap-6 w-full max-w-lg">
                {/* Badge raridade + ID */}
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase italic tracking-widest ${selectedSticker.rarity === Rarity.LEGENDARY ? 'bg-red-600 text-white' : selectedSticker.rarity === Rarity.RARE ? 'bg-amber-400 text-amber-900' : 'bg-white/20 text-white'}`}>
                    {selectedSticker.rarity === Rarity.LEGENDARY ? '★★★ Lendário' : selectedSticker.rarity === Rarity.RARE ? '★★ Raro' : '★ Comum'}
                  </div>
                  <span className="text-white/50 font-black font-mono text-sm tracking-widest">#{String(selectedSticker.id).padStart(3, '0')}</span>
                </div>

                {/* Nome — grande */}
                <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black italic tracking-tighter leading-none text-white uppercase drop-shadow-lg">
                  {selectedSticker.name}
                </h2>

                {/* Cargo + Time */}
                <div>
                  <p className="text-red-300 font-black italic uppercase tracking-tighter text-2xl">{selectedSticker.role}</p>
                  <p className="text-white/50 font-bold uppercase tracking-widest text-xs mt-1">{selectedSticker.team}</p>
                </div>

                {/* Bio / Talentos */}
                {selectedSticker.bio && (
                  <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-3">Talentos</p>
                    <p className="text-white/90 leading-relaxed font-serif italic text-lg font-light">"{selectedSticker.bio}"</p>
                  </div>
                )}

                {/* Botão fechar */}
                <button onClick={() => setSelectedSticker(null)} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black italic uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all border-2 border-red-700 shadow-2xl">
                  <ChevronLeft size={20} />Fechar
                </button>
              </motion.div>

            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
