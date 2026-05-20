-- Migration 005: game_claims table + claim_game_reward function

-- Tabela de recompensas do jogo diário
CREATE TABLE IF NOT EXISTS public.game_claims (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  sticker_id  TEXT        NOT NULL REFERENCES public.stickers(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, claim_date)
);

ALTER TABLE public.game_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own game claims"
  ON public.game_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Índice para lookup diário rápido
CREATE INDEX IF NOT EXISTS idx_game_claims_user_date
  ON public.game_claims (user_id, claim_date);

-- ──────────────────────────────────────────────────────────────
-- Função: claim_game_reward
-- Salva atomicamente a figurinha ganha no jogo do dia.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_game_reward(
  p_user_id    UUID,
  p_sticker_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       DATE := CURRENT_DATE;
  v_rarity      TEXT;
  v_score_gain  INT;
BEGIN
  -- Idempotência: já resgatou hoje?
  IF EXISTS (
    SELECT 1 FROM game_claims
    WHERE user_id = p_user_id AND claim_date = v_today
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'GAME_REWARD_ALREADY_CLAIMED');
  END IF;

  -- Busca raridade para calcular score
  SELECT rarity INTO v_rarity FROM stickers WHERE id = p_sticker_id;

  v_score_gain := CASE v_rarity
    WHEN 'common'    THEN 1
    WHEN 'rare'      THEN 3
    WHEN 'epic'      THEN 7
    WHEN 'legendary' THEN 15
    ELSE 1
  END;

  -- Registra o claim do dia
  INSERT INTO game_claims (user_id, claim_date, sticker_id)
  VALUES (p_user_id, v_today, p_sticker_id);

  -- Adiciona figurinha ao inventário
  INSERT INTO user_stickers (user_id, sticker_id, quantity)
  VALUES (p_user_id, p_sticker_id, 1)
  ON CONFLICT (user_id, sticker_id)
  DO UPDATE SET quantity = user_stickers.quantity + 1;

  -- Incrementa score do jogador
  UPDATE profiles
  SET score = score + v_score_gain
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'score_gained', v_score_gain);
END;
$$;
