# UAT — Professionals and NGOs

Sign in as `professional` (lawyer), `medic`, `ngo`, or `pending_pro`.

| ID | P | Steps | Expected |
|---|---|---|---|
| PRO-01 | M | Sign in as `pending_pro`. | Dashboard shows "under review"; no cases are received. |
| PRO-02 | M | After admin approval, reload as the same user. | Status "Fully Verified". |
| PRO-03 | M | A report is filed that suits your specialty and area. | You get an in-app notification and email. The case is **Pending** in your queue. |
| PRO-04 | M | Open the pending case. | You see type, urgency and area. You **cannot** read the survivor's story; secure messaging is locked. |
| PRO-05 | M | Accept the case with a greeting. | Case becomes **Accepted**; a chat opens; your greeting is the first message; the survivor is notified. |
| PRO-06 | M | After accepting, open the case. | The incident story is now readable. |
| PRO-07 | M | Another provider was also matched to the same report. | Their match is declined and they cannot read the story. |
| PRO-08 | M | Reply in chat; the survivor replies. | Messages arrive live, in both directions, once. |
| PRO-09 | M | Decline a case. | The report is re-matched through the cascade to another provider. |
| PRO-10 | M | Complete and archive an accepted case. | Survivor's report shows the new status; it no longer counts toward your workload (limit 5 active). |
| PRO-11 | S | Switch **Out of office** on, then file a matching report. | You are not matched; if public booking was on, visitors cannot book. |
| PRO-12 | M | Child case reported. | Every match is flagged for escalation; you receive the URGENT alert. |
| PRO-13 | M | Add a time block in **Availability**. | That time cannot be booked; time outside it can. |
| PRO-14 | M | Receive a public appointment request. | Notification + email; you can confirm it; it holds the slot while "requested". |
| PRO-15 | S | Connect Google Calendar in **Profile**. | Connected state shows; tokens are never visible in the browser. |
| PRO-16 | S | Create a community; another user joins and posts. | Member count correct; members see messages; non-members cannot. |
| PRO-17 | S | Change your service documents. | Your profile returns to "under review" (known behaviour — see KNOWN-GAPS). |
| PRO-18 | M | **Profile, Calendar**: block a time, with and without weekly repeat; remove it. | The block appears under its day; that time can no longer be booked or offered; removal frees it |
| PRO-19 | M | Attach a verification document to your profile or service. | The team (malkia@ and oliver@sautisalama.org) receives one email, and admins a notification. Removing a document sends nothing |
| PRO-20 | M | **Delete account** while you hold an open case. | The case is cancelled, the survivor is told and re-matched, your services are removed |
| PRO-21 | S | Finish onboarding as a new provider. | The Setup in Progress card is replaced by the full provider menu at once |
