"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WordcraftEditor, httpVersionStore, type SavedFile, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { yjsCollaboration } from "@gamine/wordcraft-react/collab";
import * as Y from "yjs";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#0369a1", "#be123c", "#4d7c0f", "#a16207", "#0e7490"];
const colorFor = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/** The document editor for people holding a link: edit together live, or read, with history kept. */
export function PublicDoc({ id, name, access, signedInName, signedInId }: { id: string; name: string; access: "view" | "edit"; signedInName: string | null; signedInId: string | null }) {
	const ref = useRef<WordcraftEditorRef>(null);
	const [who, setWho] = useState(signedInName ?? "");
	const [ready, setReady] = useState(!!signedInName);
	const [doc, setDoc] = useState<{ name: string; data: ArrayBuffer } | null>(null);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"" | "saving" | "saved">("");
	const queue = useRef<Promise<unknown>>(Promise.resolve());
	const guestId = useRef(`guest-${Math.random().toString(36).slice(2, 8)}`);

	useEffect(() => {
		if (signedInName) return;
		try { const v = localStorage.getItem("ss_guest_name"); if (v) { setWho(v); } } catch { /* ignore */ }
	}, [signedInName]);

	useEffect(() => {
		if (!ready) return;
		let cancelled = false;
		(async () => {
			try {
				const r = await fetch(`/api/public-docs/${id}/file`);
				if (!r.ok) throw new Error(await r.text());
				const { url } = (await r.json()) as { url: string };
				const f = await fetch(url);
				if (!f.ok) throw new Error("Could not download the document.");
				const data = await f.arrayBuffer();
				if (!cancelled) setDoc({ name, data });
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "Could not open the document.");
			}
		})();
		return () => { cancelled = true; };
	}, [id, name, ready]);

	const person = useMemo(() => ({ name: who || "Guest", id: signedInId ?? guestId.current, color: colorFor(signedInId ?? who) }), [who, signedInId]);

	const collab = useMemo(() => {
		if (!doc || access !== "edit") return null;
		const ydoc = new Y.Doc();
		const provider = new SupabaseYProvider(ydoc, createClient(), `mjengo-doc:${id}`, `${person.id}:${Math.random().toString(36).slice(2, 8)}`);
		return { provider, collaboration: yjsCollaboration({ doc: ydoc, provider, user: person }) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [doc, access, id]);
	useEffect(() => () => collab?.provider.destroy(), [collab]);

	const onSave = (file: SavedFile) => {
		const run = queue.current.catch(() => undefined).then(async () => {
			setStatus("saving");
			const r = await fetch(`/api/public-docs/${id}/save`, { method: "PUT", body: file.bytes as BlobPart });
			if (!r.ok) { setStatus(""); throw new Error(await r.text()); }
			setStatus("saved");
		});
		queue.current = run;
		return run;
	};

	if (!ready) {
		return (
			<main className="flex min-h-dvh items-center justify-center bg-serene-neutral-50 p-6">
				<form onSubmit={(e) => { e.preventDefault(); if (!who.trim()) return; try { localStorage.setItem("ss_guest_name", who.trim()); } catch { /* ignore */ } setReady(true); }} className="w-full max-w-sm space-y-4 rounded-2xl border border-serene-neutral-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-2 text-sauti-teal"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">Sauti Salama</span></div>
					<div>
						<h1 className="text-lg font-semibold text-serene-neutral-900">{name}</h1>
						<p className="mt-1 text-sm text-serene-neutral-600">{access === "edit" ? "You can edit this document together with the team." : "You can read this document."} Tell people who you are.</p>
					</div>
					<input value={who} onChange={(e) => setWho(e.target.value)} autoFocus placeholder="Your name" aria-label="Your name" className="h-11 w-full rounded-lg border border-serene-neutral-200 px-3 text-base outline-none focus:border-sauti-teal" />
					<button type="submit" disabled={!who.trim()} className="h-11 w-full rounded-full bg-sauti-teal text-sm font-semibold text-white disabled:opacity-40">Open the document</button>
				</form>
			</main>
		);
	}

	return (
		<div className="flex h-dvh flex-col bg-white">
			<div className="flex h-11 shrink-0 items-center gap-3 border-b border-black/10 px-3 text-sm">
				<span className="font-semibold text-sauti-teal">Sauti Salama</span>
				<span className="min-w-0 truncate text-serene-neutral-700">{name}</span>
				<span className="flex-1" />
				<span className="text-xs text-serene-neutral-500">{access === "edit" ? (status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : "Editing") : "View only"} · {person.name}</span>
			</div>
			<div className="relative min-h-0 flex-1">
				{error ? (
					<p className="p-6 text-sm text-red-700">{error}</p>
				) : !doc ? (
					<div className="flex h-full items-center justify-center text-serene-neutral-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
				) : (
					<WordcraftEditor
						ref={ref}
						height="100%"
						document={doc}
						guardUnload={access === "edit"}
						autoSave={access === "edit"}
						mode={access === "edit" ? undefined : "viewing"}
						user={person}
						versionHistory={{ store: httpVersionStore(`/api/public-docs/${id}/versions`), documentId: id, interval: 120_000 }}
						collaboration={collab?.collaboration ?? null}
						onSave={onSave}
						onError={(e) => setError(e.message)}
						fallback={(e) => <div className="p-6 text-sm text-red-700">The editor could not start: {e.message}. It needs a current browser with WebGL2 or WebGPU.</div>}
					/>
				)}
			</div>
		</div>
	);
}
