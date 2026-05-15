-- ============================================================
-- 004_approved_field.sql
-- Adiciona campo approved em profiles e garante que novos
-- usuários (email/senha E Google OAuth) nasçam com
-- approved = false, aguardando aprovação do admin.
-- ============================================================

-- ── 1. Adiciona coluna approved (se ainda não existir) ───────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Usuários já existentes sem aprovação explícita
--    são marcados como aprovados para não bloquear quem já usa.
--    Ajuste para false se quiser re-aprovar todos.
UPDATE public.profiles
  SET approved = true
  WHERE approved = false;

-- ── 3. Atualiza handle_new_user para sempre criar perfil
--    com approved = false, independente do provider OAuth.
--    Tanto login com Google quanto email/senha passam por aqui.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, approved)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',        -- email/senha: passa name nos metadata
      NEW.raw_user_meta_data->>'full_name',   -- Google OAuth: usa full_name
      split_part(NEW.email, '@', 1)           -- fallback: parte local do email
    ),
    false   -- sempre pendente de aprovação, independente do provider
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotente: não duplica se já existir
  RETURN NEW;
END;
$$;

-- Recria o trigger (DROP + CREATE para garantir a versão atualizada)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
