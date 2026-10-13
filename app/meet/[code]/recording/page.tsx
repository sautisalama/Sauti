import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/access/super-admin";
import { RecordingPlayer } from "./RecordingPlayer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Call recording | Sauti Salama", robots: { index: false, follow: false } };

export default async function RecordingPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	const actor = await getActor();
	if (!actor) redirect(`/signin?next=${encodeURIComponent(`/meet/${code}/recording`)}`);
	return (
		<div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
			<div className="flex items-center justify-between">
				<p className="text-xs font-semibold uppercase tracking-widest text-serene-neutral-400">Call recording</p>
				<Link href={`/meet/${code}/notes`} className="text-sm font-medium text-sauti-teal hover:underline">Open the notes</Link>
			</div>
			<RecordingPlayer code={code} />
		</div>
	);
}
