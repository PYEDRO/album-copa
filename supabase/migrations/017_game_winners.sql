-- Migration 017: registro automático de vencedores (álbum completo)
--
-- Quando um usuário passa a possuir TODAS as figurinhas do catálogo
-- (coleção completa), um trigger registra-o em game_winners com a posição
-- (1 = primeiro a completar). O painel admin lê essa tabela e avisa quem venceu.

-- ── Tabela de vencedores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_winners (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  position       INT         NOT NULL,          -- 1 = primeiro a completar
  total_stickers INT         NOT NULL,          -- tamanho do álbum no momento da vitória
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged   BOOLEAN     NOT NULL DEFAULT FALSE,  -- admin já marcou como visto?
  UNIQUE (user_id)                              -- cada vencedor aparece uma vez
);

ALTER TABLE public.game_winners ENABLE ROW LEVEL SECURITY;

-- Admins leem e atualizam (marcar como visto). Insert é via trigger (definer).
DROP POLICY IF EXISTS "Admins read winners"   ON public.game_winners;
CREATE POLICY "Admins read winners"
  ON public.game_winners FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admins update winners" ON public.game_winners;
CREATE POLICY "Admins update winners"
  ON public.game_winners FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Função: detecta álbum completo ─────────────────────────────
CREATE OR REPLACE FUNCTION public.check_album_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_catalog INT;
  v_user_unique   INT;
  v_name          TEXT;
  v_next_pos      INT;
BEGIN
  -- Tamanho atual do catálogo (ex.: 80). Se vazio, nada a fazer.
  SELECT COUNT(*) INTO v_total_catalog FROM stickers;
  IF v_total_catalog = 0 THEN
    RETURN NEW;
  END IF;

  -- Já é vencedor? Evita trabalho e mantém idempotência.
  IF EXISTS (SELECT 1 FROM game_winners WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- Quantas figurinhas ÚNICAS este usuário possui agora.
  SELECT COUNT(DISTINCT sticker_id) INTO v_user_unique
  FROM user_stickers
  WHERE user_id = NEW.user_id;

  -- Completou o álbum (possui todas do catálogo)?
  IF v_user_unique >= v_total_catalog THEN
    SELECT name INTO v_name FROM profiles WHERE id = NEW.user_id;
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_pos FROM game_winners;

    INSERT INTO game_winners (user_id, name, position, total_stickers)
    VALUES (NEW.user_id, COALESCE(v_name, 'Jogador'), v_next_pos, v_total_catalog)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger: a cada nova figurinha adicionada ao inventário ────
DROP TRIGGER IF EXISTS trg_album_completion ON public.user_stickers;
CREATE TRIGGER trg_album_completion
  AFTER INSERT ON public.user_stickers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_album_completion();

-- ── Backfill: registra quem JÁ completou antes desta migration ─
INSERT INTO public.game_winners (user_id, name, position, total_stickers, completed_at)
SELECT
  sub.user_id,
  COALESCE(p.name, 'Jogador'),
  ROW_NUMBER() OVER (ORDER BY sub.last_completed ASC),
  sub.uniq,
  sub.last_completed
FROM (
  SELECT us.user_id,
         COUNT(DISTINCT us.sticker_id) AS uniq,
         MAX(us.last_updated_at)        AS last_completed
  FROM public.user_stickers us
  GROUP BY us.user_id
  HAVING COUNT(DISTINCT us.sticker_id) >= (SELECT COUNT(*) FROM public.stickers)
) sub
JOIN public.profiles p ON p.id = sub.user_id
ON CONFLICT (user_id) DO NOTHING;
