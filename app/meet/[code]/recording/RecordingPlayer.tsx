"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { watchRecording } from "@/app/actions/meet-recording";

export function RecordingPlayer({ code }: { code: string }) {
	const [url, setUrl] = useState<string | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		unwrap(watchRecording(code)).then((r) => setUrl(r.url)).catch((e) => setError(e instanceof Error ? e.message : "Could not open the recording."));
	}, [code]);

	if (error) return <div className="rounded-2xl border border-serene-neutral-200 bg-white p-10 text-center"><Lock className="mx-auto mb-3 h-8 w-8 text-serene-neutral-300" /><p className="text-sm text-serene-neutral-600">{error}</p></div>;
	if (!url) return <div className="flex justify-center p-16 text-serene-neutral-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
	return <video src={url} controls playsInline className="aspect-video w-full rounded-2xl bg-black" />;
}
