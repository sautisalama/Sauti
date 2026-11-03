---
title: "A PDF post is shown as the PDF itself, drawn page by page, and its text is never extracted unless asked"
author: Oliver
date: 2026-11-03
branch: main
cost: { minutes: 11, tokens: 81807 }
id: l-78e2efa9
scope: repo
status: active
src: agent
touches:
  - components/publishing/ArticleView.tsx
  - app/actions/publishing.ts
---

## Decided
"Show the PDF itself" skips text extraction on upload. Readers get the pages drawn inline at article width in the site theme, like a blog, not a small embedded viewer. Text is pulled out only if the author switches to "Show the text instead".

## Tried and ruled out
The browser's built-in PDF embed in a fixed-height box: it ignores the site theme and looks like a container around a file.

## Watch out
The PDF is fetched straight from public storage by the browser, so the bucket must allow cross-origin reads. Old PDF posts keep their previously extracted body; it is just unused in PDF mode. pdfjs: destroy the loading task, not the document (the document type has no destroy).

In the code: components/publishing/PdfReader.tsx, components/publishing/ArticleView.tsx, attachPdfFromStorage and extractPdfText in app/actions/publishing.ts.
