'use server';

import { sendAccessEmail } from '@/lib/mjengo/invite-email';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import { getCalendarTokens, saveCalendarTokens } from '@/lib/calendar/tokens';
import { createOAuth2ClientFromTokens, isGoogleCalendarConfigured } from '@/lib/google-calendar-oauth';

export type CalKind = 'event' | 'meeting' | 'block' | 'google' | 'grant' | 'opportunity' | 'project' | 'todo' | 'post';

export interface CalItem {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  kind: CalKind;
  href?: string;
  meetingCode?: string | null;
  location?: string | null;
  description?: string | null;
  attendees?: string[];
  removable?: boolean;
}

export interface CalMonth { items: CalItem[]; googleConnected: boolean; googleConfigured: boolean; googleError: string | null }

export interface NewEvent {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  description?: string | null;
  location?: string | null;
  attendees?: string[];
  videoCall?: boolean;
  /** Time kept free of meetings: shown as busy, and nobody is invited. */
  block?: boolean;
  /** How many alerts to send before it starts (0 to 10), and how many minutes apart. The last one lands one step before the start. */
  alerts?: number;
  alertEvery?: number;
  /** Minutes before the start, one entry per reminder (like Google Calendar). Overrides alerts and alertEvery. */
  reminders?: number[];
  /** Put an existing meeting on the calendar instead of making a new link. */
  meetingCode?: string;
}

/** An authorised Google Calendar client for this person, refreshing the token when needed. */
async function googleClient(userId: string) {
  if (!isGoogleCalendarConfigured()) return null;
  const stored = await getCalendarTokens(userId);
  if (!stored?.access_token) return null;
  const tokens = { access_token: stored.access_token, refresh_token: stored.refresh_token ?? undefined, expiry_date: stored.expiry_date ?? undefined };
  const auth = createOAuth2ClientFromTokens(tokens);
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + 30_000 && tokens.refresh_token) {
    const { credentials } = await auth.refreshAccessToken();
    await saveCalendarTokens(userId, { access_token: credentials.access_token ?? tokens.access_token, refresh_token: credentials.refresh_token ?? tokens.refresh_token, expiry_date: credentials.expiry_date ?? null });
    auth.setCredentials(credentials);
  }
  return google.calendar({ version: 'v3', auth });
}

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
function meetCode() {
  const b = randomBytes(10);
  const pick = (n: number) => Array.from({ length: n }, (_, i) => alphabet[b[i] % alphabet.length]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

/** Everything on the calendar between two instants: events, Google events, deadlines, due tasks and posts. */
async function month_(fromIso: string, toIso: string): Promise<CalMonth> {
  const a = await requireModule('calendar');
  const db = looseAdmin();
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  const items: CalItem[] = [];

  const [{ data: events }, { data: grants }, { data: opps }, { data: projects }, { data: todos }, { data: posts }] = await Promise.all([
    db.from('mjengo_events').select('id, title, description, location, starts_at, ends_at, all_day, kind, meeting_code, attendees').gte('ends_at', fromIso).lte('starts_at', toIso),
    db.from('mjengo_grants').select('id, title, deadline').gte('deadline', from).lte('deadline', to),
    db.from('mjengo_opportunities').select('id, title, deadline').gte('deadline', from).lte('deadline', to),
    db.from('mjengo_projects').select('id, name, end_date').gte('end_date', from).lte('end_date', to),
    db.from('mjengo_todos').select('id, title, due_date, status').gte('due_date', from).lte('due_date', to).neq('status', 'done'),
    db.from('mjengo_posts').select('id, title, body, scheduled_for, status').gte('scheduled_for', fromIso).lte('scheduled_for', toIso).neq('status', 'cancelled'),
  ]);

  for (const e of (events ?? []) as { id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string; all_day: boolean; kind: 'event' | 'meeting' | 'block'; meeting_code: string | null; attendees: string[] }[]) {
    items.push({ id: `ev:${e.id}`, title: e.title, start: e.starts_at, end: e.ends_at, allDay: e.all_day, kind: e.kind, meetingCode: e.meeting_code, location: e.location, description: e.description, attendees: e.attendees, removable: true });
  }
  const day = (d: string) => ({ start: `${d}T00:00:00.000Z`, end: `${d}T23:59:59.000Z`, allDay: true });
  for (const g of (grants ?? []) as { id: string; title: string; deadline: string }[]) items.push({ id: `gr:${g.id}`, title: `Deadline: ${g.title}`, kind: 'grant', href: '/dashboard/mjengo/grants', ...day(g.deadline) });
  for (const o of (opps ?? []) as { id: string; title: string; deadline: string }[]) items.push({ id: `op:${o.id}`, title: `Deadline: ${o.title}`, kind: 'opportunity', href: '/dashboard/mjengo/opportunities', ...day(o.deadline) });
  for (const p of (projects ?? []) as { id: string; name: string; end_date: string }[]) items.push({ id: `pr:${p.id}`, title: `Ends: ${p.name}`, kind: 'project', href: '/dashboard/mjengo/projects', ...day(p.end_date) });
  for (const t of (todos ?? []) as { id: string; title: string; due_date: string }[]) items.push({ id: `td:${t.id}`, title: t.title, kind: 'todo', href: `/dashboard/mjengo/todos?task=${t.id}`, ...day(t.due_date) });
  for (const p of (posts ?? []) as { id: string; title: string | null; body: string; scheduled_for: string }[]) items.push({ id: `po:${p.id}`, title: `Post: ${p.title || p.body.slice(0, 40)}`, kind: 'post', href: '/dashboard/mjengo/content', start: p.scheduled_for, end: p.scheduled_for, allDay: false });

  // The person's own Google Calendar, when connected.
  let googleConnected = false;
  let googleError: string | null = null;
  try {
    const cal = await googleClient(a.id);
    if (cal) {
      googleConnected = true;
      const r = await cal.events.list({ calendarId: 'primary', timeMin: fromIso, timeMax: toIso, singleEvents: true, orderBy: 'startTime', maxResults: 250 });
      const known = new Set(((events ?? []) as { id: string }[]).map((e) => e.id));
      void known;
      const mine = new Set((await db.from('mjengo_events').select('google_event_id').not('google_event_id', 'is', null)).data?.map((x: { google_event_id: string }) => x.google_event_id) ?? []);
      for (const g of r.data.items ?? []) {
        if (!g.id || mine.has(g.id) || g.status === 'cancelled') continue;
        const allDay = !g.start?.dateTime;
        const start = g.start?.dateTime ?? `${g.start?.date}T00:00:00.000Z`;
        const end = g.end?.dateTime ?? `${g.end?.date}T00:00:00.000Z`;
        items.push({ id: `g:${g.id}`, title: g.summary || '(No title)', start, end, allDay, kind: 'google', href: g.htmlLink ?? undefined, location: g.location, description: g.description, attendees: (g.attendees ?? []).map((x) => x.email ?? '').filter(Boolean) });
      }
    }
  } catch (e) {
    googleError = 'Could not read your Google Calendar. Open the calendar settings to reconnect.';
    console.error('[calendar]', e instanceof Error ? e.message : e);
  }

  return { items, googleConnected, googleConfigured: isGoogleCalendarConfigured(), googleError };
}

/** Create an event the way Google does: title, time, guests, place and an optional video call link. */
async function create_(v: NewEvent): Promise<CalItem> {
  const a = await requireModule('calendar');
  const title = v.title.trim().slice(0, 200);
  if (!title) throw new Error('Give the event a title.');
  const start = new Date(v.start);
  const end = new Date(v.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('That date or time is not valid.');
  if (end < start) throw new Error('The event cannot end before it starts.');
  const attendees = [...new Set((v.attendees ?? []).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))].slice(0, 50);
  const db = looseAdmin();
  const alertCount = Math.min(10, Math.max(0, Math.round(v.alerts ?? 1)));
  const alertEvery = Math.min(1440, Math.max(1, Math.round(v.alertEvery ?? 15)));
  const reminders = [...new Set((v.reminders ?? []).map((m) => Math.round(Number(m))).filter((m) => Number.isFinite(m) && m >= 0 && m <= 40320))].sort((x, y) => y - x).slice(0, 5);

  let code: string | null = null;
  if (v.meetingCode && !v.block) {
    const { data: m } = await db.from('mjengo_meetings').select('code').eq('code', v.meetingCode).maybeSingle();
    if (!m) throw new Error('That meeting link does not exist.');
    code = m.code as string;
  }
  if (!code && v.videoCall && !v.block) {
    for (let i = 0; i < 5 && !code; i++) {
      const c = meetCode();
      const { error } = await db.from('mjengo_meetings').insert({ code: c, mode: 'video', title, created_by: a.id });
      if (!error) code = c;
    }
  }
  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.sautisalama.org').replace(/\/$/, '');
  const link = code ? `${origin.startsWith('http') ? origin : `https://${origin}`}/meet/${code}` : null;
  const description = [v.description?.trim(), link ? `Join the call: ${link}` : ''].filter(Boolean).join('\n\n') || null;

  let googleId: string | null = null;
  try {
    const cal = await googleClient(a.id);
    if (cal) {
      const body = v.allDay
        ? { start: { date: start.toISOString().slice(0, 10) }, end: { date: new Date(end.getTime() + 86400_000).toISOString().slice(0, 10) } }
        : { start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
      const r = await cal.events.insert({ calendarId: 'primary', sendUpdates: 'all', requestBody: { summary: title, description: description ?? undefined, location: v.location || undefined, ...body, attendees: attendees.map((email) => ({ email })), reminders: reminders.length ? { useDefault: false, overrides: reminders.map((m) => ({ method: 'popup', minutes: m })) } : alertCount > 0 ? { useDefault: false, overrides: Array.from({ length: Math.min(5, alertCount) }, (_, i) => ({ method: 'popup', minutes: alertEvery * (i + 1) })) } : { useDefault: true } } });
      googleId = r.data.id ?? null;
    }
  } catch (e) {
    console.error('[calendar] google insert failed', e instanceof Error ? e.message : e);
  }

  const { data, error } = await db.from('mjengo_events').insert({
    title, description, location: v.location?.trim().slice(0, 200) || null, starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: !!v.allDay,
    kind: v.block ? 'block' : code ? 'meeting' : 'event', meeting_code: code, attendees: v.block ? [] : attendees, google_event_id: googleId, created_by: a.id,
    alerts: v.block ? 0 : reminders.length ? 0 : alertCount, alert_every_min: alertEvery, reminders: v.block ? [] : reminders,
  }).select('id, title, description, location, starts_at, ends_at, all_day, kind, meeting_code, attendees').single();
  if (error || !data) throw new Error('Could not save the event.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'calendar.event_created', targetType: 'event', targetId: data.id, targetLabel: title });
  // Guests are always emailed. When Google sent the invitation itself the app does not send a second one.
  if (!googleId && attendees.length && !v.block) {
    const when = start.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Nairobi' });
    void sendAccessEmail({ kind: code ? 'meeting' : 'event', to: attendees.filter((e) => e !== a.email), by: a.name, title, url: code ? `/meet/${code}` : '/dashboard/mjengo/calendar', detail: when, headline: undefined, note: v.description?.trim().slice(0, 600) || undefined });
  }
  if (code && attendees.length) await db.from('mjengo_meetings').update({ invitees: attendees }).eq('code', code);
  return { id: `ev:${data.id}`, title: data.title, start: data.starts_at, end: data.ends_at, allDay: data.all_day, kind: data.kind, meetingCode: data.meeting_code, location: data.location, description: data.description, attendees: data.attendees, removable: true };
}

async function remove_(id: string) {
  const a = await requireModule('calendar');
  const raw = id.replace(/^ev:/, '');
  const db = looseAdmin();
  const { data } = await db.from('mjengo_events').select('google_event_id, title, created_by').eq('id', raw).maybeSingle();
  if (!data) return;
  if (data.created_by !== a.id) throw new Error('Only the person who created an event can delete it.');
  if (data.google_event_id) {
    try { const cal = await googleClient(a.id); await cal?.events.delete({ calendarId: 'primary', eventId: data.google_event_id, sendUpdates: 'all' }); } catch { /* already gone */ }
  }
  await db.from('mjengo_events').delete().eq('id', raw);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'calendar.event_deleted', targetType: 'event', targetId: raw, targetLabel: data.title });
}

const ICON_KEYS = ['meeting', 'call', 'travel', 'deadline', 'writing', 'review', 'workshop', 'lunch', 'training', 'interview', 'report', 'social', 'finance', 'focus', 'event', 'other'];

/** An icon key per event title, chosen by the AI from what the activity is. Unknown or failed titles are left out. */
async function icons_(titles: string[]): Promise<Record<string, string>> {
  await requireModule('calendar');
  const all = [...new Set(titles.map((t) => t.trim().slice(0, 100)).filter(Boolean))].slice(0, 40);
  // Words settle most titles without a model; only the rest are sent.
  const WORDS: [RegExp, string][] = [
    [/\b(meet|call|zoom|teams|standup|stand-up|sync|catch.?up|1:1|one.on.one)\b/i, 'meeting'],
    [/\b(flight|travel|trip|train|airport|drive|visit|field)\b/i, 'travel'],
    [/\b(deadline|due|submit|submission|closing)\b/i, 'deadline'],
    [/\b(write|writing|draft|proposal|concept note)\b/i, 'writing'],
    [/\b(review|audit|check|evaluation|feedback)\b/i, 'review'],
    [/\b(workshop|retreat|forum|conference|summit)\b/i, 'workshop'],
    [/\b(lunch|breakfast|dinner|coffee|tea)\b/i, 'lunch'],
    [/\b(training|course|class|webinar|learning)\b/i, 'training'],
    [/\b(interview|hiring|recruit)\b/i, 'interview'],
    [/\b(report|reporting|brief)\b/i, 'report'],
    [/\b(party|celebrat|birthday|social|team building)\b/i, 'social'],
    [/\b(budget|finance|payroll|invoice|payment|accounts?)\b/i, 'finance'],
    [/\b(focus|deep work|blocked|no meetings)\b/i, 'focus'],
  ];
  const known: Record<string, string> = {};
  const list: string[] = [];
  for (const t of all) {
    const hit = WORDS.find(([re]) => re.test(t));
    if (hit) known[t] = hit[1]; else list.push(t);
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!list.length || !key) return known;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Calendar' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash',
      reasoning: { enabled: false },
      temperature: 0,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Classify each calendar event title by the kind of activity. Answer with a JSON object mapping every title exactly as given to one of: ${ICON_KEYS.join(', ')}.` },
        { role: 'user', content: JSON.stringify(list) },
      ],
    }),
  }).catch(() => null);
  if (!res?.ok) return known;
  try {
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}') as Record<string, string>;
    return { ...known, ...Object.fromEntries(Object.entries(parsed).filter(([t, k]) => list.includes(t) && ICON_KEYS.includes(k))) };
  } catch {
    return known;
  }
}

export const eventIcons = guard(icons_);
export const calendarMonth = guard(month_);
export const createCalendarEvent = guard(create_);
export const removeCalendarEvent = guard(remove_);
