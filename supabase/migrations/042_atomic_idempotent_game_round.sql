-- ============================================================
-- 042_atomic_idempotent_game_round.sql
--
-- OBJETIVO: eliminar os DOIS riscos residuais do jogo, que existiam porque
-- "gravar a pergunta" (record_game_play) e "entregar a carta" (claim-game-reward,
-- edge function) eram operações SEPARADAS e não atômicas:
--   • Risco 1: resgate dá certo, gravar a pergunta falha → carta sem tentativa.
--   • Risco 2: resposta de sucesso se perde na rede → retry concede prêmio 2x.
--
-- SOLUÇÃO: uma ÚNICA função play_game_round() que faz TUDO numa transação:
--   1) tetos diários (5 perguntas / 5 recompensas) pelo dia-do-jogo (current_game_day);
--   2) grava a pergunta (game_plays);
--   3) SELECIONA a carta no próprio SQL — só NÃO possuídas, "lendária primeiro",
--      e ponderada por raridade (mesmos pesos da edge function);
--   4) entrega (game_claims + user_stickers + score);
--   tudo atômico → ou acontece inteiro, ou nada. Sem estado parcial (Risco 1).
--   Idempotente por TOKEN do cartão (client_token) → repetir a MESMA jogada
--   (retry/duplo-clique/resposta perdida) devolve o MESMO resultado sem conceder
--   de novo (Risco 2).
--
-- ADITIVO E SEGURO: NÃO altera nem remove record_game_play, claim_game_reward,
--   as funções de troca, RLS, packs ou ranking. As colunas novas em game_plays
--   são NULLABLE (inserts antigos continuam válidos). A edge function antiga
--   segue existindo como rede de segurança (deixa de ser usada pelo front).
-- ============================================================

-- ── 1) Colunas de idempotência + carta entregue (NULLABLE: não quebra nada) ──
ALTER TABLE public.game_plays
  ADD COLUMN IF NOT EXISTS client_token      UUID,
  ADD COLUMN IF NOT EXISTS reward_sticker_id TEXT;

-- Token único quando presente (idempotência). Parcial: linhas antigas (NULL) ok.
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_plays_client_token
  ON public.game_plays (client_token)
  WHERE client_token IS NOT NULL;

-- ── 2) Função atômica + idempotente ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.play_game_round(
  p_won               BOOLEAN,
  p_target_sticker_id TEXT,
  p_client_token      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_max_plays  CONSTANT INT := 5;   -- perguntas/dia
  c_max_claims CONSTANT INT := 5;   -- recompensas/dia
  v_uid        UUID := auth.uid();
  v_today      DATE := public.current_game_day();
  v_plays      INT;
  v_claims     INT;
  v_existing   public.game_plays%ROWTYPE;
  v_reward_id  TEXT;
  v_rarity     TEXT;
  v_score_gain INT;
  v_has_legendary BOOLEAN;
  v_reward     JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- ── IDEMPOTÊNCIA: já processamos este token? Devolve o MESMO desfecho. ──
  IF p_client_token IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.game_plays
    WHERE client_token = p_client_token;

    IF FOUND THEN
      SELECT COUNT(*) INTO v_plays
      FROM public.game_plays WHERE user_id = v_uid AND play_date = v_today;

      IF v_existing.reward_sticker_id IS NOT NULL THEN
        SELECT to_jsonb(s.*) INTO v_reward FROM public.stickers s
        WHERE s.id = v_existing.reward_sticker_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true, 'replay', true,
        'won', v_existing.won,
        'allowed', true,
        'reward', v_reward,
        'plays_remaining', GREATEST(c_max_plays - v_plays, 0)
      );
    END IF;
  END IF;

  -- ── Teto de PERGUNTAS do dia ──
  SELECT COUNT(*) INTO v_plays
  FROM public.game_plays WHERE user_id = v_uid AND play_date = v_today;

  IF v_plays >= c_max_plays THEN
    RETURN jsonb_build_object(
      'success', false, 'allowed', false,
      'error', 'DAILY_PLAY_LIMIT', 'plays_remaining', 0
    );
  END IF;

  -- ════════════ ERRO: grava a pergunta e encerra ════════════
  IF NOT COALESCE(p_won, false) THEN
    INSERT INTO public.game_plays (user_id, play_date, won, sticker_id, client_token)
    VALUES (v_uid, v_today, false, p_target_sticker_id, p_client_token);

    RETURN jsonb_build_object(
      'success', true, 'allowed', true, 'won', false,
      'plays_remaining', GREATEST(c_max_plays - (v_plays + 1), 0)
    );
  END IF;

  -- ════════════ ACERTO ════════════
  -- Teto de RECOMPENSAS do dia: se atingido, grava a pergunta mas não entrega.
  SELECT COUNT(*) INTO v_claims
  FROM public.game_claims WHERE user_id = v_uid AND claim_date = v_today;

  IF v_claims >= c_max_claims THEN
    INSERT INTO public.game_plays (user_id, play_date, won, sticker_id, client_token)
    VALUES (v_uid, v_today, true, p_target_sticker_id, p_client_token);

    RETURN jsonb_build_object(
      'success', true, 'allowed', true, 'won', true,
      'reward', NULL, 'reason', 'DAILY_LIMIT_REACHED',
      'plays_remaining', GREATEST(c_max_plays - (v_plays + 1), 0)
    );
  END IF;

  -- ── Seleção da carta: SÓ não possuídas; "lendária primeiro"; depois pesos ──
  SELECT EXISTS (
    SELECT 1 FROM public.stickers s
    WHERE s.rarity = 'legendary'
      AND NOT EXISTS (SELECT 1 FROM public.user_stickers us
                      WHERE us.user_id = v_uid AND us.sticker_id = s.id)
  ) INTO v_has_legendary;

  SELECT s.id INTO v_reward_id
  FROM public.stickers s
  WHERE NOT EXISTS (
          SELECT 1 FROM public.user_stickers us
          WHERE us.user_id = v_uid AND us.sticker_id = s.id
        )
    AND (NOT v_has_legendary OR s.rarity = 'legendary')
  ORDER BY power(
    random(),
    1.0 / CASE s.rarity
            WHEN 'legendary' THEN 120
            WHEN 'epic'      THEN 35
            WHEN 'rare'      THEN 20
            ELSE 15
          END
  ) DESC
  LIMIT 1;

  -- Álbum completo (nada não-possuído): grava a pergunta, sem recompensa.
  IF v_reward_id IS NULL THEN
    INSERT INTO public.game_plays (user_id, play_date, won, sticker_id, client_token)
    VALUES (v_uid, v_today, true, p_target_sticker_id, p_client_token);

    RETURN jsonb_build_object(
      'success', true, 'allowed', true, 'won', true,
      'reward', NULL, 'reason', 'ALBUM_COMPLETE',
      'plays_remaining', GREATEST(c_max_plays - (v_plays + 1), 0)
    );
  END IF;

  -- ── Entrega atômica ──
  SELECT rarity INTO v_rarity FROM public.stickers WHERE id = v_reward_id;
  v_score_gain := CASE v_rarity
    WHEN 'common' THEN 1 WHEN 'rare' THEN 3
    WHEN 'epic' THEN 7 WHEN 'legendary' THEN 15 ELSE 1 END;

  INSERT INTO public.game_plays (user_id, play_date, won, sticker_id, client_token, reward_sticker_id)
  VALUES (v_uid, v_today, true, p_target_sticker_id, p_client_token, v_reward_id);

  INSERT INTO public.game_claims (user_id, claim_date, sticker_id)
  VALUES (v_uid, v_today, v_reward_id);

  INSERT INTO public.user_stickers (user_id, sticker_id, quantity)
  VALUES (v_uid, v_reward_id, 1)
  ON CONFLICT (user_id, sticker_id)
  DO UPDATE SET quantity = public.user_stickers.quantity + 1, last_updated_at = NOW();

  UPDATE public.profiles SET score = score + v_score_gain WHERE id = v_uid;

  SELECT to_jsonb(s.*) INTO v_reward FROM public.stickers s WHERE s.id = v_reward_id;

  RETURN jsonb_build_object(
    'success', true, 'allowed', true, 'won', true,
    'reward', v_reward, 'score_gained', v_score_gain,
    'plays_remaining', GREATEST(c_max_plays - (v_plays + 1), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.play_game_round(BOOLEAN, TEXT, UUID) TO authenticated;
