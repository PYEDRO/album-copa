-- Migration 016: limite diário do jogo no SERVIDOR (anti multi-dispositivo)
--
-- O limite de partidas/dia vivia só no localStorage (por navegador), então
-- logar em celular + PC dobrava as recompensas. Aqui o limite passa a ser
-- enforçado no banco: conta os game_claims do dia (cada claim = 1 vitória
-- premiada) e bloqueia além de MAX_DAILY_CLAIMS, independente do dispositivo.

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
  c_max_daily   CONSTANT INT := 5;   -- mesmo valor do MAX_GUESSES_PER_DAY do front
  v_today       DATE := CURRENT_DATE;
  v_claims_today INT;
  v_rarity      TEXT;
  v_score_gain  INT;
BEGIN
  -- Limite diário por USUÁRIO (não por dispositivo)
  SELECT COUNT(*) INTO v_claims_today
  FROM game_claims
  WHERE user_id = p_user_id AND claim_date = v_today;

  IF v_claims_today >= c_max_daily THEN
    RETURN jsonb_build_object('success', false, 'error', 'DAILY_LIMIT_REACHED');
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

  -- Registra o claim
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
