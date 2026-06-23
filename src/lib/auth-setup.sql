-- ──────────────────────────────────────────────────────────────
-- ShopFloor AI — Auth Setup Migration
-- Run this in the Supabase SQL Editor AFTER running seed.sql.
--
-- Before running, go to:
--   Supabase Dashboard → Authentication → Providers → Email
--   and disable "Confirm email" so demo logins work immediately.
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────
-- 1. Profiles table
--    Automatically populated via trigger on signup.
-- ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID  REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name  TEXT,
  role       TEXT  DEFAULT 'planner'
                   CHECK (role IN ('admin', 'manager', 'planner', 'supervisor')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- ──────────────────────────────────────────────────
-- 2. Trigger: auto-create profile on signup
-- ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'planner'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ──────────────────────────────────────────────────
-- 3. Tighten RLS on all app tables
--    Drop the open anon_all policies and replace with
--    policies that require a valid authenticated session.
-- ──────────────────────────────────────────────────

-- products
DROP POLICY IF EXISTS "anon_all" ON products;
CREATE POLICY "Authenticated users can do everything"
  ON products FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- raw_materials
DROP POLICY IF EXISTS "anon_all" ON raw_materials;
CREATE POLICY "Authenticated users can do everything"
  ON raw_materials FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- bom_items
DROP POLICY IF EXISTS "anon_all" ON bom_items;
CREATE POLICY "Authenticated users can do everything"
  ON bom_items FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- work_orders
DROP POLICY IF EXISTS "anon_all" ON work_orders;
CREATE POLICY "Authenticated users can do everything"
  ON work_orders FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- status_history
DROP POLICY IF EXISTS "anon_all" ON status_history;
CREATE POLICY "Authenticated users can do everything"
  ON status_history FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- inventory_transactions
DROP POLICY IF EXISTS "anon_all" ON inventory_transactions;
CREATE POLICY "Authenticated users can do everything"
  ON inventory_transactions FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
