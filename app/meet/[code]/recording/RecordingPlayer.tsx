"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { canDeleteRecordings, deleteRecording, watchRecording } from "@/app/actions/meet-recording";

export function RecordingPlayer({ code }: { code: string }) {
	const [url, setUrl] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [canDelete, setCanDelete] = useState(false);
	const [ask, setAsk] = useState(false);
	const [busy, setBusy] = useState(false);
	const [gone, setGone] = useState(false);

	useEffect(() => {
		unwrap(watchRecording(code)).then((r) => setUrl(r.url)).catch((e) => setError(e instanceof Error ? e.message : "Could not open the recording."));
	}, [code]);
	useEffect(() => { unwrap(canDeleteRecordings()).then(setCanDelete).catch(() => setCanDelete(false)); }, []);
	const remove = async () => {
		setBusy(true);
		try { await unwrap(deleteRecording(code)); setGone(true); setUrl(null); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete the recording."); }
		setBusy(false);
	};

	if (gone) return <div className="rounded-2xl border border-serene-neutral-200 bg-white p-10 text-center text-sm text-serene-neutral-600">The recording was deleted. The notes and transcript are kept.</div>;
	if (error) return <div className="rounded-2xl border border-serene-neutral-200 bg-white p-10 text-center"><Lock className="mx-auto mb-3 h-8 w-8 text-serene-neutral-300" /><p className="text-sm text-serene-neutral-600">{error}</p></div>;
	if (!url) return <div className="flex justify-center p-16 text-serene-neutral-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
	return (
		<div className="space-y-3">
			<video src={url} controls playsInline className="aspect-video w-full rounded-2xl bg-black" />
			{canDelete && (
				<div className="flex justify-end">
					{ask ? (
						<span className="flex items-center gap-2 text-sm"><span className="text-serene-neutral-600">Delete this recording for everyone?</span><button onClick={() => void remove()} disabled={busy} className="rounded-full bg-[#ea4335] px-4 py-1.5 font-semibold text-white hover:bg-[#d93025] disabled:opacity-60">{busy ? "Deleting…" : "Delete"}</button><button onClick={() => setAsk(false)} className="rounded-full px-3 py-1.5 font-medium text-serene-neutral-600 hover:bg-serene-neutral-100">Keep</button></span>
					) : <button onClick={() => setAsk(true)} className="rounded-full border border-[#ea4335]/40 px-4 py-1.5 text-sm font-medium text-[#d93025] hover:bg-[#ea4335]/10">Delete recording</button>}
				</div>
			)}
		</div>
	);
}
