/**
 * Reading a conversation. Two ideas from the mail clients that get this right (Gmail, Superhuman, Hey):
 * show each message once, and fold away the text that only repeats an earlier message. This turns the
 * quoted history inside a message into a single "Show quoted text" fold, so a long thread reads as a
 * sequence of new things people said, not the same paragraphs over and over.
 */

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const QUOTE_SELECTORS = [
  '.gmail_quote',
  '.gmail_extra',
  '.yahoo_quoted',
  '.moz-cite-prefix',
  'blockquote[type="cite"]',
  '#divRplyFwdMsg',
  '#appendonsend',
  '.OutlookMessageHeader',
];

const WROTE = /^\s*(on|el|le|am)\s.{5,160}(wrote|escribió|a écrit|schrieb)\s*:?\s*$/i;

/** Returns the message with its quoted history folded, and whether anything was folded. */
export function trimQuoted(html: string): { html: string; trimmed: boolean } {
  if (typeof window === 'undefined' || !html) return { html, trimmed: false };
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  let start: Element | null = null;
  for (const sel of QUOTE_SELECTORS) {
    const el = body.querySelector(sel);
    if (el) { start = el; break; }
  }
  if (!start) {
    // A plain blockquote that comes after some new text is almost always the quote.
    const bq = body.querySelector('blockquote');
    if (bq && (body.textContent ?? '').replace(/\s+/g, '').length > (bq.textContent ?? '').replace(/\s+/g, '').length) start = bq;
  }
  if (!start) {
    // Outlook style: a horizontal rule followed by "From: ... Sent: ...".
    const hr = Array.from(body.querySelectorAll('hr')).find((h) => /^from:/i.test((h.nextElementSibling?.textContent ?? '').trim()));
    if (hr) start = hr;
  }
  if (!start) return { html, trimmed: false };

  // Take the "On Tuesday, Amina wrote:" line with it.
  let first: Element = start;
  const prev = start.previousElementSibling;
  if (prev && WROTE.test((prev.textContent ?? '').trim())) first = prev;

  // Everything from `first` to the end of its parent goes inside the fold.
  const holder = first.parentElement ?? body;
  const details = doc.createElement('details');
  details.className = 'ss-quoted';
  const summary = doc.createElement('summary');
  summary.textContent = 'See more';
  details.appendChild(summary);
  const move: ChildNode[] = [];
  for (let n: ChildNode | null = first; n; n = n.nextSibling) move.push(n);
  holder.insertBefore(details, first);
  move.forEach((n) => details.appendChild(n));

  // Nothing new above the fold (a pure forward): leave the message as it was.
  const above = Array.from(body.childNodes).filter((n) => n !== details).map((n) => n.textContent ?? '').join('').replace(/\s+/g, '');
  if (!above && holder === body) return { html, trimmed: false };
  return { html: body.innerHTML, trimmed: true };
}

const CSS = `body{margin:0;font:15px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;word-wrap:break-word}
img{max-width:100%;height:auto}a{color:#068297}pre{white-space:pre-wrap}table{max-width:100%}
blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #A8C7FA;color:#6b7280}
blockquote blockquote{border-left-color:#9AD5B8}
blockquote blockquote blockquote{border-left-color:#F5C58A}
blockquote blockquote blockquote blockquote{border-left-color:#CDBDF0}
details.ss-quoted{margin-top:12px}
details.ss-quoted>summary{display:inline-flex;align-items:center;gap:6px;cursor:pointer;list-style:none;padding:2px 10px;border-radius:999px;background:#f1f1ef;color:#787774;font-size:12px;user-select:none}
details.ss-quoted>summary::-webkit-details-marker{display:none}
details.ss-quoted>summary:hover{background:#e8e8e5}
details.ss-quoted[open]>summary{margin-bottom:8px}`;

/** The full document a message is shown in, with quoted history folded. */
export function messageDoc(opts: { html: string | null; text: string }): { doc: string; trimmed: boolean } {
  const raw = opts.html ?? `<pre style="font:inherit">${esc(opts.text)}</pre>`;
  const { html, trimmed } = trimQuoted(raw);
  return { doc: `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${CSS}</style></head><body>${html}</body></html>`, trimmed };
}

/** Soft, low-saturation tints for the people in a conversation: enough to tell them apart, never loud. */
export const SOFT = [
  { bar: 'border-l-[#CDBDF0]', bg: 'bg-[#FBF9FF]', dot: 'bg-[#E5DBF8]', ink: 'text-[#5B3E99]' },
  { bar: 'border-l-[#F0D8AE]', bg: 'bg-[#FFFCF6]', dot: 'bg-[#F8E9CB]', ink: 'text-[#8A5A12]' },
  { bar: 'border-l-[#F0C4D6]', bg: 'bg-[#FFFAFC]', dot: 'bg-[#F9DCE8]', ink: 'text-[#A23B68]' },
  { bar: 'border-l-[#BFD3F3]', bg: 'bg-[#FAFCFF]', dot: 'bg-[#DDE8FA]', ink: 'text-[#2F5DA8]' },
  { bar: 'border-l-[#B5E0CD]', bg: 'bg-[#F8FDFA]', dot: 'bg-[#D6F0E4]', ink: 'text-[#2A7A5A]' },
] as const;
export const SOFT_MINE = { bar: 'border-l-[#A9D6DE]', bg: 'bg-[#F6FBFC]', dot: 'bg-[#D3EBEF]', ink: 'text-[#0B6272]' } as const;

export function softFor(address: string, mine: boolean) {
  if (mine) return SOFT_MINE;
  const n = [...address.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0);
  return SOFT[n % SOFT.length];
}
