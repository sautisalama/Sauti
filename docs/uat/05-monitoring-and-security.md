# UAT — Monitoring and security

## 24-hour "Delayed Support" escalation (OPS)

The monitor runs hourly (`/api/cron/escalate-stale-cases`, Vercel cron + `CRON_SECRET`).

| ID | P | Scenario | Expected |
|---|---|---|---|
| OPS-01 | M | Call the monitor with no or a wrong secret. | 401. |
| OPS-02 | M | A report unmatched for >24h. | Included in one **URGENT** email, subject exactly **Delayed Support**, to malkia@ and oliver@sautisalama.org. |
| OPS-03 | M | A match nobody responded to for >24h. | Included. |
| OPS-04 | M | An accepted match with no conversation for >24h. | Included. |
| OPS-05 | M | A report under 24h, or a record-only report. | Not included. |
| OPS-06 | M | Run the monitor again. | No second email for the same cases (ledger `case_escalation_alerts`). |
| OPS-07 | M | The email body. | Incident type, urgency, area, time waiting and a link to the matching dashboard — **no survivor name or contact details**. |
| OPS-08 | S | A declined match. | No longer flagged. |

Manual check (real email): set `ESCALATION_EMAILS` to your own address, deploy to a preview, and `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/escalate-stale-cases`.

## Security (SEC)

Covered by `scripts/e2e/security.mjs` (36 attacks, run with signed-in test users). Highlights a person can verify manually:

* A user cannot make themselves admin, verified, or unban themselves, and cannot verify their own service.
* A user cannot read another user's reports, matches, messages, or private community.
* A user cannot add themselves to someone else's chat.
* `/api/assistant`, `/api/audio/sign`, cron routes refuse unauthenticated callers.
* Link previews refuse private network addresses (SSRF).
* `?next=` redirects only to same-site paths.
