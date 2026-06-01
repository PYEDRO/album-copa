import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Typed helpers ────────────────────────────────────────────

export type DbSticker = {
  id: string
  name: string
  role: string
  team: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  characteristics: { agility: number; defense: number; attack: number }
  image_url: string
  bio: string
  achievements: string[]
}

export type DbProfile = {
  id: string
  name: string
  role: 'USER' | 'ADMIN'
  score: number
  pity_counter: number
  last_pack_at: string | null
  avatar_url: string | null
  /** false = aguardando aprovação admin; true (ou null/undefined em BDs legados) = aprovado */
  approved: boolean | null
}

export type DbUserSticker = {
  sticker_id: string
  quantity: number
}

export type DbTrade = {
  id: string
  from_user_id: string
  to_user_id: string
  offered_sticker_ids: string[]
  requested_sticker_ids: string[]
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
  completed_at: string | null
}

export type DbLeaderboardEntry = {
  rank: number
  user_id: string
  name: string
  score: number
  total_stickers: number
  avatar_url: string | null
  updated_at: string
}
