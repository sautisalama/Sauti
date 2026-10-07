-- DEPLOY-GATED: apply to production only AFTER the code that reads other people's availability through
-- the service role (app/actions/availability.ts busyReader) is live. Already applied to dev.
-- Blocks (and their free-text reason) become private to their owner; others see busy times only via
-- the server actions and the SECURITY DEFINER slot functions.
DROP POLICY IF EXISTS "Authenticated users can view availability blocks" ON public.availability_blocks;
