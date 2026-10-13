# Where AI is used in the suite, and where it should not be

The suite makes model calls through one key (OpenRouter, `lib/mjengo/ai.ts` and the streaming routes). Every call
costs credit, so the rule is: **use a model only when no rule can do the job, and never twice for the same input.**

## What calls a model today

| Where | What it does | Trigger | Verdict |
| --- | --- | --- | --- |
| Mail, summary (`/api/mjengo/mail/ai`, `AiSummary`) | TL;DR, bullets, what is needed | Opens by itself on long messages | Keep, but only for human mail (see below) |
| Mail, suggested replies and draft | Reply options, tone tools | Person asks | Keep (explicit) |
| Mail, auto label (`autoLabel`, `previewAutoLabel`) | Matches messages to a label rule | Person asks | Keep, but rules first (below) |
| Calendar event icons (`eventIcons`) | One icon key per event title | Page load, per title | **Replace with keywords.** 16 icon classes are easy to match with a word list; the model is only needed for titles no keyword matches |
| Forms, generate and report | First draft, written report | Person asks | Keep |
| Content, caption and rewrite for a network | Post wording | Person asks | Keep |
| Design, Magic, translate, readability | Layout and text help | Person asks | Keep; readability and contrast are rules, not AI |
| Documents, AI bar (`/api/mjengo/ai/complete`) | Writing help | Person asks | Keep |
| Sheets, table and formula help | Fills cells, writes a formula | Person asks | Keep. The formula list and examples are static, no call |
| Meeting notes (`notesFor`) | Summary, decisions, actions | Automatic, ten quiet minutes after a call | Keep, but only for calls with at least 3 spoken lines (already) and skip calls under two minutes |
| Opportunity verification | Reads a page, scores trust | Link pasted, shared from phone, or from an email | Run the cheap checks first (domain, known sources, dates); call the model only when they are inconclusive |
| Palette from a description | Hex codes from words | Person asks | Keep; from a picture is local (no call) |

## Rules that should run before any call

1. **Do not summarise what is already short.** `AiSummary` already skips messages under 700 characters with no
   thread. Also skip **automated mail** (no-reply senders, newsletters, receipts, anything with an unsubscribe
   footer): nobody needs a model to say "a receipt arrived". These now show the manual Summarise button only.
2. **Hash and cache.** A summary, notes or classification is a function of its input. Keep the result against a
   hash of the text so reopening, re-labelling or a second person opening the same message costs nothing. The mail
   screen caches in memory per session; a table keyed by `(owner, sha256(text), task)` would make it permanent.
3. **Rules before models for labels.** An auto-label rule that names a sender, a domain or a phrase should be run as
   a plain match over the message list. Only an instruction written in free language (for example "funding
   calls from donors") needs the model, and then only over messages that no explicit rule already settled.
4. **Batch.** Classifying 40 titles or 40 subjects is one call with a list, not 40 calls. Calendar icons and
   auto-label already batch; keep it that way.
5. **Small model for small jobs.** Classification, icons, tagging and titles go to the cheapest model
   (`OPENROUTER_MODEL`); long-form writing can use a larger one. Reasoning is switched off everywhere (it spent
   the budget and returned nothing).
6. **Never block a page on a model.** Anything that runs without a click (summary on open, icons, meeting notes)
   must be fire-and-forget with a rule-based fallback shown at once.
7. **Per-person budget.** The free allowance is counted per person on the assistant; the same counter should cover
   automatic calls so one busy mailbox cannot use the whole credit.

## Things that should happen without a click

* Meeting notes after a call (exists).
* A heads-up when a pasted or emailed link looks like a grant or opportunity, which is a rule (keywords such as
  grant, call for proposals, fellowship, tender, deadline) followed by the verification card only if the person says yes.
* Reminders and best posting times: pure rules, no model.

## What needs no model at all

Best times to post, holidays, reminders, formula lookup, palette from a picture, form templates, page sizes, access
checks, layer order, search. These are implemented as plain code.
