# Where AI is used in the suite, and where it should not be

The suite makes language-model calls through one key (OpenRouter, `lib/mjengo/ai.ts` and the streaming routes).
Every call costs credit, so the rule is: **use a model only when no rule can do the job, and never twice for the
same input.** A second kind of model, a typed decision model (Jev, see below), covers "which of these is it".

## The two models you asked about (researched 13 Oct 2026)

| | **Jev** (TypeSafe AI, "System One") | **Laya** (ConvAI Innovations) |
| --- | --- | --- |
| What it is | A hosted decision model. You send text and a typed question; it returns one of your answers with probabilities. It does not write prose. | An open-weight decision model of the same kind (ModernBERT-large, about 421M parameters; a multilingual 322M variant exists). Apache 2.0. |
| How to run it | HTTP API `POST https://api.typesafe.ai/v1/systemone` with `TYPESAFE_API_KEY`; also via Vercel AI Gateway (`typesafe-ai/jev`), Pydantic AI, LiteLLM, TanStack AI. Models `jev-latest`, `jev-1.13.0`. | Download from Hugging Face and run it yourself (CPU or GPU, about 33 ms per decision on a T4 according to its authors). Needs a Python or ONNX runtime; nothing runs inside Vercel serverless without extra work. |
| Question types | `choice` (up to 255 options), `score` (rubric up to 10 levels), yes/no. | Same idea: choice, score, yes/no. |
| Good at | Triage, routing, yes/no judgments, picking a tool or label, rating on a rubric. | The same, plus very short latency and no per-call fee if self-hosted; multilingual (useful for Kiswahili). |
| Weak at | Negations and implied conditions, arithmetic, counting, dates, multi-hop reasoning, irrelevant context, text generation. State + question must fit 32k tokens. | Zero-shot accuracy is modest on hard tasks (its authors report the high scores need fine-tuning); reports of confident wrong answers on unsupported scripts. Verify on your own data first. |
| Fit here | Easy to adopt: a plain `fetch`. Implemented in `lib/mjengo/decide.ts`. | Worth trying if volume grows or data must stay on our servers. Not set up: it needs hosting. |

### What was wired in

`lib/mjengo/decide.ts` calls Jev when `TYPESAFE_API_KEY` is set and returns `null` otherwise, so everything
falls back to word rules and then to the language model.

* **Mail triage** (`mailTriage`): personal, automated or opportunity. Automated mail is not summarised by itself;
  an opportunity shows "Add to Opportunities" under the subject.
* **Calendar icons**: 16 fixed categories; Jev first, then the language model only for what is left.

Not wired, but good fits: auto-label rules that are phrased as a category, choosing which suite section a pasted
link belongs to, and "should this need a human reply" flags. Jev should not be used for the AI summaries,
drafts, form generation or captions, which are writing tasks.

## What calls a language model today

| Where | What it does | Trigger | Verdict |
| --- | --- | --- | --- |
| Mail, summary | TL;DR, bullets, what is needed | Opens by itself on long human mail | Keep; skipped for automated mail |
| Mail, suggested replies and draft | Reply options, tone tools; now reads the whole thread and copies the writer's style | Person asks | Keep (explicit) |
| Mail, auto label | Matches messages to a label rule | Person asks | Keep, rules first |
| Calendar icons | Icon key per title | Page load | Words, then Jev, then the model |
| Forms, generate and report | First draft, written report | Person asks | Keep |
| Content, caption and rewrite for a network | Post wording | Person asks | Keep |
| Design, Magic, translate | Text and layout help | Person asks | Keep; readability and contrast are rules |
| Documents, AI bar | Writing help | Person asks | Keep |
| Sheets, table and formula help | Fills cells, writes a formula | Person asks | Keep; the function list needs no call |
| Meeting notes | Summary, decisions, actions | Automatic after ten quiet minutes | Keep, only for calls with 3 or more spoken lines |
| Opportunity verification | Reads a page, scores trust | Link pasted or shared | Cheap checks first; model only if inconclusive |
| Palette from a description | Hex codes from words | Person asks | Keep; from a picture is local |

## Rules that should run before any call

1. Do not summarise what is already short or automated.
2. Hash and cache: a summary or classification is a function of its input. Key a table by
   `(owner, sha256(text), task)` so reopening or a second reader costs nothing.
3. Rules before models for labels; the model only for free-language instructions.
4. Batch: one call with a list, not one per item.
5. Smallest model that works (`OPENROUTER_MODEL`); reasoning switched off.
6. Never block a page on a model; show the rule-based answer at once.
7. One per-person budget that covers automatic calls too.

## What needs no model at all

Best times to post, holidays, reminders, formula lookup, palette from a picture, form templates, page sizes,
access checks, layer order, search.
