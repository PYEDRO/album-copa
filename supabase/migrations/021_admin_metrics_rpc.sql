-- Migration 021: RPC de métricas do painel admin
-- Antes, o front baixava linhas de user_stickers / daily_claims e somava no cliente.
-- Como o PostgREST limita a resposta a 1000 linhas, os totais ficavam capados em ~1000.
-- Esta função calcula tudo no banco (SUM/DISTINCT), sem limite de linhas.

CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS TABLE (
  total_users           BIGINT,
  active_today          BIGINT,
  active_last_7_days    BIGINT,
  packs_opened_today    BIGINT,
  total_stickers_issued BIGINT,
  unique_stickers       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    DATE := public.current_pack_day();
  v_week_ago DATE := public.current_pack_day() - INTERVAL '7 days';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles)                                              AS total_users,
    (SELECT COUNT(DISTINCT user_id) FROM daily_claims
       WHERE claim_date = v_today)                                              AS active_today,
    (SELECT COUNT(DISTINCT user_id) FROM daily_claims
       WHERE claim_date >= v_week_ago)                                          AS active_last_7_days,
    (SELECT COUNT(*) FROM pack_logs WHERE log_date = v_today)                   AS packs_opened_today,
    (SELECT COALESCE(SUM(quantity), 0) FROM user_stickers)                      AS total_stickers_issued,
    (SELECT COUNT(*) FROM stickers)                                             AS unique_stickers;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_metrics() TO authenticated;
