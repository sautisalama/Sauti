import { humanizeOption, toOptionValue } from '@/lib/other-option';

/** Shared by the builder, the public form page and the server-side validation. No server-only imports. */

export type QuestionType = 'short' | 'paragraph' | 'choice' | 'checkbox' | 'dropdown' | 'scale' | 'date' | 'email' | 'number';

export type Device = 'desktop' | 'mobile';
/** Where the picture or video sits next to the question. Phones only use stack and wallpaper. */
export type ViewLayout = 'stack' | 'split-left' | 'split-right' | 'wallpaper';
export interface Media { kind: 'image' | 'video'; url: string; alt?: string }
export interface QuestionView { layout?: ViewLayout; /** undefined = same as the shared media, null = none on this device */ media?: Media | null }

export type ThemeFont = 'sans' | 'serif' | 'rounded' | 'mono';
export interface FormTheme {
  font?: ThemeFont;
  radius?: 'none' | 'md' | 'full';
  questionColor?: string;
  answerColor?: string;
  buttonColor?: string;
  buttonText?: string;
  background?: { kind: 'color' | 'image'; value: string; /** 0 to 70, how much the picture is darkened */ overlay?: number };
  logo?: { url: string; size?: 'sm' | 'md' | 'lg'; align?: 'left' | 'center' | 'right'; alt?: string };
}
export interface Welcome {
  enabled?: boolean;
  title?: string;
  description?: string;
  button?: string;
  media?: Media | null;
  view?: { desktop?: QuestionView; mobile?: QuestionView };
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  required: boolean;
  /** choice, checkbox, dropdown */
  options?: string[];
  /** Adds an "Other" choice that asks the person to type what it is. */
  allowOther?: boolean;
  /** scale */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  /** A picture or video shown with the question (shared by both views unless a view overrides it). */
  media?: Media | null;
  /** Layout and media per device, so the phone and the desktop can each look right. */
  view?: { desktop?: QuestionView; mobile?: QuestionView };
}

export interface FormSettings {
  confirmation?: string;
  collectEmail?: boolean;
  /** ISO date-time after which the form stops accepting responses. */
  closeAt?: string | null;
  /** Stop after this many responses. */
  limit?: number | null;
  /** Everything on one page, or one question at a time like Typeform. Respondents can switch. */
  layout?: 'page' | 'single';
  /** Signed-in people are identified by their account; set to false to hide the anonymous option. */
  allowAnonymous?: boolean;
  /** Pictures shown with the description (public image links). The first is the card preview. */
  images?: string[];
  /** Studio image linked to the form as its poster. */
  poster?: string | null;
  style?: { accent?: string; background?: string; designSystem?: string | null };
  theme?: FormTheme;
  welcome?: Welcome;
}

export type Answer = string | string[] | number | null;
export type Answers = Record<string, Answer>;

export const TYPE_LABEL: Record<QuestionType, string> = {
  short: 'Short answer',
  paragraph: 'Paragraph',
  choice: 'Multiple choice',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  scale: 'Linear scale',
  date: 'Date',
  email: 'Email',
  number: 'Number',
};

export const hasOptions = (t: QuestionType) => t === 'choice' || t === 'checkbox' || t === 'dropdown';
export const OTHER_LABEL = 'Other';

const uid = () => Math.random().toString(36).slice(2, 10);

export function newQuestion(type: QuestionType): Question {
  return {
    id: uid(),
    type,
    label: '',
    required: false,
    ...(hasOptions(type) ? { options: ['Option 1', 'Option 2'] } : {}),
    ...(type === 'scale' ? { scale: { min: 1, max: 5, minLabel: '', maxLabel: '' } } : {}),
  };
}

/** How an answer is shown: custom "Other" tokens become readable text. */
export function displayAnswer(q: Question, value: Answer | undefined): string {
  if (value == null || value === '') return '';
  const show = (v: string) => (q.options?.includes(v) ? v : hasOptions(q.type) ? humanizeOption(v) : v);
  return Array.isArray(value) ? value.map(show).join(', ') : typeof value === 'number' ? String(value) : show(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check a submission against the form's own questions. Returns cleaned answers (only known questions,
 * correct types, "Other" text normalised to the same lowercase_token format used elsewhere) or the errors.
 */
export function validateAnswers(questions: Question[], raw: Record<string, unknown>): { ok: true; clean: Answers } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const clean: Answers = {};

  for (const q of questions) {
    const v = raw[q.id];
    const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) errors[q.id] = 'This question is required.';
      continue;
    }

    // A pick from the list, or typed text for "Other" (kept as a token like the listed values).
    const pick = (x: unknown): string | null => {
      if (typeof x !== 'string') return null;
      if (q.options?.includes(x) && x !== OTHER_LABEL) return x;
      if (q.allowOther) {
        const t = toOptionValue(x);
        if (t && t !== 'other') return t;
      }
      return null;
    };

    switch (q.type) {
      case 'short':
      case 'paragraph': {
        const s = String(v).trim();
        if (s.length > (q.type === 'short' ? 500 : 5000)) errors[q.id] = 'That is too long.';
        else if (s) clean[q.id] = s;
        else if (q.required) errors[q.id] = 'This question is required.';
        break;
      }
      case 'email':
        if (typeof v === 'string' && EMAIL.test(v.trim()) && v.length <= 200) clean[q.id] = v.trim();
        else errors[q.id] = 'Enter a valid email address.';
        break;
      case 'number': {
        const n = Number(v);
        if (Number.isFinite(n) && Math.abs(n) < 1e12) clean[q.id] = n;
        else errors[q.id] = 'Enter a number.';
        break;
      }
      case 'date':
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) clean[q.id] = v;
        else errors[q.id] = 'Choose a date.';
        break;
      case 'scale': {
        const n = Number(v);
        const { min = 1, max = 5 } = q.scale ?? {};
        if (Number.isInteger(n) && n >= min && n <= max) clean[q.id] = n;
        else errors[q.id] = `Choose a number from ${min} to ${max}.`;
        break;
      }
      case 'choice':
      case 'dropdown': {
        const p = pick(v);
        if (p) clean[q.id] = p;
        else errors[q.id] = 'Choose one of the options.';
        break;
      }
      case 'checkbox': {
        const arr = Array.isArray(v) ? v.slice(0, 50) : [v];
        const picked = arr.map(pick);
        if (picked.some((x) => x == null)) errors[q.id] = 'One of the choices is not valid.';
        else clean[q.id] = Array.from(new Set(picked as string[]));
        break;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, clean };
}

/** Make sure a form definition coming from the builder is well-formed before it is saved. */
export function sanitiseQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.slice(0, 100).flatMap((raw): Question[] => {
    const q = raw as Partial<Question>;
    if (!q || typeof q !== 'object' || !q.type || !(q.type in TYPE_LABEL)) return [];
    let id = typeof q.id === 'string' && /^[a-z0-9]{4,16}$/.test(q.id) ? q.id : uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    const options = hasOptions(q.type)
      ? Array.from(new Set((q.options ?? []).map((o) => String(o).trim().slice(0, 120)).filter((o) => o && o !== OTHER_LABEL))).slice(0, 60)
      : undefined;
    const scale = q.type === 'scale'
      ? { min: Math.min(Math.max(Math.round(q.scale?.min ?? 1), 0), 1), max: Math.min(Math.max(Math.round(q.scale?.max ?? 5), 2), 10), minLabel: (q.scale?.minLabel ?? '').slice(0, 40), maxLabel: (q.scale?.maxLabel ?? '').slice(0, 40) }
      : undefined;
    return [{ id, type: q.type, label: String(q.label ?? '').slice(0, 300), help: q.help ? String(q.help).slice(0, 500) : undefined, required: !!q.required, options, allowOther: hasOptions(q.type) ? !!q.allowOther : undefined, scale, media: sanitiseMedia(q.media) ?? undefined, view: sanitiseViews(q.view) }];
  });
}


/* ------------------------------------------------------------ Look and media */

const HEX = /^#[0-9a-fA-F]{6}$/;
const LAYOUTS: ViewLayout[] = ['stack', 'split-left', 'split-right', 'wallpaper'];

export function sanitiseMedia(m: unknown): Media | null {
  const x = m as Partial<Media> | null;
  if (!x || typeof x !== 'object') return null;
  if ((x.kind !== 'image' && x.kind !== 'video') || typeof x.url !== 'string') return null;
  const url = x.url.trim().slice(0, 700);
  if (!/^https:\/\//.test(url)) return null;
  return { kind: x.kind, url, ...(x.alt ? { alt: String(x.alt).slice(0, 140) } : {}) };
}

function sanitiseView(v: unknown): QuestionView | undefined {
  const x = v as QuestionView | null | undefined;
  if (!x || typeof x !== 'object') return undefined;
  const out: QuestionView = {};
  if (x.layout && LAYOUTS.includes(x.layout)) out.layout = x.layout;
  if (x.media === null) out.media = null;
  else if (x.media) { const m = sanitiseMedia(x.media); if (m) out.media = m; }
  return Object.keys(out).length ? out : undefined;
}

export function sanitiseViews(v: unknown): { desktop?: QuestionView; mobile?: QuestionView } | undefined {
  const x = v as { desktop?: unknown; mobile?: unknown } | null | undefined;
  if (!x || typeof x !== 'object') return undefined;
  const desktop = sanitiseView(x.desktop);
  const mobile = sanitiseView(x.mobile);
  return desktop || mobile ? { ...(desktop ? { desktop } : {}), ...(mobile ? { mobile } : {}) } : undefined;
}

export function sanitiseTheme(t: unknown): FormTheme | undefined {
  const x = t as FormTheme | null | undefined;
  if (!x || typeof x !== 'object') return undefined;
  const hex = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : undefined);
  const out: FormTheme = {};
  if (x.font && ['sans', 'serif', 'rounded', 'mono'].includes(x.font)) out.font = x.font;
  if (x.radius && ['none', 'md', 'full'].includes(x.radius)) out.radius = x.radius;
  for (const k of ['questionColor', 'answerColor', 'buttonColor', 'buttonText'] as const) { const c = hex(x[k]); if (c) out[k] = c; }
  if (x.background && typeof x.background === 'object') {
    const b = x.background;
    if (b.kind === 'color' && hex(b.value)) out.background = { kind: 'color', value: b.value };
    else if (b.kind === 'image' && typeof b.value === 'string' && /^https:\/\//.test(b.value)) out.background = { kind: 'image', value: b.value.slice(0, 700), overlay: Math.min(70, Math.max(0, Math.round(Number(b.overlay) || 0))) };
  }
  if (x.logo && typeof x.logo === 'object' && typeof x.logo.url === 'string' && /^https:\/\//.test(x.logo.url)) {
    out.logo = {
      url: x.logo.url.slice(0, 700),
      size: x.logo.size && ['sm', 'md', 'lg'].includes(x.logo.size) ? x.logo.size : 'md',
      align: x.logo.align && ['left', 'center', 'right'].includes(x.logo.align) ? x.logo.align : 'left',
      ...(x.logo.alt ? { alt: String(x.logo.alt).slice(0, 125) } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

export function sanitiseWelcome(w: unknown): Welcome | undefined {
  const x = w as Welcome | null | undefined;
  if (!x || typeof x !== 'object') return undefined;
  return {
    enabled: !!x.enabled,
    title: x.title ? String(x.title).slice(0, 200) : undefined,
    description: x.description ? String(x.description).slice(0, 1000) : undefined,
    button: x.button ? String(x.button).slice(0, 24) : undefined,
    media: sanitiseMedia(x.media),
    view: sanitiseViews(x.view),
  };
}

type WithView = { media?: Media | null; view?: { desktop?: QuestionView; mobile?: QuestionView } };

/** The media a view shows: its own if it has one (or none), otherwise the shared one. */
export function mediaFor(item: WithView, device: Device): Media | null {
  const own = item.view?.[device]?.media;
  return own === undefined ? item.media ?? null : own;
}

export function layoutFor(item: WithView, device: Device): ViewLayout {
  const l = item.view?.[device]?.layout;
  if (!mediaFor(item, device)) return 'stack';
  if (l) return device === 'mobile' && (l === 'split-left' || l === 'split-right') ? 'stack' : l;
  return device === 'desktop' ? 'split-right' : 'stack';
}

/** YouTube and Vimeo links become embeds; anything else with a video file is played directly. */
export function videoEmbed(url: string): { kind: 'iframe' | 'file'; src: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0` };
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop();
      if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }
  } catch { /* fall through */ }
  return { kind: 'file', src: url };
}
