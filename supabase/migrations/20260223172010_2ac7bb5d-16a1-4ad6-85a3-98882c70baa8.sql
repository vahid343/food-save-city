
-- Drop all restrictive policies and recreate as permissive

-- products
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Managers can delete products" ON public.products;

CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can delete products" ON public.products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- action_history
DROP POLICY IF EXISTS "Authenticated users can insert actions" ON public.action_history;
DROP POLICY IF EXISTS "Authenticated users can view action history" ON public.action_history;

CREATE POLICY "Authenticated users can insert actions" ON public.action_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view action history" ON public.action_history FOR SELECT TO authenticated USING (true);

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Managers can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Managers can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
