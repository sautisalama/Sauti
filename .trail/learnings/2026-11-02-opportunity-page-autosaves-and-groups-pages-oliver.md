---
title: Opportunity page autosaves and groups pages and copies on one tab
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 13, tokens: 92115 }
id: l-94bfc62e
scope: repo
status: active
src: agent
touches:
  - app/dashboard/calendar/page.tsx
  - scripts/e2e/seed-calendar.mjs
  - scripts/e2e/shot-calendar.mjs
  - scripts/e2e/audit-opp-layout.mjs
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
---

## Decided
The full opportunity page autosaves and has no Save button, because a long form with a bottom Save bar was easy to leave without saving. Related pages and copies of submissions sit on one tab, so what was sent can be found next to where it came from.

## Watch out
Every tab stays mounted and is only hidden, otherwise switching tabs would fetch to-dos, documents and timeline again. Autosave compares against the last saved values, otherwise opening a record would save it straight away.

In the code: app/dashboard/mjengo/_components/EntityWorkspace.tsx.
