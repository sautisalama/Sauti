---
title: "Dark theme overrides button text classes, use an inline colour"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 12, tokens: 24050 }
id: l-891a8b45
scope: repo
status: active
src: agent
touches:
  - app/dashboard/calendar/page.tsx
  - scripts/e2e/my-calendar.mjs
  - scripts/e2e/audit-contrast.mjs
  - app/dashboard/_components/CalendarConnectionStatus.tsx
---

## Decided
A button that needs its own text colour on a coloured background sets it with an inline style, because the dark theme layer overrides text colour classes, including arbitrary hex ones, and left pale text on the orange button at 2:1 contrast.

## Tried and ruled out
An arbitrary text colour class on the button: the audit still measured the pale colour, otherwise it would have passed.

## Watch out
Git Bash rewrites a leading-slash value in an env var, so the contrast audit filter is given without the slash (ONLY=dashboard/calendar); with it, the filter silently matched nothing.

In the code: app/dashboard/calendar/page.tsx, scripts/e2e/audit-contrast.mjs.
