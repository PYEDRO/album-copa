-- Migration 014: enforce duplicate-only trades
-- Tanto o ofertante quanto o aceitante precisam ter >= 2 cópias
-- de cada figurinha envolvida na troca (só pode trocar repetidas).

CREATE OR REPLACE FUNCTION public.execute_trade(p_trade_id UUID, p_acceptor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade       public.trades%ROWTYPE;
  v_sticker_id  TEXT;
  v_qty         INTEGER;
BEGIN
  -- Lock and fetch trade
  SELECT * INTO v_trade
  FROM public.trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRADE_NOT_FOUND';
  END IF;

  IF v_trade.status <> 'pending' THEN
    RAISE EXCEPTION 'TRADE_NOT_PENDING';
  END IF;

  IF v_trade.to_user_id <> p_acceptor_id THEN
    RAISE EXCEPTION 'TRADE_UNAUTHORIZED';
  END IF;

  -- Validate offerer has at least 2 copies of each offered sticker (only duplicates can be traded)
  FOREACH v_sticker_id IN ARRAY v_trade.offered_sticker_ids
  LOOP
    SELECT quantity INTO v_qty
    FROM public.user_stickers
    WHERE user_id = v_trade.from_user_id AND sticker_id = v_sticker_id;

    IF NOT FOUND OR v_qty < 2 THEN
      RAISE EXCEPTION 'OFFERER_MISSING_STICKER:%', v_sticker_id;
    END IF;
  END LOOP;

  -- Validate acceptor has at least 2 copies of each requested sticker (only duplicates can be traded)
  FOREACH v_sticker_id IN ARRAY v_trade.requested_sticker_ids
  LOOP
    SELECT quantity INTO v_qty
    FROM public.user_stickers
    WHERE user_id = v_trade.to_user_id AND sticker_id = v_sticker_id;

    IF NOT FOUND OR v_qty < 2 THEN
      RAISE EXCEPTION 'ACCEPTOR_MISSING_STICKER:%', v_sticker_id;
    END IF;
  END LOOP;

  -- Transfer offered stickers: from → to
  FOREACH v_sticker_id IN ARRAY v_trade.offered_sticker_ids
  LOOP
    UPDATE public.user_stickers SET quantity = quantity - 1
    WHERE user_id = v_trade.from_user_id AND sticker_id = v_sticker_id;

    INSERT INTO public.user_stickers (user_id, sticker_id, quantity)
    VALUES (v_trade.to_user_id, v_sticker_id, 1)
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET quantity = public.user_stickers.quantity + 1, last_updated_at = NOW();
  END LOOP;

  -- Transfer requested stickers: to → from
  FOREACH v_sticker_id IN ARRAY v_trade.requested_sticker_ids
  LOOP
    UPDATE public.user_stickers SET quantity = quantity - 1
    WHERE user_id = v_trade.to_user_id AND sticker_id = v_sticker_id;

    INSERT INTO public.user_stickers (user_id, sticker_id, quantity)
    VALUES (v_trade.from_user_id, v_sticker_id, 1)
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET quantity = public.user_stickers.quantity + 1, last_updated_at = NOW();
  END LOOP;

  -- Finalize trade
  UPDATE public.trades SET
    status       = 'accepted',
    completed_at = NOW()
  WHERE id = p_trade_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
