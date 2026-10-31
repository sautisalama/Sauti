---
title: "Dark mode is a scoped class layer, mail reads go through a route, availability is one shared store"
author: Oliver
date: 2026-10-31
branch: main
cost: { minutes: 46, tokens: 310508 }
id: l-3fdb62ea
scope: repo
status: active
src: agent
touches:
  - app/(auth)/signup/page.tsx
  - app/actions/admin-escalations.ts
  - app/dashboard/_components/CalendarConnectionStatus.tsx
  - app/dashboard/_views/OnboardingFlow.tsx
  - app/dashboard/_views/SurvivorView.tsx
  - app/dashboard/admin/_components/EscalatedCases.tsx
  - app/dashboard/admin/matching/_components/MatchingVisualizer.tsx
  - app/dashboard/admin/page.tsx
  - app/dashboard/layout.tsx
  - app/dashboard/matches/page.tsx
---

## Decided
Dark mode is a scoped html.dark layer (dashboard and meet only) that remaps the hex colour utilities, not a rewrite of every component. The choice lives in localStorage key ss_theme and an inline boot script in the head sets the class before first paint.
Mail bodies are read through a plain GET route (app/api/mail/read) because server actions run one at a time in the browser, which made opening mail wait behind prefetches. Cached bodies show instantly and refresh quietly after 5 minutes.
Availability ("Taking new cases") is one shared store so the overview card, account menu and calendar settings never disagree.
## Watch out
html.mjengo-theme sets light values for --secondary/--accent/--muted/--border/--input, so dark needs html.dark.mjengo-theme overrides. New translucent colour utilities (bg-x/NN) are not covered automatically; add them to the Dark theme section of globals.css.
In the code: components/theme/, components/dashboard/availability-store.ts, app/api/mail/read/route.ts, scripts/e2e/audit-dark.mjs.
