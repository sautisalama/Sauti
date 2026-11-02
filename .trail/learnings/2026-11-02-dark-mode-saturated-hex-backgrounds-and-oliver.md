---
title: "Dark mode: saturated hex backgrounds and divider shades need explicit rules"
author: Oliver
date: 2026-11-02
branch: main
cost: { minutes: 57, tokens: 204361 }
id: l-5709ceac
scope: repo
status: active
src: agent
touches:
  - app/actions/mjengo-attach.ts
  - app/actions/mjengo.ts
  - app/api/mjengo/mail/attachment/route.ts
  - app/api/suite/side/route.ts
  - app/api/version/route.ts
  - app/dashboard/error.tsx
  - app/dashboard/mjengo/_components/AddDocumentDialog.tsx
  - app/dashboard/mjengo/_components/DocumentsPanel.tsx
  - app/dashboard/mjengo/_components/EntityWorkspace.tsx
  - app/dashboard/mjengo/_components/FilePreviewDialog.tsx
---

## Decided
The dark layer recolours every bg-[#e..], bg-[#d..] and bg-[#f..] class to the surface colour, which also flattened saturated badges (orange, red). Saturated ones are listed in app/globals.css and kept as written; divider and light border shades (divide-*, border-*-50, border-black/..) get one quiet line colour. Presentation and PowerPoint-from-AI are one card; the AI form can save editable slides or a .pptx.

## Tried and ruled out
Fixing each page's divider class by hand: the same white line recurs on any page using divide-serene-neutral-NN.

## Watch out
New brand-coloured bg-[#e..]/[#f..] classes need adding to the keep list in globals.css, or use an inline style. audit-dark-suite.mjs finds white lines, light panels, weak text and bad hovers.

In the code: app/globals.css (end), scripts/e2e/audit-dark-suite.mjs, DeckStudio.tsx, FileRender.tsx (previews of docx, xlsx, pptx, deck, excalidraw, svg).
