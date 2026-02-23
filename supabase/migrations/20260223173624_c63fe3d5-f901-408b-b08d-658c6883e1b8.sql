
-- Force drop ALL existing policies and recreate as explicitly PERMISSIVE

-- products
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY %I ON public.products', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "products_select" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update" ON public.products AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "products_delete" ON public.products AS PERMISSIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'::app_role));

-- action_history
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'action_history' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY %I ON public.action_history', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "action_history_select" ON public.action_history AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "action_history_insert" ON public.action_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

-- profiles
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_roles
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_roles_select" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_manage" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'::app_role));
