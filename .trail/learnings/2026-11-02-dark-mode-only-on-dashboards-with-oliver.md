---
title: "Dark mode only on dashboards, with quiet borders, calm switches and menu highlights"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 1, tokens: 798 }
id: l-c1962091
scope: repo
status: active
replaces: l-e46b83a1
src: agent
touches:
  - components/theme/boot.ts
  - app/globals.css
  - scripts/e2e/audit-contrast.mjs
---

## Decided
Dark mode is for the signed-in app and meetings only. The public site always stays light, even for someone who chose dark. This reverses the earlier call to theme every page, after the user said dark is only for dashboards.
In dark, hairlines are kept barely above the surface colour so they structure without distracting (the meeting screens do the same). Inputs keep a stronger edge. Switches, menu highlights and loaders have their own dark rules; the design editor canvas stays white because it is paper.
## Watch out
Menu highlight colours come from many hard-coded light classes, so one rule on the highlighted state wins over them with important. Translucent tint classes (bg-x/NN) are not covered by the solid-colour rules and need their own entries.
In the code: components/theme/boot.ts, app/globals.css (Dark theme sections), scripts/e2e/audit-contrast.mjs.
