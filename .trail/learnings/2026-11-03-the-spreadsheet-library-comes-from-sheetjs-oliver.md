---
title: "The spreadsheet library comes from SheetJS's own download and the PowerPoint reader needs its own compound-file package"
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 15, tokens: 11812 }
id: l-f7fff86f
scope: repo
status: active
src: agent
touches:
  - package-lock.json
  - package.json
  - lib/mjengo/pptx-basic.ts
---

## Decided
The spreadsheet package is installed from SheetJS's official download link (0.20.3), because they no longer publish fixes to npm and the npm copy has open high-severity issues. The compound-file reader is now a direct dependency.

## Watch out
The new spreadsheet package no longer brings that reader with it, so the PowerPoint text reader failed to type-check with "Cannot find module cfb" until it was added directly. Updating the spreadsheet package is manual: change the version in the link. Its package.json cannot be required directly (exports blocked), so read the version from the file.

In the code:
- package.json: xlsx link, cfb
- lib/mjengo/pptx-basic.ts imports cfb
