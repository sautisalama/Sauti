import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/access/super-admin";
import { NotesView } from "./NotesView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Call notes | Sauti Salama", robots: { index: false, follow: false } };

export default async function NotesPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	const actor = await getActor();
	if (!actor) redirect(`/signin?next=${encodeURIComponent(`/meet/${code}/notes`)}`);
	return <NotesView code={code} />;
}
