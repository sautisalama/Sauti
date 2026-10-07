-- Make survivors' voice notes private.
--
-- DEPLOY ORDER MATTERS: apply this only AFTER the app version that plays audio
-- through /api/audio/sign (signed, access-checked URLs) is live. Before that,
-- playback uses the old public URLs and would break.
--
-- Uploads keep working (anyone may add a note under reports/), but nobody can
-- list or download objects directly any more: the bucket is not public and
-- there is no SELECT policy. Playback goes through the server, which signs a
-- 1-hour URL only for people who can already see the report that references it.

UPDATE storage.buckets SET public = false WHERE id = 'report-audio';

DROP POLICY IF EXISTS "Allow public read for reports" ON storage.objects;
