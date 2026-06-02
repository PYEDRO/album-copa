-- Migration 020: limite de 1 pack por dia (ciclo que vira às 12:00)
--
-- Regra final: 1 pack por dia, liberado às 12:00 de Fortaleza, renovando no
-- próximo meio-dia. Recria claim_daily_pack e get_pack_status com MAX_PACKS = 1.
-- Depende de current_pack_day() (migration 019).

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
  MAX_PACKS      CONSTANT INTEGER := 1;
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

CREATE OR REPLACE FUNCTION public.get_pack_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INTEGER;
  MAX_PACKS CONSTANT INTEGER := 1;
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
