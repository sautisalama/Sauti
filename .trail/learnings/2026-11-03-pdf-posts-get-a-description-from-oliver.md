---
title: PDF posts get a description from the first real paragraph and a landscape share card made from page one
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 11, tokens: 45531 }
id: l-b0c14b7a
scope: repo
status: active
src: agent
touches:
  - public/icons/survivor-dark.png
  - public/icons/survivor-light.png
  - public/logo-small.png
---

## Decided
For a PDF post, the description is the first prose paragraph after the cover and contents pages, trimmed to about 160 characters on a sentence boundary. A hand-written summary is never replaced; an empty or machine-made one is replaced on first view and kept. Link previews use a 1200x630 card (page one on the brand gradient, no text) because scrapers crop a portrait page; a post's own cover wins when it has one.

## Tried and ruled out
Taking the first paragraph of page 2: it picked up "how to read" and glossary notes in real manuals, so front-matter pages and meta phrases are skipped and the page that opens the document (introduction, summary) is preferred. Drawing the title on the card: servers may have no fonts, so the title travels in the page metadata only.

## Watch out
Two-column papers merge columns on one line and give odd sentences. The card needs @napi-rs/canvas, which is also listed in serverExternalPackages. The pdfjs document type has no destroy, which caused the two type-check failures.

In the code: lib/content/pdf-preview.ts, app/api/publications/[slug]/social and /cover, app/publications/[slug]/page.tsx (metadata and persisted summary).
