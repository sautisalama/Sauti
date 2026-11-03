---
title: Meeting ends only when the last person goes or the host ends it; only one side offers when two people connect
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 81, tokens: 183388 }
id: l-836584e3
scope: repo
status: active
src: agent
touches:
  - components/meet/BackgroundPicker.tsx
  - components/meet/MeetRoom.tsx
  - components/meet/meet-parts.tsx
  - lib/client/meet-background.ts
  - scripts/e2e/uat/40-meet-suite.mjs
  - app/actions/meet-room.ts
---

## Decided
Leaving a call marks the meeting ended only if nobody else is left or the host chose End for everyone. Before, any signed-in person leaving ended it, so a call that went on dropped off the list of meetings you started that are on. The Meet home can end a call for everyone: the server marks it over and sends the end order on the call's own channel as "server", with the host proof checked by the server. When two people connect, only the one with the larger id makes the offer; the other waits and offers itself after 6 seconds if none came. A second device on the same account joins as the companion by itself (the later joiner). Background choices and photos are kept on the account (table meet_background_prefs, dev and prod) and on the device.

## Tried and ruled out
Ignoring repeated answers only: it hid the console error but both sides still made offers, so connections could be left half set up.

## Watch out
The test run must leave a call (and pick "Leave, the call goes on" as host) before leaving the page, or the suite keeps the call open over /meet. Dark mode needed its own hover rule for light hex hover colours.

In the code:
- components/meet/MeetRoom.tsx: connect(), onSignal offerQueue, endAllRef, becomeCompanion
- app/actions/meet-room.ts: endMeetingForAll
- app/actions/meet-background.ts, supabase/migrations/20261105_meet_background_prefs.sql
- scripts/e2e/uat/40-meet-suite.mjs (40 checks)
