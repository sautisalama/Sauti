---
title: "Start the dev server with EMAIL_MODE=capture before running any e2e or audit script, and keep the exit button off provider screens"
author: Oliver
date: 2026-10-31
branch: main
cost: { minutes: 98, tokens: 167741 }
id: l-b6092531
scope: repo
status: active
src: agent
touches:
  - scripts/e2e/audit-ux.mjs
  - components/safety/ExitPageButton.tsx
  - docs/ux/AUDIT-2026-10-31.md
  - app/globals.css
  - components/cases/CaseCard.tsx
---

## Decided
- Survivors get an "Exit this page" button (amber, outside the brand palette) plus Shift three times, on the report, signup and sign-in pages and on survivor dashboards only. Providers never see it, to avoid clutter. Exit destination is one constant, to be confirmed with partner organisations.
- The signed-in app has a scoped "calm typography" layer (class ss-calm on the dashboard root) that removes all-caps, floors text at 12px, lightens 900 weights and darkens light greys. It is a stopgap over hundreds of components; the real fix is removing those classes at source.
- Provider case cards say "Needs your response" / "In progress" / "Completed" with "Received N minutes ago". Admin overview shows cases that waited 24 hours, using the same rules as the daily escalation email.

## Tried and ruled out
- Rewriting the 577 uppercase and 358 tiny-text usages one by one: too large and risky for one pass.
- Dribbble and Pinterest could not be read in detail through search, so queue patterns came from help-desk and trauma-informed sources.

## Watch out
- The UAT harness needs the dev server started as EMAIL_MODE=capture npm run dev. Started plainly, test runs sent real emails to the team and to Oliver (New Abuse Report, Delayed Support, Verification documents submitted). Check email_log after any run.
- UAT tests that read page text broke when CSS uppercase was removed (MAT-21 matched "PENDING"). Assert on the real wording.
- Known unrelated failures: VER-03 counts old pending professionals already in the dev project; SCH-34 fails at the end of a month because the next weekday is not on the displayed calendar month.
In the code: components/safety/ExitPageButton.tsx, app/globals.css (.ss-calm), components/cases/CaseCard.tsx, lib/report-labels.ts, app/actions/admin-escalations.ts, scripts/e2e/audit-verify.mjs, docs/ux/AUDIT-2026-10-31.md.
