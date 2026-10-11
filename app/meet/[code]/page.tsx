import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { looseAdmin } from "@/lib/loose-db";
import { getActor } from "@/lib/access/super-admin";
import { MeetRoom } from "@/components/meet/MeetRoom";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Call | Sauti Salama", robots: { index: false, follow: false } };

export default async function MeetPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	if (!/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/.test(code)) notFound();
	const { data } = await looseAdmin().from("mjengo_meetings").select("title, mode, ended_at").eq("code", code).maybeSingle();
	if (!data) notFound();
	const actor = await getActor();
	return (
		<MeetRoom
			code={code}
			mode={data.mode === "voice" ? "voice" : "video"}
			title={data.title}
			defaultName={actor?.name ?? ""}
			canSave={!!actor?.isAdmin}
		/>
	);
}
