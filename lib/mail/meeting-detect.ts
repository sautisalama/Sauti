/**
 * Finds meetings and deadlines in an email, locally and without a model. Pure: same input, same output.
 * Times are read as Africa/Nairobi (UTC+3, no daylight saving) unless the text says otherwise (ICS "Z" times).
 * A deadline is reported only when a calendar date can be resolved; nothing is guessed.
 */
export type MeetingProvider = "meet" | "zoom" | "teams" | "webex" | "sauti" | "ics" | "other";
export interface DetectedMeeting { provider: MeetingProvider; url: string | null; title?: string; start?: string; end?: string; /** A date was read but no time. */ dateOnly?: string; code?: string }
export interface DetectedDeadline { text: string; date: string }
export interface Detection { meetings: DetectedMeeting[]; deadlines: DetectedDeadline[] }

const OFFSET_MS = 3 * 3600_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_RE = "(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)";

/** Nairobi calendar parts of an instant. */
const nairobi = (t: number) => { const d = new Date(t + OFFSET_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() }; };
const at = (y: number, m: number, d: number, hh = 0, mm = 0) => Date.UTC(y, m, d, hh, mm) - OFFSET_MS;
const isoDate = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function plainText(html: string): string {
	return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

interface Parsed { y: number; m: number; d: number; hh?: number; mm?: number; len: number }

/** Reads one date (and optional time) at the start of `s`, resolving words and missing years against `ref`. */
function parseAt(s: string, ref: number): Parsed | null {
	const r = nairobi(ref);
	let y: number | undefined, m: number | undefined, d: number | undefined, len = 0;
	let x: RegExpMatchArray | null;
	if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})\b/))) { y = +x[1]; m = +x[2] - 1; d = +x[3]; len = x[0].length; }
	else if ((x = s.match(new RegExp(`^(?:${DAY_RE},?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\b\\.?(?:,?\\s+(\\d{4})\\b)?`, "i")))) { d = +x[2]; m = MONTHS.indexOf(x[3].slice(0, 3).toLowerCase()); y = x[4] ? +x[4] : undefined; len = x[0].length; }
	else if ((x = s.match(new RegExp(`^(?:${DAY_RE},?\\s+)?${MON_RE}\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`, "i")))) { m = MONTHS.indexOf(x[2].slice(0, 3).toLowerCase()); d = +x[3]; y = x[4] ? +x[4] : undefined; len = x[0].length; }
	else if ((x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/))) { d = +x[1]; m = +x[2] - 1; y = +x[3]; len = x[0].length; } // day first, as in Kenya
	else if ((x = s.match(/^(today|tonight|tomorrow|day after tomorrow)\b/i))) {
		const k = x[1].toLowerCase(); const add = k === "tomorrow" ? 1 : k.startsWith("day after") ? 2 : 0;
		const t = nairobi(ref + add * 86400_000); y = t.y; m = t.m; d = t.d; len = x[0].length;
	} else if ((x = s.match(new RegExp(`^(?:(this|next|coming)\\s+)?${DAY_RE}\\b`, "i")))) {
		const want = DAYS.indexOf(x[2].slice(0, 3).toLowerCase());
		let add = (want - r.dow + 7) % 7;
		if (x[1]?.toLowerCase() === "next" && add === 0) add = 7;
		const t = nairobi(ref + add * 86400_000); y = t.y; m = t.m; d = t.d; len = x[0].length;
	}
	if (m === undefined || d === undefined || m < 0 || d < 1 || d > 31) return null;
	if (y === undefined) { // no year: the next such date on or after the reference day
		y = r.y;
		if (at(y, m, d) < at(r.y, r.m, r.d)) y += 1;
	}
	if (new Date(Date.UTC(y, m, d)).getUTCMonth() !== m) return null; // 31 February and the like
	const out: Parsed = { y, m, d, len };
	const t = s.slice(len).match(/^(?:\s*(?:,|at|@|from|-)\s*|\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d:])(?:\s*(?:hrs|hours|EAT|UTC\+3|GMT\+3))?/i);
	if (t) {
		let hh = +t[1]; const mm = t[2] ? +t[2] : 0; const ap = t[3]?.toLowerCase().replace(/\./g, "");
		const ok = t[2] !== undefined || ap !== undefined; // a bare number is not a time
		if (ok && mm < 60 && hh <= 23) {
			if (ap === "pm" && hh < 12) hh += 12;
			if (ap === "am" && hh === 12) hh = 0;
			out.hh = hh; out.mm = mm; out.len += t[0].length;
		}
	}
	return out;
}

/** The first date found scanning forward through `s`. */
function findDate(s: string, ref: number): Parsed | null {
	const re = /[A-Za-z0-9]+/g;
	for (let m: RegExpExecArray | null; (m = re.exec(s)); ) {
		const p = parseAt(s.slice(m.index), ref);
		if (p) return p;
	}
	return null;
}

const toDate = (p: Parsed) => at(p.y, p.m, p.d, p.hh ?? 0, p.mm ?? 0);

function classify(raw: string): { provider: MeetingProvider; url: string; code?: string } | null {
	let u: URL;
	try { u = new URL(raw.replace(/[).,;>\]]+$/, "")); } catch { return null; }
	if (!/^https?:$/.test(u.protocol)) return null;
	const h = u.hostname.toLowerCase(); const p = u.pathname;
	const url = u.toString();
	if (h === "meet.google.com" && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\b/i.test(p)) return { provider: "meet", url };
	if (/(^|\.)zoom\.(us|com)$/.test(h) && /^\/(j|my|w|wc\/join)\//.test(p)) return { provider: "zoom", url };
	if ((h === "teams.microsoft.com" && /^\/(l\/meetup-join|meet)\//.test(p)) || (h === "teams.live.com" && /^\/meet\//.test(p))) return { provider: "teams", url };
	if (/(^|\.)webex\.com$/.test(h) && /(\/meet\/|\/join\/|\/j\.php|\/wbxmjs\/|\/webappng\/)/i.test(p + u.search)) return { provider: "webex", url };
	const c = p.match(/^\/meet\/([A-Za-z0-9][A-Za-z0-9-]{3,40})\/?$/);
	if (c && (/sautisalama/i.test(h) || h === "localhost")) return { provider: "sauti", url, code: c[1] };
	return null;
}

/** VEVENT blocks written out in the message body (unfolded lines, KEY;PARAMS:value). */
function readIcs(text: string): DetectedMeeting[] {
	const out: DetectedMeeting[] = [];
	const unfolded = text.replace(/\r?\n[ \t]/g, "");
	for (const blk of unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi)) {
		const get = (k: string) => blk[1].match(new RegExp(`^${k}(?:;[^:\\r\\n]*)?:(.*)$`, "mi"))?.[1]?.trim();
		const when = (v?: string) => {
			const m = v?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
			if (!m) return null;
			if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}` };
			const ms = m[7] ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : at(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
			return { iso: new Date(ms).toISOString() };
		};
		const s = when(get("DTSTART")); const e = when(get("DTEND"));
		const title = get("SUMMARY")?.replace(/\\,/g, ",").replace(/\\n/gi, " ").slice(0, 200);
		const link = [get("URL"), get("LOCATION"), get("DESCRIPTION")].map((v) => v?.match(/https?:\/\/[^\s\\<>"']+/)?.[0]).find(Boolean);
		const c = link ? classify(link) : null;
		out.push({ provider: c?.provider ?? "ics", url: c?.url ?? link ?? null, code: c?.code, title, start: s && "iso" in s ? s.iso : undefined, end: e && "iso" in e ? e.iso : undefined, dateOnly: s && "date" in s ? s.date : undefined });
	}
	return out;
}

const TRIGGER = /\b(?:no later than|on or before|not later than|deadline(?:\s+(?:is|of|on|date))?|due(?:\s+(?:on|by|date))?|submit(?:ted)?\s+by|closes?(?:\s+on)?|closing(?:\s+date)?|by|before|until|till)\b\s*[:\-]?\s*(?:the\s+)?(?:end of\s+)?(?:on\s+)?/gi;

/** @param sent when the email was sent (ISO or Date); relative words are resolved against it. Defaults to now. */
export function detectMeetingsAndDeadlines(input: { subject?: string; text?: string; html?: string | null; sent?: string | Date | null }): Detection {
	const ref = input.sent ? new Date(input.sent).getTime() : Date.now();
	const refMs = Number.isFinite(ref) ? ref : Date.now();
	const subject = input.subject ?? "";
	const body = (input.text && input.text.trim() ? input.text : plainText(input.html ?? "")).replace(/\r/g, "");
	const hrefs = [...(input.html ?? "").matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
	const urls = [...new Set([...hrefs, ...(body.match(/https?:\/\/[^\s<>"')]+/g) ?? [])])];
	const meetings: DetectedMeeting[] = [];

	const ics = readIcs(body);
	meetings.push(...ics);

	const seen = new Set(ics.map((m) => m.url).filter(Boolean) as string[]);
	// A time is read from a "When:" style line first, then from a date close to the link.
	const whenLine = body.match(/^\s*(?:when|date(?: and| &)? time|date|time|starts?)\s*[:\-]\s*(.{4,120})$/im);
	const whenP = whenLine ? findDate(whenLine[1], refMs) : null;
	const clean = (u: string) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } };
	const title = subject.replace(/^((re|fwd?|invitation|updated invitation)\s*:\s*)+/i, "").trim().slice(0, 200) || undefined;
	for (const raw of urls) {
		const c = classify(raw);
		if (!c || [...seen].some((s) => clean(s) === clean(c.url))) continue;
		seen.add(c.url);
		let p = whenP;
		if (!p) {
			const idx = body.indexOf(raw);
			const win = body.slice(Math.max(0, (idx < 0 ? 0 : idx) - 250), idx < 0 ? 400 : idx + 250);
			const f = findDate(win, refMs);
			if (f && (f.hh !== undefined || /meeting|call|webinar|join|session|invit|workshop|when/i.test(win))) p = f;
		}
		const m: DetectedMeeting = { provider: c.provider, url: c.url, code: c.code, title };
		if (p) { if (p.hh !== undefined) m.start = new Date(toDate(p)).toISOString(); else m.dateOnly = isoDate(p.y, p.m, p.d); }
		meetings.push(m);
	}
	// An invitation with a stated time but no link counts when it says so.
	if (!meetings.length && whenP && /\b(invit(?:e|ation)|you are invited|join us|meeting|webinar|call)\b/i.test(subject + " " + body.slice(0, 600))) {
		const m: DetectedMeeting = { provider: "other", url: null, title };
		if (whenP.hh !== undefined) m.start = new Date(toDate(whenP)).toISOString(); else m.dateOnly = isoDate(whenP.y, whenP.m, whenP.d);
		meetings.push(m);
	}

	// Deadlines.
	const deadlines: DetectedDeadline[] = [];
	const hay = subject + "\n" + body;
	const rn = nairobi(refMs);
	const today0 = at(rn.y, rn.m, rn.d);
	const re = new RegExp(TRIGGER.source, "gi");
	for (let t: RegExpExecArray | null; (t = re.exec(hay)); ) {
		const start = t.index + t[0].length;
		const p = parseAt(hay.slice(start, start + 60), refMs);
		if (!p) continue;
		if (toDate(p) < today0) continue; // already past
		const date = isoDate(p.y, p.m, p.d);
		if (deadlines.some((d) => d.date === date)) continue;
		const lineStart = hay.lastIndexOf("\n", t.index) + 1;
		const text = hay.slice(Math.max(lineStart, t.index - 40), start + p.len).replace(/\s+/g, " ").trim();
		deadlines.push({ text, date });
		if (deadlines.length >= 3) break;
	}
	return { meetings: meetings.slice(0, 3), deadlines };
}
