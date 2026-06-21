
-- Deny-all RLS for INSERT/UPDATE/DELETE on sensitive tables.
-- Service role bypasses RLS, so trusted server code keeps working.

-- funding_intents
CREATE POLICY "deny insert funding_intents" ON public.funding_intents FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny update funding_intents" ON public.funding_intents FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny delete funding_intents" ON public.funding_intents FOR DELETE TO authenticated USING (false);

-- user_pins
CREATE POLICY "deny insert user_pins" ON public.user_pins FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny update user_pins" ON public.user_pins FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny delete user_pins" ON public.user_pins FOR DELETE TO authenticated USING (false);

-- wallets
CREATE POLICY "deny insert wallets" ON public.wallets FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny update wallets" ON public.wallets FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny delete wallets" ON public.wallets FOR DELETE TO authenticated USING (false);

-- user_roles (privilege escalation guard)
CREATE POLICY "deny insert user_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny update user_roles" ON public.user_roles FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny delete user_roles" ON public.user_roles FOR DELETE TO authenticated USING (false);

-- transactions
CREATE POLICY "deny insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny update transactions" ON public.transactions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny delete transactions" ON public.transactions FOR DELETE TO authenticated USING (false);

-- Restrict SECURITY DEFINER admin-promotion function to server-side callers only.
REVOKE ALL ON FUNCTION public.promote_to_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(text) TO service_role;

-- Also lock down the wallet credit/debit helpers — these must never be called by signed-in users directly.
REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.debit_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric) TO service_role;
