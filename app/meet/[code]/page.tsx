import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { looseAdmin } from "@/lib/loose-db";
import { getActor } from "@/lib/access/super-admin";
import { MeetRoom } from "@/components/meet/MeetRoom";
import { previewMetadata } from "@/lib/seo/previews";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
	const { code } = await params;
	return previewMetadata("meet", code, "Call | Sauti Salama");
}

export default async function MeetPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ embed?: string; autojoin?: string; mic?: string; cam?: string }> }) {
	const { code } = await params;
	const { embed, autojoin, mic, cam } = await searchParams;
	if (!/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/.test(code)) notFound();
	const { data } = await looseAdmin().from("mjengo_meetings").select("title, mode, ended_at, description, resources").eq("code", code).maybeSingle();
	if (!data) notFound();
	const actor = await getActor();
	// The scheduled end is only told to people who were invited (and the host), never to guests with just the link.
	let endsAt: string | null = null;
	if (actor) {
		const { data: ev } = await looseAdmin().from("mjengo_events").select("ends_at, attendees, created_by").eq("meeting_code", code).order("starts_at", { ascending: false }).limit(1).maybeSingle();
		const invited = !!ev && (ev.created_by === actor.id || ((ev.attendees ?? []) as string[]).some((e) => String(e).toLowerCase() === actor.email));
		if (invited && ev?.ends_at) endsAt = new Date(ev.ends_at as string).toISOString();
	}
	return (
		<MeetRoom
			code={code}
			mode={data.mode === "voice" ? "voice" : "video"}
			title={data.title}
			description={(data.description as string | null) ?? ""}
			resources={(actor?.isAdmin ? (data.resources as { label: string; url: string }[] | null) : null) ?? []}
			defaultName={actor?.name ?? ""}
			canSave={!!actor?.isAdmin}
			embedded={embed === "1"}
			autoJoin={autojoin === "1"}
			startMic={mic !== "0"}
			startCam={cam !== "0"}
			userId={actor?.id ?? null}
			endsAt={endsAt}
		/>
	);
}
