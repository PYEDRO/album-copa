-- Migration 019: o "dia do pack" vira às 12:00 (meio-dia) de Fortaleza
--
-- Regra de negócio: os 2 packs do dia ficam disponíveis a partir das 12:00 e
-- só renovam no próximo meio-dia. O ciclo vai de 12:00 a 12:00 (não meia-noite).
-- Implementado subtraindo 12h da hora local antes de extrair a data: assim a
-- "virada" do dia acontece exatamente ao meio-dia.
--
--   11:59 do dia X  -> pack_day = X-1  (ainda no ciclo da véspera)
--   12:00 do dia X  -> pack_day = X    (novo ciclo começa)

-- ── Helper: o "dia do pack" atual (vira às 12:00 BRT) ──────────
CREATE OR REPLACE FUNCTION public.current_pack_day()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT ((now() AT TIME ZONE 'America/Fortaleza') - interval '12 hours')::date;
$$;

-- ── claim_daily_pack: usa o dia que vira às 12:00 ──────────────
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
  v_today        DATE    := public.current_pack_day();
  v_claim_count  INTEGER;
  v_claim_id     TEXT;
  v_existing     public.daily_claims%ROWTYPE;
  v_sticker      JSONB;
  v_sticker_id   TEXT;
  MAX_PACKS      CONSTANT INTEGER := 2;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT));

  SELECT COUNT(*) INTO v_claim_count
  FROM public.daily_claims
  WHERE user_id   = p_user_id
    AND claim_date = v_today
    AND status     = 'completed';

  IF v_claim_count >= MAX_PACKS THEN
    RAISE EXCEPTION 'PACK_LIMIT_REACHED';
  END IF;

  v_claim_id := p_user_id::TEXT
    || '_' || TO_CHAR(v_today, 'YYYYMMDD')
    || '_' || (v_claim_count + 1)::TEXT;

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

  INSERT INTO public.daily_claims (id, user_id, claim_date, status)
  VALUES (v_claim_id, p_user_id, v_today, 'pending');

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

  UPDATE public.profiles SET
    score        = score + p_score_gained,
    pity_counter = p_pity_counter,
    last_pack_at = NOW()
  WHERE id = p_user_id;

  UPDATE public.daily_claims SET
    status   = 'completed',
    stickers = p_stickers
  WHERE id = v_claim_id;

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

-- ── get_pack_status: conta packs do dia que vira às 12:00 ──────
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
    AND claim_date = public.current_pack_day()
    AND status     = 'completed';

  RETURN jsonb_build_object(
    'packs_claimed_today', v_count,
    'packs_remaining',     GREATEST(0, MAX_PACKS - v_count),
    'max_packs',           MAX_PACKS
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pack_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_pack_day() TO authenticated;
