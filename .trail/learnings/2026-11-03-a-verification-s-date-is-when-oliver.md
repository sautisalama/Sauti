---
title: "A verification's date is when it was decided, never when the profile was last edited"
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 1, tokens: 1331 }
id: l-1e92c282
scope: repo
status: active
src: agent
touches:
  - app/dashboard/admin/_components/AdminActivitySection.tsx
---

## Decided
Admin history shows when a verification or rejection was decided: the reviewer's own record first, then the verified-at stamps, then the verification-updated stamp. Items show a day and date ("3 days ago · 12 Oct 2026"), not only a time. Clearing Recent History hides that section; the page's existing Management Console is what stays, nothing new is added in its place.

## Tried and ruled out
The profile's last-updated time as the date: it moves with every edit or sign-in, so any old verification is shown with a recent date. The database already holds the decision date, so no migration or backfill is needed, and a manual verification without a reviewer record still carries one in the verification-updated stamp.
A second Management Console card shown when history is cleared: it duplicated the one already on the page.

## Watch out
Any "when was this decided" display must not read the row's last-updated time. The clear action is per browser (local storage), not per account.

In the code: decidedAt and when() in app/dashboard/admin/_components/AdminActivitySection.tsx; clear key ss_admin_history_cleared.
