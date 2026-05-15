-- ============================================================
-- SCRIPT: Excluir todos os usuários existentes
-- ⚠️  IRREVERSÍVEL — rode apenas em ambiente de desenvolvimento
--     ou quando quiser zerar a base antes do lançamento.
--
-- Como usar:
--   Supabase Dashboard → SQL Editor → New query → cole e Run
-- ============================================================

-- 1. Remove dados dependentes (cascata já cuida, mas explicitamos)
DELETE FROM public.leaderboard_cache;
DELETE FROM public.quiz_answers;
DELETE FROM public.trade_pool;
DELETE FROM public.trades;
DELETE FROM public.pack_logs;
DELETE FROM public.daily_claims;
DELETE FROM public.user_stickers;
DELETE FROM public.profiles;

-- 2. Remove os usuários da tabela de autenticação do Supabase
--    (isso também deleta via CASCADE tudo que ainda sobrou)
DELETE FROM auth.users;

-- Verificação: deve retornar 0 em todas as linhas
SELECT 'auth.users'        AS tabela, COUNT(*) AS total FROM auth.users
UNION ALL
SELECT 'profiles'          AS tabela, COUNT(*) AS total FROM public.profiles
UNION ALL
SELECT 'user_stickers'     AS tabela, COUNT(*) AS total FROM public.user_stickers
UNION ALL
SELECT 'daily_claims'      AS tabela, COUNT(*) AS total FROM public.daily_claims;
