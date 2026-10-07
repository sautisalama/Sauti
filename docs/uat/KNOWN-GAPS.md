# Known gaps and behaviours to be aware of

These were found while building the test suite. They are documented rather than silently accepted; none block acceptance, but owners should decide.

| # | Item | Impact | Suggested action |
|---|---|---|---|
| 1 | Survivor-side case completion / feedback UI is unused (`handleComplete`, `is_surv_complete` never set). | Survivors cannot mark a case done or leave a review. | Build or remove the review feature. |
| 2 | `VerificationQueue` component and `/api/admin/ban` are unused. | Dead code. | Wire up or delete. |
| 3 | Pending (not yet accepted) offers count toward a provider's 5-case capacity. | A provider with 5 unanswered offers stops receiving matches. | Product decision. |
| 4 | Changing service documents demotes the owner's profile to "under review" (trigger `update_verification_status`). | Provider briefly unmatchable after editing. | Confirm intended. |
| 5 | Reports are stored unencrypted (protected by row-level security). | Database admins / backups can read stories. | Phase field-level encryption (narrative, contact) with `lib/security/crypto.ts`; keep matching fields plaintext. |
| 6 | Calendar token columns still exist on `profiles`. | Old tokens remain until phase 2. | Apply `20261009_drop_profile_calendar_token_columns.sql` after deploy. |
| 7 | Public booking rate limit is per server instance. | Spread across instances it is looser. | Move to Redis/Upstash if abused. |
| 8 | Vercel hourly cron needs a Pro plan. | Monitor won't run on Hobby. | Use an external scheduler hitting the route. |
| 9 | Private voice-note bucket (`20261008_private_report_audio.sql`), restricted notifications insert, dropped token columns, private `availability_blocks` (`20261010_availability_blocks_private.sql`) are **dev only** until the code is deployed. | Prod voice notes remain public until applied. | Apply after deploy. |
| 10 | Dashboard security settings: OTP expiry, leaked-password protection, Postgres upgrade. | Advisor warnings. | Change in Supabase dashboard. |
| 11 | The policy "Public profiles are viewable by authenticated users" exposes the **whole profile row** (including email and phone) of any verified professional/NGO with public booking on, to every signed-in user. The public booking page itself hides these fields. | A signed-in survivor can read a public provider's email/phone through the API. | Move reads of other people's profiles behind a view/RPC with safe columns (as done for chat participants), then drop the policy. Needs a pass over every screen that reads another profile. |
