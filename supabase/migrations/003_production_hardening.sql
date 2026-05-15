-- ============================================================
-- 003_production_hardening.sql
-- Rate limiting server-side, get_pack_status, índices de performance
-- ============================================================

-- ── 1. Atualiza claim_daily_pack para 2 packs/dia ────────────
--
-- Mudanças vs. versão anterior:
--   • Suporte a N packs por dia (MAX_PACKS = 2)
--   • ID do claim: user_YYYYMMDD_N  (N = sequência do dia)
--   • Retorna packs_remaining para o frontend
--   • Lock com pg_advisory_xact_lock para evitar corrida paralela
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_pack(
  p_user_id      UUID,
  p_stickers     JSONB,
  p_score_gained INTEGER,
  p_pity_counter INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today        DATE    := CURRENT_DATE;
  v_claim_count  INTEGER;
  v_claim_id     TEXT;
  v_existing     public.daily_claims%ROWTYPE;
  v_sticker      JSONB;
  v_sticker_id   TEXT;
  MAX_PACKS      CONSTANT INTEGER := 2;
BEGIN
  -- Advisory lock por usuário: evita duas requisições simultâneas do mesmo user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT));

  -- Conta packs concluídos hoje
  SELECT COUNT(*) INTO v_claim_count
  FROM public.daily_claims
  WHERE user_id   = p_user_id
    AND claim_date = v_today
    AND status     = 'completed';

  IF v_claim_count >= MAX_PACKS THEN
    RAISE EXCEPTION 'PACK_LIMIT_REACHED';
  END IF;

  -- ID sequencial do pack do dia (ex: uuid_20240601_1, uuid_20240601_2)
  v_claim_id := p_user_id::TEXT
    || '_' || TO_CHAR(v_today, 'YYYYMMDD')
    || '_' || (v_claim_count + 1)::TEXT;

  -- Idempotência: se já existe com esse ID, devolve sem duplicar
  SELECT * INTO v_existing
  FROM public.daily_claims
  WHERE id = v_claim_id;

  IF FOUND THEN
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'success',         true,
        'idempotent',      true,
        'stickers',        v_existing.stickers,
        'packs_remaining', GREATEST(0, MAX_PACKS - v_claim_count - 1)
      );
    ELSE
      RAISE EXCEPTION 'CLAIM_IN_PROGRESS';
    END IF;
  END IF;

  -- Cria claim pendente
  INSERT INTO public.daily_claims (id, user_id, claim_date, status)
  VALUES (v_claim_id, p_user_id, v_today, 'pending');

  -- Upsert figurinhas no inventário
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

  -- Atualiza perfil
  UPDATE public.profiles SET
    score        = score + p_score_gained,
    pity_counter = p_pity_counter,
    last_pack_at = NOW()
  WHERE id = p_user_id;

  -- Finaliza claim
  UPDATE public.daily_claims SET
    status   = 'completed',
    stickers = p_stickers
  WHERE id = v_claim_id;

  -- Log
  INSERT INTO public.pack_logs (user_id, log_date, sticker_ids)
  VALUES (
    p_user_id,
    v_today,
    ARRAY(SELECT jsonb_array_elements_text(p_stickers->'id'))
  );

  RETURN jsonb_build_object(
    'success',         true,
    'idempotent',      false,
    'stickers',        p_stickers,
    'packs_remaining', GREATEST(0, MAX_PACKS - v_claim_count - 1)
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_EXISTS';
END;
$$;

-- ── 2. Função pública: status de packs do dia ────────────────
--   Chamada no boot do app para mostrar contagem real do servidor
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pack_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INTEGER;
  MAX_PACKS CONSTANT INTEGER := 2;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.daily_claims
  WHERE user_id   = p_user_id
    AND claim_date = CURRENT_DATE
    AND status     = 'completed';

  RETURN jsonb_build_object(
    'packs_claimed_today', v_count,
    'packs_remaining',     GREATEST(0, MAX_PACKS - v_count),
    'max_packs',           MAX_PACKS
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pack_status(UUID) TO authenticated;

-- ── 3. Índice extra para acelerar contagem do dia ────────────
CREATE INDEX IF NOT EXISTS idx_daily_claims_user_date_status
  ON public.daily_claims(user_id, claim_date, status);

-- ── 4. Atualiza leaderboard para contar figurinhas únicas ────
--   (corrige bug de duplicatas contadas no ranking)
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
    COUNT(us.sticker_id) AS total_stickers,   -- únicas, sem duplicatas
    NOW()
  FROM public.profiles p
  LEFT JOIN public.user_stickers us ON us.user_id = p.id
  GROUP BY p.id, p.name, p.score, p.created_at
  ORDER BY p.score DESC
  LIMIT 100;
END;
$$;

-- Executa imediatamente para aplicar a correção do leaderboard
SELECT public.refresh_leaderboard();
