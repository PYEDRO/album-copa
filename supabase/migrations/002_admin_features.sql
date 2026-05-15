-- ============================================================
-- 002_admin_features.sql
-- Admin roles, RLS policies, sticker storage bucket
-- ============================================================

-- ── 1. SECURITY DEFINER helper (avoids RLS recursion) ───────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ── 2. profiles: admins can read ALL rows ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (id = auth.uid() OR is_admin());
  END IF;
END$$;

-- Admins can update any profile (promote/demote)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can update any profile'
  ) THEN
    CREATE POLICY "Admins can update any profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

-- ── 3. user_stickers: admins can read all rows ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_stickers' AND policyname = 'Admins can view all user_stickers'
  ) THEN
    CREATE POLICY "Admins can view all user_stickers"
      ON user_stickers FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
END$$;

-- Admins can reset (delete) any user's stickers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_stickers' AND policyname = 'Admins can delete any user_stickers'
  ) THEN
    CREATE POLICY "Admins can delete any user_stickers"
      ON user_stickers FOR DELETE
      TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
END$$;

-- ── 4. daily_claims: admins can read all rows ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_claims' AND policyname = 'Admins can view all daily_claims'
  ) THEN
    CREATE POLICY "Admins can view all daily_claims"
      ON daily_claims FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
END$$;

-- ── 5. pack_logs: admins can read all rows ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pack_logs' AND policyname = 'Admins can view all pack_logs'
  ) THEN
    CREATE POLICY "Admins can view all pack_logs"
      ON pack_logs FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
END$$;

-- ── 6. stickers: admins can insert / update / delete ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stickers' AND policyname = 'Admins can insert stickers'
  ) THEN
    CREATE POLICY "Admins can insert stickers"
      ON stickers FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stickers' AND policyname = 'Admins can update stickers'
  ) THEN
    CREATE POLICY "Admins can update stickers"
      ON stickers FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stickers' AND policyname = 'Admins can delete stickers'
  ) THEN
    CREATE POLICY "Admins can delete stickers"
      ON stickers FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;
END$$;

-- ── 7. Storage bucket for sticker images ─────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('sticker-images', 'sticker-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read (any visitor can view card images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Public read sticker images'
  ) THEN
    CREATE POLICY "Public read sticker images"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'sticker-images');
  END IF;
END$$;

-- Admins can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Admins can upload sticker images'
  ) THEN
    CREATE POLICY "Admins can upload sticker images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'sticker-images' AND is_admin());
  END IF;
END$$;

-- Admins can replace/update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Admins can update sticker images'
  ) THEN
    CREATE POLICY "Admins can update sticker images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'sticker-images' AND is_admin());
  END IF;
END$$;

-- Admins can delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Admins can delete sticker images'
  ) THEN
    CREATE POLICY "Admins can delete sticker images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'sticker-images' AND is_admin());
  END IF;
END$$;
