-- DEPLOY-ORDER: applied to DEV. Apply to PRODUCTION only AFTER deploying the app version in which every
-- cross-user notification is written with the service role (lib/notifications, app/actions/matching.ts,
-- app/api/services/share). The currently deployed code writes them as the sender and would be blocked.

-- ── notifications: anyone (even anonymous visitors) could insert a notification for ANY user ──
-- Server code now notifies other users with the service role. Clients may only create
-- notifications for themselves (or unaddressed ones); admins may notify anyone.
DROP POLICY IF EXISTS "System/Functions can insert notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid() OR public.is_admin(auth.uid()));
