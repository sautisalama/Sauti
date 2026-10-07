-- `reports` held survivors' incident details, phone numbers and voice-note links,
-- but the policies let ANY signed-in user read, edit or delete every report whose
-- user_id was NULL, and let anyone insert a report on behalf of any user_id.
-- Reports are now strictly the reporting user's own. (Matched service providers
-- keep their existing separate read policy.)

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reports" ON public.reports;
CREATE POLICY "Users can update own reports" ON public.reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;
CREATE POLICY "Users can delete own reports" ON public.reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
CREATE POLICY "Users can insert own reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
