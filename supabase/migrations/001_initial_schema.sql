-- ============================================================
-- ÁLBUM DA COPA: TALENTOS TECH — SUPABASE SCHEMA
-- Adapted from SDD v1.0 (Firestore → PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- 1. profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL DEFAULT '',
  role          TEXT        NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  score         INTEGER     NOT NULL DEFAULT 0,
  pity_counter  INTEGER     NOT NULL DEFAULT 0,
  last_pack_at  TIMESTAMPTZ,
  fcm_token     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. stickers catalog
CREATE TABLE IF NOT EXISTS public.stickers (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  role            TEXT        NOT NULL,
  team            TEXT        NOT NULL,
  rarity          TEXT        NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  characteristics JSONB       NOT NULL DEFAULT '{}',
  image_url       TEXT        NOT NULL,
  bio             TEXT        NOT NULL DEFAULT '',
  achievements    TEXT[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. user_stickers inventory
CREATE TABLE IF NOT EXISTS public.user_stickers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id      TEXT        NOT NULL REFERENCES public.stickers(id),
  quantity        INTEGER     NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sticker_id)
);

-- 4. daily_claims (anti-fraud lock)
CREATE TABLE IF NOT EXISTS public.daily_claims (
  id          TEXT        PRIMARY KEY,  -- {userId}_{YYYYMMDD}
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date  DATE        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  stickers    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, claim_date)
);

-- 5. pack_logs
CREATE TABLE IF NOT EXISTS public.pack_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date         DATE        NOT NULL,
  sticker_ids      TEXT[]      NOT NULL,
  execution_time_ms INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. leaderboard cache (materialized top-100)
CREATE TABLE IF NOT EXISTS public.leaderboard_cache (
  rank           INTEGER     PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  score          INTEGER     NOT NULL,
  total_stickers INTEGER     NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. trades
CREATE TABLE IF NOT EXISTS public.trades (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offered_sticker_ids   TEXT[]      NOT NULL,
  requested_sticker_ids TEXT[]      NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  CONSTRAINT no_self_trade CHECK (from_user_id <> to_user_id)
);

-- 8. trade_pool (matchmaking)
CREATE TABLE IF NOT EXISTS public.trade_pool (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  offers     TEXT[]      NOT NULL DEFAULT '{}',
  wants      TEXT[]      NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. quiz_questions
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question          TEXT        NOT NULL,
  options           TEXT[]      NOT NULL,
  correct_answer    TEXT        NOT NULL,
  related_sticker_id TEXT       REFERENCES public.stickers(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. quiz_answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id           TEXT        PRIMARY KEY,  -- {userId}_{questionId}
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id  UUID        NOT NULL REFERENCES public.quiz_questions(id),
  is_correct   BOOLEAN     NOT NULL,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_stickers_user_id   ON public.user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker_id ON public.user_stickers(sticker_id);
CREATE INDEX IF NOT EXISTS idx_daily_claims_user_date   ON public.daily_claims(user_id, claim_date);
CREATE INDEX IF NOT EXISTS idx_trades_from_user         ON public.trades(from_user_id);
CREATE INDEX IF NOT EXISTS idx_trades_to_user           ON public.trades(to_user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status            ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_pack_logs_user_id        ON public.pack_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_score           ON public.profiles(score DESC);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ATOMIC RPC: claim_daily_pack
-- Full transaction: lock → generate → update inventory → finalize
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_daily_pack(
  p_user_id      UUID,
  p_stickers     JSONB,   -- array of {id, rarity, name, ...} pre-generated by Edge Function
  p_score_gained INTEGER,
  p_pity_counter INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim_id   TEXT;
  v_today      DATE := CURRENT_DATE;
  v_existing   public.daily_claims%ROWTYPE;
  v_sticker     JSONB;
  v_sticker_id  TEXT;
BEGIN
  v_claim_id := p_user_id::TEXT || '_' || TO_CHAR(v_today, 'YYYYMMDD');

  -- Check existing claim (idempotency)
  SELECT * INTO v_existing
  FROM public.daily_claims
  WHERE id = v_claim_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'stickers', v_existing.stickers);
    ELSE
      RAISE EXCEPTION 'CLAIM_IN_PROGRESS';
    END IF;
  END IF;

  -- Create pending claim (distributed lock)
  INSERT INTO public.daily_claims (id, user_id, claim_date, status)
  VALUES (v_claim_id, p_user_id, v_today, 'pending');

  -- Upsert each sticker into inventory
  FOR v_sticker IN SELECT * FROM jsonb_array_elements(p_stickers)
  LOOP
    v_sticker_id := v_sticker->>'id';

    INSERT INTO public.user_stickers (user_id, sticker_id, quantity, last_updated_at)
    VALUES (p_user_id, v_sticker_id, 1, NOW())
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET
      quantity        = public.user_stickers.quantity + 1,
      last_updated_at = NOW();
  END LOOP;

  -- Update profile: score, pity_counter, last_pack_at
  UPDATE public.profiles SET
    score        = score + p_score_gained,
    pity_counter = p_pity_counter,
    last_pack_at = NOW()
  WHERE id = p_user_id;

  -- Finalize claim
  UPDATE public.daily_claims SET
    status   = 'completed',
    stickers = p_stickers
  WHERE id = v_claim_id;

  -- Log
  INSERT INTO public.pack_logs (user_id, log_date, sticker_ids)
  VALUES (p_user_id, v_today, ARRAY(SELECT jsonb_array_elements_text(p_stickers->'id')));

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'stickers', p_stickers);

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_EXISTS';
END;
$$;

-- ============================================================
-- ATOMIC RPC: execute_trade
-- Validates ownership, swaps stickers atomically
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_trade(p_trade_id UUID, p_acceptor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade       public.trades%ROWTYPE;
  v_sticker_id  TEXT;
  v_qty         INTEGER;
BEGIN
  -- Lock and fetch trade
  SELECT * INTO v_trade
  FROM public.trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRADE_NOT_FOUND';
  END IF;

  IF v_trade.status <> 'pending' THEN
    RAISE EXCEPTION 'TRADE_NOT_PENDING';
  END IF;

  IF v_trade.to_user_id <> p_acceptor_id THEN
    RAISE EXCEPTION 'TRADE_UNAUTHORIZED';
  END IF;

  -- Validate offerer owns offered stickers
  FOREACH v_sticker_id IN ARRAY v_trade.offered_sticker_ids
  LOOP
    SELECT quantity INTO v_qty
    FROM public.user_stickers
    WHERE user_id = v_trade.from_user_id AND sticker_id = v_sticker_id;

    IF NOT FOUND OR v_qty < 1 THEN
      RAISE EXCEPTION 'OFFERER_MISSING_STICKER:%', v_sticker_id;
    END IF;
  END LOOP;

  -- Validate acceptor owns requested stickers
  FOREACH v_sticker_id IN ARRAY v_trade.requested_sticker_ids
  LOOP
    SELECT quantity INTO v_qty
    FROM public.user_stickers
    WHERE user_id = v_trade.to_user_id AND sticker_id = v_sticker_id;

    IF NOT FOUND OR v_qty < 1 THEN
      RAISE EXCEPTION 'ACCEPTOR_MISSING_STICKER:%', v_sticker_id;
    END IF;
  END LOOP;

  -- Transfer offered stickers: from → to
  FOREACH v_sticker_id IN ARRAY v_trade.offered_sticker_ids
  LOOP
    UPDATE public.user_stickers SET quantity = quantity - 1
    WHERE user_id = v_trade.from_user_id AND sticker_id = v_sticker_id;

    INSERT INTO public.user_stickers (user_id, sticker_id, quantity)
    VALUES (v_trade.to_user_id, v_sticker_id, 1)
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET quantity = public.user_stickers.quantity + 1, last_updated_at = NOW();
  END LOOP;

  -- Transfer requested stickers: to → from
  FOREACH v_sticker_id IN ARRAY v_trade.requested_sticker_ids
  LOOP
    UPDATE public.user_stickers SET quantity = quantity - 1
    WHERE user_id = v_trade.to_user_id AND sticker_id = v_sticker_id;

    INSERT INTO public.user_stickers (user_id, sticker_id, quantity)
    VALUES (v_trade.from_user_id, v_sticker_id, 1)
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET quantity = public.user_stickers.quantity + 1, last_updated_at = NOW();
  END LOOP;

  -- Finalize trade
  UPDATE public.trades SET
    status       = 'accepted',
    completed_at = NOW()
  WHERE id = p_trade_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- ATOMIC RPC: refresh_leaderboard (top 100)
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.leaderboard_cache;

  INSERT INTO public.leaderboard_cache (rank, user_id, name, score, total_stickers, updated_at)
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.score DESC, p.created_at ASC) AS rank,
    p.id,
    p.name,
    p.score,
    COUNT(us.sticker_id) AS total_stickers,
    NOW()
  FROM public.profiles p
  LEFT JOIN public.user_stickers us ON us.user_id = p.id
  GROUP BY p.id, p.name, p.score, p.created_at
  ORDER BY p.score DESC
  LIMIT 100;
END;
$$;

-- ============================================================
-- ATOMIC RPC: matchmaking for trades
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_trade_matches(p_user_id UUID)
RETURNS TABLE (
  candidate_user_id UUID,
  candidate_name    TEXT,
  match_score       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_my_offers TEXT[];
  v_my_wants  TEXT[];
BEGIN
  SELECT offers, wants INTO v_my_offers, v_my_wants
  FROM public.trade_pool
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT
    tp.user_id,
    pr.name,
    (
      CARDINALITY(ARRAY(SELECT unnest(tp.offers) INTERSECT SELECT unnest(v_my_wants)))
      +
      CARDINALITY(ARRAY(SELECT unnest(tp.wants) INTERSECT SELECT unnest(v_my_offers)))
    ) AS match_score
  FROM public.trade_pool tp
  JOIN public.profiles pr ON pr.id = tp.user_id
  WHERE tp.user_id <> p_user_id
  ORDER BY match_score DESC
  LIMIT 20;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stickers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_pool        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers      ENABLE ROW LEVEL SECURITY;

-- profiles: own data
CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- stickers: public read, admin write
CREATE POLICY "stickers_read_all"     ON public.stickers FOR SELECT USING (true);
CREATE POLICY "stickers_admin_write"  ON public.stickers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- user_stickers: own data only
CREATE POLICY "user_stickers_own"     ON public.user_stickers FOR SELECT USING (auth.uid() = user_id);

-- daily_claims: own data only (no direct write)
CREATE POLICY "daily_claims_own"      ON public.daily_claims FOR SELECT USING (auth.uid() = user_id);

-- pack_logs: own data only
CREATE POLICY "pack_logs_own"         ON public.pack_logs FOR SELECT USING (auth.uid() = user_id);

-- leaderboard: public read
CREATE POLICY "leaderboard_read_all"  ON public.leaderboard_cache FOR SELECT USING (true);

-- trades: parties only
CREATE POLICY "trades_parties_select" ON public.trades FOR SELECT USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);
CREATE POLICY "trades_create"         ON public.trades FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "trades_cancel_own"     ON public.trades FOR UPDATE USING (
  auth.uid() = from_user_id AND status = 'pending'
);

-- trade_pool: own data
CREATE POLICY "trade_pool_own"        ON public.trade_pool FOR ALL USING (auth.uid() = user_id);

-- quiz: public read questions, own answers
CREATE POLICY "quiz_q_read_all"       ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "quiz_answers_own"      ON public.quiz_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quiz_answers_insert"   ON public.quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
