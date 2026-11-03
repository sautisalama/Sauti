import type { Metadata } from "next";
import { looseAdmin } from "@/lib/loose-db";
import { getBookableProfessional } from "@/lib/scheduling/public-professional";
import { SECTIONS, sectionAccent, sectionHeadline } from "@/lib/seo/sections";
import { socialMeta } from "@/lib/seo/meta";

/** What a shared link looks like in chats, mail and social feeds: its own title, description and picture. */
export type PreviewKind = "form" | "doc" | "meet" | "user" | "group" | "schedule" | "section" | "course";

export interface Preview {
	label: string;
	title: string;
	description: string;
	/** A photo that belongs to the thing (a person, a group, a form's cover); null draws the card without one. */
	image: string | null;
	/** People and groups show their photo round. */
	round: boolean;
	accent: string;
}

const UUID = /^[0-9a-f-]{36}$/i;
const TEAL = "#068297";

const clip = (s: string | null | undefined, n: number) => {
	const t = (s ?? "").replace(/\s+/g, " ").trim();
	return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const https = (u: unknown) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);
const fullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();

async function person(id: string | null | undefined) {
	if (!id || !UUID.test(id)) return null;
	const { data } = await looseAdmin().from("profiles").select("first_name, last_name, avatar_url").eq("id", id).maybeSingle();
	return data as { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

const TZ = "Africa/Nairobi";
function whenText(start: string, end: string | null) {
	const a = new Date(start);
	if (Number.isNaN(a.getTime())) return "";
	const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(a);
	const t = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
	const b = end ? new Date(end) : null;
	return `${day}, ${t(a)}${b && !Number.isNaN(b.getTime()) ? `\u2013${t(b)}` : ""} EAT`;
}

export async function getPreview(kind: PreviewKind, id: string): Promise<Preview | null> {
	const db = looseAdmin();
	if (kind === "form") {
		if (!/^[a-z0-9-]{3,80}$/i.test(id)) return null;
		const { data } = await db.from("mjengo_forms").select("title, description, status, settings").eq("slug", id).maybeSingle();
		if (!data || data.status === "draft") return null;
		const s = (data.settings ?? {}) as { images?: unknown[]; style?: { accent?: string }; theme?: { accent?: string; primary?: string } };
		const accent = [s.style?.accent, s.theme?.accent, s.theme?.primary].find((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) ?? TEAL;
		return { label: "Form", title: clip(data.title, 90) || "Form", description: clip(data.description, 200) || "Open the form and answer it in a minute.", image: (s.images ?? []).map(https).find(Boolean) ?? null, round: false, accent };
	}
	if (kind === "doc") {
		if (!UUID.test(id)) return null;
		const { data } = await db.from("vault_files").select("name, owner_id, link_access").eq("id", id).maybeSingle();
		if (!data || (data.link_access !== "view" && data.link_access !== "edit")) return null;
		const by = fullName(await person(data.owner_id));
		return { label: data.link_access === "edit" ? "Shared document · can edit" : "Shared document", title: clip(String(data.name).replace(/\.[a-z0-9]{2,5}$/i, ""), 90), description: by ? `Shared with you by ${by} on Sauti Salama.` : "Shared with you on Sauti Salama.", image: null, round: false, accent: TEAL };
	}
	if (kind === "meet") {
		const { data } = await db.from("mjengo_meetings").select("title, description, mode, created_by").eq("code", id).maybeSingle();
		if (!data) return null;
		const host = await person(data.created_by);
		const by = fullName(host);
		// A calendar invite: say when it is, in Nairobi time, so the card works as the invitation.
		const { data: ev } = await db.from("mjengo_events").select("starts_at, ends_at").eq("meeting_code", id).order("starts_at", { ascending: false }).limit(1).maybeSingle();
		const when = ev?.starts_at ? whenText(ev.starts_at as string, ev.ends_at as string | null) : "";
		const base = clip(data.description, 160) || (by ? `${by} invited you to join. No account needed.` : "You are invited to join. No account needed.");
		return { label: ev ? "Calendar invite" : data.mode === "voice" ? "Voice call" : "Video call", title: clip(data.title, 90) || "Sauti Salama meeting", description: when ? `${when}. ${base}` : base, image: host?.avatar_url ?? null, round: true, accent: TEAL };
	}
	if (kind === "user") {
		const c = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
		if (c.length !== 8) return null;
		const { data } = await db.from("profiles").select("first_name, last_name, avatar_url, user_type, isVerified").eq("sauti_id", `SS-${c.slice(0, 4)}-${c.slice(4)}`).maybeSingle();
		if (!data) return null;
		// A preview is public: whether someone is a survivor is never shown, only professionals and organisations say what they are.
		const role = data.user_type === "professional" ? "professional" : data.user_type === "ngo" ? "organisation" : "";
		return { label: "Sauti ID", title: fullName(data) || "Sauti Salama member", description: `${data.isVerified && role ? "Verified " : ""}${role || "Member"} on Sauti Salama. Open to connect and message.`, image: data.avatar_url ?? null, round: true, accent: TEAL };
	}
	if (kind === "group") {
		const c = id.toUpperCase().replace(/\s/g, "");
		const { data } = await db.from("communities").select("name, description, avatar_url, member_count").eq("invite_code", c).maybeSingle();
		if (!data) return null;
		const n = data.member_count ?? 0;
		return { label: "Group invite", title: clip(data.name, 90), description: clip(data.description, 140) || `${n} ${n === 1 ? "member" : "members"}. Open the link to join the conversation.`, image: data.avatar_url ?? null, round: true, accent: TEAL };
	}
	if (kind === "section") {
		const x = SECTIONS[id];
		return x ? { label: x.label, title: x.title, description: x.description, image: null, round: true, accent: sectionAccent(id) } : null;
	}
	if (kind === "course") {
		if (!/^[a-z0-9-]{1,120}$/i.test(id)) return null;
		const { data } = await db.from("courses").select("title, summary, cover_image_url, level, estimated_minutes").eq("slug", id).eq("status", "published").maybeSingle();
		if (!data) return null;
		const mins = data.estimated_minutes ? `${data.estimated_minutes} min` : "";
		const extra = [data.level, mins].filter(Boolean).join(" · ");
		return { label: "Free course", title: clip(data.title, 90), description: clip(data.summary, 170) || `A free self-paced course from Sauti Salama${extra ? ` (${extra})` : ""}.`, image: https(data.cover_image_url), round: false, accent: TEAL };
	}
	const pro = await getBookableProfessional(id);
	if (!pro) return null;
	const p = await person(pro.id);
	const title = clip(pro.professional_title, 80);
	return { label: "Book an appointment", title: fullName(pro) || "Book an appointment", description: title ? `${title}. Pick a time that suits you.` : "Pick a time that suits you.", image: p?.avatar_url ?? null, round: true, accent: TEAL };
}

const PATHS: Record<PreviewKind, string> = { form: "/f/", doc: "/d/", meet: "/meet/", user: "/connect/", group: "/join/", schedule: "/schedule/", course: "/learn/courses/", section: "/dashboard/" };

/** Metadata for a page whose link gets shared: Open Graph and Twitter cards with the card picture from /api/og. */
export async function previewMetadata(kind: PreviewKind, id: string, fallbackTitle: string, opts: { index?: boolean } = {}): Promise<Metadata> {
	const p = await getPreview(kind, id).catch(() => null);
	if (!p) return { title: fallbackTitle, robots: { index: false, follow: false } };
	const image = `/api/og?k=${kind}&id=${encodeURIComponent(id)}`;
	const title = kind === "section" && SECTIONS[id] ? sectionHeadline(SECTIONS[id]) : `${p.title} · ${p.label}`;
	return { title: { absolute: `${title} | Sauti Salama` }, ...socialMeta({ path: `${PATHS[kind]}${id}`, title, description: p.description, image, alt: p.title, index: opts.index }) };
}
