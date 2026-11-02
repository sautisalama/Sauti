---
title: "Sidebar Calendar shows the personal calendar, settings live behind a gear"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 1, tokens: 1030 }
id: l-a375e133
scope: repo
status: active
src: agent
touches:
  - app/dashboard/calendar/page.tsx
  - app/actions/my-calendar.ts
  - components/navigation/EnhancedSidebar.tsx
---

## Decided
The sidebar Calendar opens a real personal calendar (month and week, chosen day listed), not the calendar settings, because people expect to see their sessions there and settings are a rare task. Settings stay at the profile calendar section, linked by a gear on the calendar page.

## Watch out
Providers see "Client session" only, never the survivor name, otherwise the calendar would leak identity; it reads only the signed-in person own rows.

In the code: app/dashboard/calendar/page.tsx, app/actions/my-calendar.ts, components/navigation/EnhancedSidebar.tsx.
