---
title: "Dark mode everywhere via palette variables, one workspace switcher, quiet hours and in-product escalation"
author: Oliver
date: 2026-10-31
branch: main
cost: { minutes: 65, tokens: 218303 }
id: l-e46b83a1
scope: repo
status: active
src: agent
touches:
  - app/api/mail/read/route.ts
  - app/dashboard/_views/ProfessionalView.tsx
  - app/dashboard/cases/cases-master-detail.tsx
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
  - app/dashboard/mjengo/mail/_components/MailApp.tsx
  - app/dashboard/mjengo/mail/_components/mail-store.ts
  - app/globals.css
  - app/layout.tsx
  - components/a11y/AccessibilityFAB.tsx
  - components/cases/CaseCard.tsx
---

## Decided
Dark mode now applies on every page, public site included. Tailwind v4 palette colours are CSS variables, so the neutral grays (50 to 700) and the hue tints (50 to 200) are inverted once in html.dark; 800 to 950 stay dark because they are used for intentionally dark panels and white text sits on hue 500 to 700 fills.
Workspaces (personal, admin, Mjengo suite) are defined by the URL. adminMode in localStorage only follows it. A new browser session reopens the last workspace; typing /dashboard is always respected. One WorkspaceMenu serves the sidebar and phone menus.
Quiet hours silence push only, stored in profiles.settings.quiet_hours; account notices and high-urgency cases still come through. Provider nudge at half the escalation window and a calm survivor follow-up at the full window use the existing escalation ledger.
## Watch out
The ledger kind check constraint must list every kind (migration 20261031 applied to dev and prod). The nudge runs inside the daily cron, so its timing is only as fine as the cron schedule.
Opening a saved opportunity must not auto-read its link: only a changed link or the Refresh from link button re-reads, then saves, retags and offers to redo suggested to-dos.
In the code: hooks/useWorkspace.ts, lib/cases/nudges.ts, lib/mjengo/task-suggestions.ts, app/actions/mjengo-entity-tasks.ts, scripts/e2e/audit-contrast.mjs.
