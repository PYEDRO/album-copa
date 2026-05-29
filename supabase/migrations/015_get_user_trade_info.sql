-- Migration 015: RPC para buscar nome e repetidas de um usuário específico
-- Usado no modal de proposta de troca quando o UUID é digitado manualmente.
-- SECURITY DEFINER bypassa RLS para leitura de user_stickers de outro usuário.

CREATE OR REPLACE FUNCTION public.get_user_trade_info(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_ids  TEXT[];
BEGIN
  -- Verifica se o usuário existe
  SELECT name INTO v_name
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Coleta figurinhas com qty > 1 (repetidas disponíveis para troca)
  SELECT array_agg(sticker_id::TEXT) INTO v_ids
  FROM public.user_stickers
  WHERE user_id = p_target_user_id AND quantity > 1;

  RETURN jsonb_build_object(
    'found',                  true,
    'name',                   v_name,
    'duplicate_sticker_ids',  COALESCE(v_ids, '{}')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_trade_info(UUID) TO authenticated;
