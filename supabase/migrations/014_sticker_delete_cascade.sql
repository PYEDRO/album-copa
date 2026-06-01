-- Migration 014: permite excluir figurinhas sem violar FK
--
-- Tres tabelas referenciam stickers(id) sem ON DELETE, o que bloqueia o
-- DELETE de uma figurinha (erro game_claims_sticker_id_fkey). Recria os FKs
-- com o comportamento correto:
--   user_stickers / game_claims -> CASCADE (a linha so existe por causa da figurinha)
--   quiz_questions              -> SET NULL (referencia opcional)

-- user_stickers.sticker_id -> CASCADE
ALTER TABLE public.user_stickers
  DROP CONSTRAINT IF EXISTS user_stickers_sticker_id_fkey;
ALTER TABLE public.user_stickers
  ADD CONSTRAINT user_stickers_sticker_id_fkey
  FOREIGN KEY (sticker_id) REFERENCES public.stickers(id) ON DELETE CASCADE;

-- game_claims.sticker_id -> CASCADE
ALTER TABLE public.game_claims
  DROP CONSTRAINT IF EXISTS game_claims_sticker_id_fkey;
ALTER TABLE public.game_claims
  ADD CONSTRAINT game_claims_sticker_id_fkey
  FOREIGN KEY (sticker_id) REFERENCES public.stickers(id) ON DELETE CASCADE;

-- quiz_questions.related_sticker_id -> SET NULL
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_related_sticker_id_fkey;
ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_related_sticker_id_fkey
  FOREIGN KEY (related_sticker_id) REFERENCES public.stickers(id) ON DELETE SET NULL;
