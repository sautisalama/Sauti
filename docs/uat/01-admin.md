# UAT — Administrators

Sign in as `admin`. Priority: **M** = must pass, **S** = should pass.

## Verification (ADM-V)

| ID | P | Steps | Expected |
|---|---|---|---|
| ADM-V1 | M | Open **Admin → Review**. | Pending professionals **and** NGOs are listed, with counts of applicants and services. |
| ADM-V2 | M | Open a pending professional. Check documents. Choose **Approve**, add a note. | Profile becomes verified; approval shows who approved and your note. |
| ADM-V3 | M | After V2, open the audit log / `admin_actions`. | An entry exists with the **previous** status. |
| ADM-V4 | M | Sign in as that professional. | They have an in-app notification and a "Fully Verified" status at **Profile → Verification**. |
| ADM-V5 | M | Approve one of that professional's services. | Service becomes verified **and active**; owner is notified; decision is audited. |
| ADM-V6 | M | Before V2, file a report that needs that kind of provider; approve afterwards. | The waiting report is matched to the newly approved provider, who is notified. |
| ADM-V7 | M | Reject an NGO with a reason. | Decision and reason recorded; NGO notified; its services are never matched. |
| ADM-V8 | M | Approve a shelter NGO. File a shelter-need report. | The shelter NGO is matched. |
| ADM-V9 | S | Ban a service. File a matching report. | The banned service is not matched. |
| ADM-V10 | M | Sign in as a non-admin and open the review URL. | You are refused; no queue data is returned. |
| ADM-V11 | M | As a signed-in user, try to set your own "verified/admin" fields (browser console). | Refused by the database. |

## Matching oversight (ADM-M)

| ID | P | Steps | Expected |
|---|---|---|---|
| ADM-M1 | M | Open **Admin → Matching**. | Unmatched reports and flagged ("needs manual review") reports are visible. |
| ADM-M2 | M | Run **match** on an unmatched report. | Matches are created without duplicates; providers and survivor are notified; manual-review flag clears. |
| ADM-M3 | S | Run **backfill**. | Only recent reports with no live match are processed (max 100); nothing is re-matched twice. |
| ADM-M4 | S | A report outside all coverage areas. | It is not force-matched and is flagged for you. |
| ADM-M5 | M | Wait 24 hours with an unmatched report (or use the seeded 30-hour-old one and call the monitor). | See `05-monitoring-and-security.md`. |

## Publications & courses

See `04-publishing-learning.md` (ADM-P / ADM-C).
