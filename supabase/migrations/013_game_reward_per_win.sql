-- Migration 013: permite múltiplas recompensas por dia (uma por vitória)
-- Remove a constraint UNIQUE (user_id, claim_date) e atualiza a RPC

-- Remove constraint de unicidade diária
ALTER TABLE public.game_claims
  DROP CONSTRAINT IF EXISTS game_claims_user_id_claim_date_key;

-- Atualiza a função para não bloquear múltiplos resgates no mesmo dia
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
  v_rarity      TEXT;
  v_score_gain  INT;
BEGIN
  -- Busca raridade para calcular score
  SELECT rarity INTO v_rarity FROM stickers WHERE id = p_sticker_id;

  v_score_gain := CASE v_rarity
    WHEN 'common'    THEN 1
    WHEN 'rare'      THEN 3
    WHEN 'epic'      THEN 7
    WHEN 'legendary' THEN 15
    ELSE 1
  END;

  -- Registra o claim
  INSERT INTO game_claims (user_id, claim_date, sticker_id)
  VALUES (p_user_id, CURRENT_DATE, p_sticker_id);

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
