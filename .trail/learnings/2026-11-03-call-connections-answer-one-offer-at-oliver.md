---
title: "Call connections answer one offer at a time, and background choices are kept on the device"
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 15, tokens: 147705 }
id: l-c118a15c
scope: repo
status: active
src: agent
touches:
  - components/meet/BackgroundPicker.tsx
  - components/meet/MeetRoom.tsx
  - components/meet/meet-parts.tsx
  - lib/client/meet-background.ts
  - scripts/e2e/uat/40-meet-suite.mjs
---

## Decided
Offers from the same person are answered in a queue, and a repeated answer is ignored once the connection is settled. Background choices (mode, blur amount, colours) and uploaded photos are kept in the browser on that device, with photos shrunk to 1280x720 JPEG.

## Tried and ruled out
Keeping photos on the account: skipped for now, so choices do not follow a person to another device.

## Watch out
Two offers arriving together made the browser throw "Called in wrong state: stable" and could leave a connection refused. The old check 28-meet-minimise fails on the sidebar-link step with or without these changes.

In the code:
- components/meet/MeetRoom.tsx: offerQueue in onSignal, signalingState guard on answers
- lib/client/meet-background.ts: localStorage key ss_meet_bg_v2
- scripts/e2e/uat/40-meet-suite.mjs
