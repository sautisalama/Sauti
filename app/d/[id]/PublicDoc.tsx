"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WordcraftEditor, type SavedFile, type TopBarOptions, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { yjsCollaboration } from "@gamine/wordcraft-react/collab";
import * as Y from "yjs";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";
import { watchedVersionStore } from "@/lib/client/watched-version-store";
import { directVersionStore } from "@/lib/client/direct-version-store";

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#0369a1", "#be123c", "#4d7c0f", "#a16207", "#0e7490"];
const colorFor = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/** The document editor for people holding a link: edit together live, or read, with history kept. */
export function PublicDoc({ id, name, access, signedInName, signedInId }: { id: string; name: string; access: "view" | "edit"; signedInName: string | null; signedInId: string | null }) {
	const ref = useRef<WordcraftEditorRef>(null);
	const [who, setWho] = useState(signedInName ?? "");
	const [ready, setReady] = useState(!!signedInName);
	const [doc, setDoc] = useState<{ name: string; data: ArrayBuffer } | null>(null);
	const [error, setError] = useState("");
	const [historyProblem, setHistoryProblem] = useState(false);
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

	// A guest who gave no name is still shown: the editor names them ("Anonymous ...").
	const person = useMemo(() => ({ name: who.trim(), id: signedInId ?? guestId.current, color: colorFor(signedInId ?? who) }), [who, signedInId]);

	const collab = useMemo(() => {
		if (!doc) return null;
		const ydoc = new Y.Doc();
		const provider = new SupabaseYProvider(ydoc, createClient(), `mjengo-doc:${id}`, `${person.id}:${Math.random().toString(36).slice(2, 8)}`);
		return { provider, collaboration: yjsCollaboration({ doc: ydoc, provider, user: person }) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [doc, id]);
	useEffect(() => () => collab?.provider.destroy(), [collab]);

	const onSave = (file: SavedFile) => {
		const run = queue.current.catch(() => undefined).then(async () => {
			const r = await fetch(`/api/public-docs/${id}/save`, { method: "PUT", body: file.bytes as BlobPart });
			if (!r.ok) throw new Error(await r.text());
		});
		queue.current = run;
		return run;
	};

	// The editor's own top bar: the brand, the title and save state, everyone in the document now, and you.
	const topBar = useMemo<TopBarOptions>(() => ({
		left: [{ type: "custom", id: "brand", render: () => <span className="whitespace-nowrap px-2 text-sm font-semibold text-sauti-teal">Sauti Salama</span> }, access === "edit" ? "quickAccess" : null],
		center: [{ type: "title", text: name }, "saveState"],
		right: [
			historyProblem ? { type: "custom", id: "history-problem", render: () => <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">History is not being kept right now</span> } : null,
			"presence",
			"comments",
			{ type: "user", user: { name: person.name || "Anonymous" } },
		],
	}), [name, access, historyProblem, person.name]);

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
					<button type="button" onClick={() => setReady(true)} className="h-9 w-full rounded-full text-sm font-medium text-serene-neutral-600 hover:bg-serene-neutral-50">Continue without a name</button>
				</form>
			</main>
		);
	}

	return (
		<div className="flex h-dvh flex-col bg-white">
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
						permission={access === "edit" ? "edit" : "view"}
						comments={{ exclusive: true }}
						presence
						topBar={topBar}
						user={person}
						versionHistory={{ store: watchedVersionStore(directVersionStore(`/api/public-docs/${id}/versions`), () => setHistoryProblem(true)), documentId: id, interval: 120_000 }}
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
