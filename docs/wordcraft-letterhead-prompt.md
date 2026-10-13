# Prompt for @gamine/wordcraft-react: plug-and-play organisation letterhead

You are changing `@gamine/wordcraft-react` (AI Studio: `dist/ai.js`, `dist/ai-studio.js`). The host app passes the
organisation's letterhead as `ai.letterhead` and expects the Letterhead page of AI Studio to show it, ready to apply
to the document, with no extra work. Today that is unreliable. Make it plug and play.

## What goes wrong (found by testing in a real browser against the host app)

1. `AiBar` reads `options.letterhead` once: in the `useState` initialiser and in the mount `useEffect` whose deps are
   `[allowUserKey]`. If the host's options arrive or change after the editor mounts (the host loads its brand from
   the server), the letterhead is never picked up. The Letterhead page then shows empty fields and "Apply to
   document" is disabled, because `lh.name` is empty.
2. `readStudio()` accepts any stored letterhead whose `name` is a string, including `""`. The Letterhead page
   creates one as soon as a person only toggles "Accent rule" or "Alignment" (`set()` spreads `{ name: '' ... }`
   and `writeStudio` saves it). From then on the saved empty letterhead overrides the host's `options.letterhead`
   in that browser for good.
3. There is no distinction between "the organisation's letterhead" (from the host) and "this person's own edits".
   Both live in one `studio.letterhead`, so the host's value can never update once anything is stored.
4. Palettes already work live (`paletteFor(studio, options.palettes)` is evaluated on every render). The letterhead
   should behave the same way.

## What to build

- Keep two things apart: `options.letterhead` (organisation default, reactive) and the person's saved override
  (stored as `letterheadOverride`, only when they changed something and it has a non-empty `name`).
- Effective letterhead = `override ?? options.letterhead ?? null`, computed on every render, so a late or changed
  `options.letterhead` shows up immediately (compare by value, not identity, so a new object with the same fields
  does not reset the form).
- `readStudio()` and `writeStudio()` must never save or honour a letterhead whose `name.trim()` is empty. Also
  migrate the old stored shape (`letterhead` key) the same way.
- Editing a field on the Letterhead page creates the override from the effective letterhead (not from an empty
  object), so toggling "Accent rule" on the organisation's letterhead keeps its name, tagline, address and logo.
- Add a "Reset to organisation letterhead" action on the page, shown only when an override exists and
  `options.letterhead` is set.
- Optional host switch `ai.letterheadLocked?: boolean`: when true the fields are read-only and only "Apply to
  document" / "Remove from document" are offered (organisations that want the official letterhead untouched).
- Optional `ai.onLetterheadApplied?(lh)` callback, so the host can log or save the document after applying.
- `studioInstructions(skills, letterhead)` and the status text under the bar must use the effective letterhead.
- `applyLetterhead` must also work when the document has no header yet and when it already has one (replace, do not
  stack). Add tests: apply twice leaves one letterhead; remove clears it; the saved .docx contains the name in
  `word/header*.xml`.

## Acceptance (the host's e2e should pass reliably, 10 runs in a row)

1. Fresh browser, `ai.letterhead = { name: "Sauti Salama", ... }` set after mount: AI Studio > Letterhead shows
   "Sauti Salama" in the name field and "Apply to document" is enabled.
2. Open the page, toggle "Accent rule", reload: the name is still "Sauti Salama".
3. Change `ai.letterhead` in the host (new name): the page shows the new name unless the person has an override.
4. Apply, save, reopen the .docx: header carries the organisation name.

Ship it as a minor version and describe the new options (`letterheadLocked`, `onLetterheadApplied`) in the README.

---

# Part 2: Google Docs style collaboration, access levels, document chat and writing checks

Same package, next minor or major. Everything below is host-pluggable: the host app supplies the server (stores,
endpoints, user identity); the package supplies the UI and the editor behaviour. Nothing should call a third-party
service by default. Priorities are P0 (first), P1, P2.

## 1. Comments in the Google Docs style (P0)

How Google Docs does it, and what to match:

- A comment is **anchored to a selected range**. The range gets a soft highlight; the comment is a **card in the
  right margin, vertically aligned with its anchor**, and cards push each other down when they would overlap.
  Clicking the highlight focuses its card, and clicking a card scrolls to its anchor.
- Entry points: the floating "Add comment" button beside a selection, the toolbar button, the context menu, and
  `Ctrl+Alt+M`.
- A card has the author avatar, name and time, the text, **replies in a thread**, `@mentions` (with a people
  picker), **Resolve / Reopen**, edit and delete (own comments), and an **Assign to** action item for a mention.
- Resolved threads leave the margin but stay in a **comment history** list. The all-comments panel filters by Open,
  Resolved, Mine, Mentions me, and by author.
- Comments on images, tables, headers and footnotes work like text comments.
- **Suggesting mode** next to Editing and Viewing: edits become tracked suggestions (insert, delete, format) with
  the author, accept and reject per suggestion, and "Accept all" for a person. Suggestions show inline in the
  author's colour and in the margin as cards like comments.
- Persistence is a host adapter, the same pattern as `versionHistory`:
  `comments: { store, onCreate?, onReply?, onResolve?, onMention? }`, where `store` has `list()`, `create()`,
  `reply()`, `update()`, `resolve()`, `remove()` and an optional `subscribe()` for live updates. `onMention` is how
  the host sends the notification email.
- **DOCX interop**: write and read `word/comments.xml`, `commentsExtended.xml` (resolved state, parent links) and
  `commentsIds.xml`, with range markers (`commentRangeStart/End`), so comments survive a round trip to Word and
  Google Docs. Tracked changes use `w:ins` / `w:del` with author and date.
- Live: comments and suggestions arrive through the collaboration channel, with their authors, without reloading.
- Accessibility: every card is keyboard reachable, with an `aria-live` region announcing new comments.

Acceptance: add a comment on a range, reply, mention someone (the host callback fires), resolve, reopen, export to
.docx, open in Word: the thread, author and resolved state are intact. Two people see the same thread live.

## 2. Access levels: view, comment, suggest, edit (P0)

- A `permission: "view" | "comment" | "suggest" | "edit"` prop (the host can change it at runtime). The editor
  enforces it, not only the host UI:
  - **view**: no caret edits, no formatting commands, no paste; selection and copy allowed (host can disable copy);
    comments hidden or read-only per `commentsVisibleToViewers`.
  - **comment**: view plus adding, replying to and resolving comments; no text changes.
  - **suggest**: edits are only possible as tracked suggestions (the mode switcher is locked to Suggesting).
  - **edit**: everything.
- The mode switcher ("Editing / Suggesting / Viewing", as in Google Docs) only lists modes the person's permission
  allows. The area beside Share shows the current level as a chip.
- Link access carries a level too (view, comment, edit), and the editor shows "You are viewing / commenting".
- Revoking or lowering a level while the document is open takes effect live: the editor drops to the new level and
  tells the person why.
- Every command that changes content (AI "Replace", find and replace, autocorrect, drag and drop, remote ops from
  that user) goes through the same check.

Acceptance: a viewer cannot type, paste, drag text or apply AI results; a commenter can comment but not edit; a
suggester's edits all appear as suggestions; lowering a level live takes effect within a second.

## 3. Live presence in the header (P0)

- Avatars of everyone currently in the document are shown at the top right, overlapping, with an overflow counter
  (`+3`) and a tooltip with name and "viewing / editing". Each person has a stable colour.
- In the text, each remote caret has a coloured flag with the name for a few seconds after they move, and their
  selections are tinted in their colour.
- Click an avatar to **jump to and follow** that person (their scroll and caret) until you scroll yourself.
- Dimmed after one minute idle, gone when the channel drops. Anonymous link viewers show as "Anonymous <animal>"
  with a generic avatar.
- API: `collaboration.user = { id, name, avatarUrl?, color? }`, plus `onPresenceChange(users)` so the host can show
  the same avatars in its own header.

Acceptance: open in two browsers; both avatars appear in each other's header within two seconds; following works.

## 4. Chat with the document (P1)

- A side panel, toggled from the header ("Ask this document", with the AI star), like Gemini in Docs. The editor
  area resizes; the panel remembers its open state per user.
- Questions are **grounded in the document**, the current selection, or a chosen scope (whole document, this
  section, selection). Answers cite the paragraphs they came from as numbered chips; clicking one scrolls to and
  highlights that paragraph.
- Quick actions: Summarise, Key points, Action items, Explain this, Find where it says…, Translate selection.
- Every answer has Insert at cursor, Replace selection, Copy, and Add as comment.
- Uses the host's `ai.complete` (same streaming contract as today), so there is no new key handling. Long documents
  are chunked by heading and only relevant chunks are sent; the full text is not sent for a narrow question.
- Chat history is per document and per user through a host adapter (`ai.chatStore`) and can be cleared.
- Respects permission: viewers and commenters can ask questions but cannot Insert or Replace.

## 5. Writing quality, Grammarly style (P1)

Research summary: Grammarly's Text Editor SDK (launched 2021, generally available 2022) embeds suggestions in four
groups (correctness, clarity, engagement, delivery/tone) plus tone detection and autocomplete; it is a hosted
service with a free tier and usage-based paid plans. Verify its current availability and terms before relying on
it (the sources found were from 2021 and 2022). LanguageTool is open source (core LGPL-2.1), self-hostable, with a
plain HTTP API (`POST /v2/check`) for 25+ languages; some premium rules need a commercial licence. So: build the UI
once and make the engine pluggable.

- **Engine adapter**: `ai.checker = { check(text, ctx) → Issue[] }` with
  `Issue = { start, end, category: "correctness" | "clarity" | "engagement" | "delivery", message, replacements[], ruleId, confidence }`.
  Ship two adapters: `languageTool({ url })` (rule based, fast, runs on the organisation's own server) and
  `llmChecker(complete)` (clarity, tone and rewrite suggestions through `ai.complete`). A `grammarlySdk` adapter is
  optional and clearly marked as a third-party service.
- **UI**: coloured underlines by category; a card on click with the explanation, one-click apply, Dismiss, "Ignore
  this rule", "Add to dictionary"; a side panel listing all issues grouped by category with a score and counts.
- **Goals**: audience (general, expert), formality, domain (business, academic, plain language for public
  information), intent (inform, persuade, report). Goals change which rules and LLM instructions apply.
- **Readability and tone**: Flesch reading ease and grade level, average sentence length, reading time, and a tone
  read-out ("confident, formal"). A plain-language mode matters for this organisation's public content.
- **Performance**: check by paragraph, debounced after the person pauses, cached by paragraph hash; never on every
  keystroke; nothing is sent in Viewing mode.
- **Privacy**: only the paragraph being checked is sent, to the host's endpoint; the host can switch the checker
  off per document (sensitive documents).

## 6. Originality: plagiarism and AI-writing signals (P2)

Research summary: commercial plagiarism and AI-detection APIs exist (Copyleaks, Originality.ai, GPTZero, Winston AI,
Quetext, PlagiarismSearch). Prices and limits vary and third-party write-ups conflict, so the package must not
hard-code a vendor. AI detectors are known to be unreliable and to produce false positives, especially for people
who are not native English speakers.

- **Adapters**:
  `ai.originality = { checkPlagiarism(text) → { score, matches[{ start, end, similarity, sourceTitle, url }] }, detectAi(text) → { score, spans[{ start, end, likelihood }] } }`.
  The host plugs in a vendor or its own service; with no adapter the features are hidden.
- **Private default**: similarity against the organisation's own documents (the host supplies
  `corpus.search(text)` returning near matches; the package only renders them). Useful for reused grant text and
  boilerplate, and nothing leaves the organisation.
- **UI**: a report panel with an overall similarity percentage and a list of matched passages; matches are
  highlighted in the text, each with its source and an "Add citation" or "Rewrite" action.
- **AI-writing signal**: shown as a soft per-paragraph signal ("may contain AI-generated text, low confidence"),
  never as a verdict, always with a short note that detectors can be wrong. It must never block saving, sharing or
  exporting, and is never written into the file.
- **Safeguards**: opt-in per organisation; a clear notice of what is sent and to whom; the host can mark documents
  as sensitive (case notes, survivor information) so these checks are disabled and nothing is transmitted.

## 7. Other niche features worth having (P2)

- Citations and bibliography (APA, MLA, Chicago, a simple "Sources" list) with link-to-source chips.
- Outline sidebar from headings with drag to reorder sections; document tabs, as in Google Docs.
- "Match document format" and a `/` slash menu that inserts AI blocks, tables and templates.
- Smart chips for people (`@name`), dates, files from the host's file picker, and links with previews.
- Voice typing, and translate the document into a new tab keeping formatting.
- Accessibility checker: missing alt text, heading order, low contrast, ambiguous link text.
- Named versions and "compare with current" using the existing version history store.
- Word count for a selection, characters, pages, and a word goal.

## 8. Cross-cutting requirements

- Every new feature is behind an option, off by default, and documented in the README with its adapter contract.
- All adapters are optional and failure-safe: a failing checker, store or endpoint never breaks typing or saving.
- Respect the host's theme tokens (the editor already takes `dark` and `prefs`); no hard-coded colours except
  per-user presence colours.
- TypeScript types for every adapter and event; an example host app and Playwright tests for the acceptance cases
  above (two-browser presence, comment round trip through .docx, permission enforcement, checker underline and
  apply, document chat citation click).
- Mobile: the comment margin collapses into a bottom sheet; presence avatars collapse to a count.

---

# Part 3: Theme from a logo or photo, and logo placement

## Today (what exists in the package)

- Letterhead page: "Add logo" (under 1.5 MB), alignment left / centre / right, an accent rule on or off.
- Palette page: built-in palettes plus one custom palette of four colours (primary, secondary, accent, muted),
  applied to the title and headings only.
- Missing: picking colours from a picture, applying a palette across the document, writing the palette into the
  .docx theme, and logo positions other than the header alignment.

## 1. Theme from a logo or photo (P0)

- A "From a logo or photo" action on the Palette page and on the Letterhead page. Sources: upload, drag and drop,
  paste, and a host picker `ai.pickImage(): Promise<Blob | string | null>` (so the host can offer its files).
  More than one picture can be chosen.
- Extraction runs in the browser: shrink to about 96 px on the long side, convert to Lab, skip transparent,
  near-white and near-black pixels, cluster (k-means or median cut), merge near duplicates, and rank by area and
  saturation. For a logo, flat colours win; for a photo, the most saturated large areas win. With several pictures,
  take colours round-robin so a small logo is not drowned by a busy photo.
- Show 5 to 8 swatches with their share. Roles are assigned automatically and can be changed by clicking a swatch
  for a role: primary (dark enough for text on white, contrast at least 4.5:1), secondary, accent (most
  saturated), muted (neutral). Warn when headings would not be readable on the page or on the band colour, and
  offer a one-click fix that darkens the colour until it passes.
- Light and Dark variants of the same palette.
- Save as a custom palette with its source ("from logo.png"), so it can be reused and shared. Host callbacks:
  `onPaletteCreated(palette)` so the host can store it for the whole organisation; `ai.palettes` already feeds
  saved ones back in.
- Apply to the whole document, not only headings: title, headings, table header fills and borders, hyperlinks,
  bullet colours, quote and callout bars, the letterhead rule, and shapes. Write it as the **document theme**
  (the colour scheme in `word/theme/theme1.xml` plus linked styles), not as inline overrides, so Word's
  Design > Colors shows it and changing the palette later recolours everything consistently.
- "Apply to headings only" stays as the light option.
- Optional fonts: `ai.fonts = { heading, body }` or a fonts step in the same panel, written to the theme font
  scheme.

## 2. Logo placement (P0)

Model: `logo = { src, placement, size, offset, opacity, wrap, pages }`.

Placements (presets with a live mini-page preview in the panel):

- **Header**: left, centre, right; logo with the organisation text beside it (logo left + text right, text left +
  logo right) or stacked (logo above text).
- **Footer**: left, centre, right.
- **Top of the first page only**, or on every page (`pages: "first" | "all" | "odd" | "even"`, using the
  different-first-page and odd/even header settings in Word).
- **Watermark**: centred behind the text; size, opacity (5 to 40 percent), rotation (0 or minus 45), optional
  repeat. Use a Word-compatible watermark (a VML `PowerPlusWaterMarkObject` in the header, or `wp:anchor` with
  `behindDoc="1"`) so Word, Google Docs and LibreOffice all show it.
- **Cover page**: large and centred, then a page break.
- **Side edge**: a vertical strip at the left or right margin.
- **Inline at the cursor** (as a normal image) and **signature block** (end of the document).
- **Partner logos row**: several logos side by side in the header or footer with even spacing.

Options: width in cm or px, keep aspect ratio, offset x and y, opacity, wrap (inline, behind text, in front of
text), and alignment of the letterhead text relative to the logo. Image handling: trim transparent margins,
convert SVG to PNG, optional "remove white background", and a size cap with a clear message.

## 3. API additions

- `ai.letterhead = { name, tagline, address, contact, logo: { src, placement, size, offset, opacity, wrap, pages }, align, rule, font }`
  (existing fields keep working; a plain `logo` string means `placement: "header-left"`).
- `ai.brand = { logo, palette }` as shorthand: one object, and both the letterhead and the palette are ready.
- Callbacks: `onLogoChanged`, `onPaletteCreated`, `onLetterheadApplied`.

## 4. Acceptance

1. Choose a logo: swatches appear, a palette is created, "Apply to document" recolours the title, headings,
   tables and links, and the .docx theme part carries the colours (Word's Design > Colors shows them).
2. Choose a photo and a logo together: both contribute colours; the logo's colours are present.
3. Placement presets render correctly in the preview and in the saved .docx opened in Word and Google Docs:
   header left, centre, right; footer; first page only; watermark behind text at the chosen opacity.
4. Replace the logo: the old one is removed, not stacked. Remove: header and watermark are cleared.
5. Low-contrast palette: a warning appears and the fix button makes headings pass 4.5:1.
