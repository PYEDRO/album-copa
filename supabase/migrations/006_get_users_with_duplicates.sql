-- Migration 006: RPC para buscar usuários com figurinhas repetidas
-- Usa SECURITY DEFINER para ignorar RLS e acessar todos os user_stickers

CREATE OR REPLACE FUNCTION public.get_users_with_duplicates(p_current_user_id UUID)
RETURNS TABLE (
  user_id       UUID,
  user_name     TEXT,
  duplicate_count BIGINT,
  sticker_ids   TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    us.user_id,
    p.name                          AS user_name,
    SUM(us.quantity - 1)::BIGINT   AS duplicate_count,
    array_agg(us.sticker_id::TEXT) AS sticker_ids
  FROM user_stickers us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.quantity > 1
    AND us.user_id != p_current_user_id
  GROUP BY us.user_id, p.name
  HAVING SUM(us.quantity - 1) >= 1
  ORDER BY duplicate_count DESC;
END;
$$;
