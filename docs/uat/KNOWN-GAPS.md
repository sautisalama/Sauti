# Known gaps and behaviours to be aware of

These were found while building the test suite. They are documented rather than silently accepted; none block acceptance, but owners should decide.

| # | Item | Impact | Suggested action |
|---|---|---|---|
| 2 | `VerificationQueue` component and `/api/admin/ban` are unused. | Dead code. | Wire up or delete. |
| 5 | Reports are stored unencrypted (protected by row-level security). | Database admins / backups can read stories. | Phase field-level encryption (narrative, contact) with `lib/security/crypto.ts`; keep matching fields plaintext. |
| 6 | Calendar token columns still exist on `profiles`. | Old tokens remain until phase 2. | Apply `20261009_drop_profile_calendar_token_columns.sql` after deploy. |
| 7 | Public booking rate limit is per server instance. | Spread across instances it is looser. | Move to Redis/Upstash if abused. |
| 8 | The monitor runs once a day (05:00 UTC) so it works on the free hosting plan. | A case that crosses 24 hours just after a run is reported up to a day later. | Shorten the 24-hour limit, or run more often on a paid plan. |
| 9 | Private voice-note bucket (`20261008_private_report_audio.sql`), restricted notifications insert, dropped token columns, private `availability_blocks` (`20261010_availability_blocks_private.sql`) are **dev only** until the code is deployed. | Prod voice notes remain public until applied. | Apply after deploy. |
| 10 | Dashboard security settings: OTP expiry, leaked-password protection, Postgres upgrade. | Advisor warnings. | Change in Supabase dashboard. |

## Resolved since the first run

* **Survivor completion and rating** — built (`confirmCaseOutcome`, `CaseOutcomeDialog`); covered by `08-case-outcome`.
* **Pending offers and capacity** — up to 5 unanswered offers no longer count toward the 5-case limit.
* **Editing service documents** — no longer resets a verified provider to "under review"; only `pending`/`rejected` profiles move to `under_review`, and only when documents actually change.
* **Provider profile exposure** — profiles of providers are visible only to verified providers and to survivors with a match, appointment or private chat (`20261011_profiles_visibility.sql`).

## Found while building the second documentation pass

* **Policy wording.** The in-app Privacy Policy says identities are protected with "end-to-end encryption". Messages and reports are protected by access rules and encryption in transit, not end-to-end. Reword the policy.
* **Anonymous accounts** cannot be recovered (no real email) and never expire; an expiry date written by one older route is not enforced.
* **Booking hours** are fixed (weekdays 09:00 to 17:00 East Africa Time); providers cannot yet set their own.
* **Certificates** cannot be revoked or expired by an admin.
* **Fixed in this pass:** admins no longer see the provider setup card; "Revoke device" and "Log out of other devices" now really sign devices out; the booking page offers real availability; Salama AI bullet lists render correctly; the install banner no longer shows twice; the Switch, Checkbox and Slider are visible; form borders are soft instead of black.
