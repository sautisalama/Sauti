-- Survivors' voice notes live in `report-audio`. The previous policy set let ANY
-- visitor (including anonymous) update or delete any object under reports/.
-- Keep what the product needs (anyone may upload a new note; notes stay readable
-- by link) and remove the ability to overwrite or delete other people's notes.
--
-- NOTE: the bucket is still public-read. Moving to a private bucket with signed
-- URLs (and an insert-only policy) is the recommended follow-up; it needs app
-- changes to playback, so it is not done here.

DROP POLICY IF EXISTS "Allow management for all" ON storage.objects;
