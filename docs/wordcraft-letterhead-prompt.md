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
