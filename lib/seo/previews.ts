import type { Metadata } from "next";
import { looseAdmin } from "@/lib/loose-db";
import { getBookableProfessional } from "@/lib/scheduling/public-professional";

/** What a shared link looks like in chats, mail and social feeds: its own title, description and picture. */
export type PreviewKind = "form" | "doc" | "meet" | "user" | "group" | "schedule";

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
		return { label: data.mode === "voice" ? "Voice call" : "Video call", title: clip(data.title, 90) || "Sauti Salama meeting", description: clip(data.description, 160) || (by ? `${by} invited you to join. No account needed.` : "You are invited to join. No account needed."), image: host?.avatar_url ?? null, round: true, accent: TEAL };
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
	const pro = await getBookableProfessional(id);
	if (!pro) return null;
	const p = await person(pro.id);
	const title = clip(pro.professional_title, 80);
	return { label: "Book an appointment", title: fullName(pro) || "Book an appointment", description: title ? `${title}. Pick a time that suits you.` : "Pick a time that suits you.", image: p?.avatar_url ?? null, round: true, accent: TEAL };
}

/** Metadata for a page whose link gets shared: Open Graph and Twitter cards with the card picture from /api/og. */
export async function previewMetadata(kind: PreviewKind, id: string, fallbackTitle: string): Promise<Metadata> {
	const p = await getPreview(kind, id).catch(() => null);
	if (!p) return { title: fallbackTitle, robots: { index: false, follow: false } };
	const image = `/api/og?k=${kind}&id=${encodeURIComponent(id)}`;
	return {
		title: `${p.title} | Sauti Salama`,
		description: p.description,
		robots: { index: false, follow: false },
		openGraph: { title: p.title, description: p.description, siteName: "Sauti Salama", type: "website", images: [{ url: image, width: 1200, height: 630, alt: p.title }] },
		twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [image] },
	};
}
