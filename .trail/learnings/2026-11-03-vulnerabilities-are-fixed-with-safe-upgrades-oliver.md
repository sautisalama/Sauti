---
title: "Vulnerabilities are fixed with safe upgrades and pinned overrides, never npm audit fix --force"
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 37, tokens: 25145 }
id: l-1c584657
scope: repo
status: active
src: agent
touches:
  - package-lock.json
  - package.json
---

## Decided
Plain npm audit fix for critical and high ones, nodemailer 10 and mailtrap 6 for the mail packages, and overrides to pin patched versions of packages whose parents have not updated (lodash-es, nanoid under excalidraw, image-size under pptxgenjs, serialize-javascript).

## Tried and ruled out
npm audit fix --force: its suggestions are downgrades and major jumps (excalidraw back to 0.17, pptxgenjs 4.0.0). The xlsx package has no npm fix; the only fix is SheetJS's own download, not added without the user's say.

## Watch out
Stop your own dev server by its process id before building or swapping node_modules, never all node processes. Two checks fail with or without the upgrades: the smoke test's calendar reminders and the deck studio's Saved to Files step.

In the code:
- package.json overrides block
- npm audit --json to recount
