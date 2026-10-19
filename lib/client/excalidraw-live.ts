"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { createClient } from "@/utils/supabase/client";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";

type El = { id: string; version: number; versionNonce?: number; isDeleted?: boolean; type?: string; fileId?: string | null };
type BinaryFile = { id: string; dataURL: string; mimeType: string; created: number };
export interface LivePerson { key: string; id?: string; name: string; avatar?: string | null; color: string }

interface BoardApi {
	getSceneElementsIncludingDeleted: () => readonly unknown[];
	getAppState: () => unknown;
	updateScene: (s: Record<string, unknown>) => void;
	addFiles: (files: BinaryFile[]) => void;
}

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#0369a1", "#be123c", "#4d7c0f", "#a16207", "#0e7490"];
export const colorFor = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/**
 * Draw together. Every element is kept in a shared map by id (and is replaced only by a newer version), pictures travel as
 * files, and each person's pointer, name and photo ride along as presence, so everyone sees who is drawing where.
 * Rides on the same private broadcast channels as the document editor ("mjengo-doc:" topics).
 */
export function useLiveBoard({ roomId, api, me }: { roomId: string | null; api: BoardApi | null; me: { id?: string; name: string; avatar?: string | null } | null }) {
	const [people, setPeople] = useState<LivePerson[]>([]);
	const live = useRef<{ elements: Y.Map<string>; files: Y.Map<string>; seen: Map<string, number>; seenFiles: Set<string>; provider: SupabaseYProvider; local: symbol; send: (els: readonly unknown[], files: Record<string, unknown>) => void } | null>(null);
	const meRef = useRef(me);
	meRef.current = me;

	useEffect(() => {
		if (!roomId || !api || !meRef.current) return;
		const ydoc = new Y.Doc();
		const elements = ydoc.getMap<string>("elements");
		const files = ydoc.getMap<string>("files");
		const provider = new SupabaseYProvider(ydoc, createClient(), `mjengo-doc:draw-${roomId}`, `${meRef.current.id ?? "x"}:${Math.random().toString(36).slice(2, 8)}`);
		const local = Symbol("board");
		const seen = new Map<string, number>();
		const seenFiles = new Set<string>();
		let stopped = false;

		const self = meRef.current;
		const color = colorFor(self.id ?? self.name);
		provider.awareness.setLocalStateField("user", { id: self.id, name: self.name, avatar: self.avatar ?? null, color });

		/** Bring what others drew into the board, keeping whichever copy of each element is newer. */
		const pull = async (ids?: string[]) => {
			const { reconcileElements } = await import("@excalidraw/excalidraw");
			if (stopped) return;
			const remote: El[] = [];
			const take = (k: string) => { try { const v = elements.get(k); if (v) remote.push(JSON.parse(v) as El); } catch { /* skip a broken element */ } };
			if (ids) ids.forEach(take); else elements.forEach((_, k) => take(k));
			if (!remote.length) return;
			const merged = reconcileElements(api.getSceneElementsIncludingDeleted() as never, remote as never, api.getAppState() as never) as unknown as El[];
			for (const e of merged) seen.set(e.id, e.version);
			api.updateScene({ elements: merged, captureUpdate: "NEVER" });
		};
		const pullFiles = (ids?: string[]) => {
			const out: BinaryFile[] = [];
			const take = (k: string) => { if (seenFiles.has(k)) return; try { const v = files.get(k); if (v) { out.push(JSON.parse(v) as BinaryFile); seenFiles.add(k); } } catch { /* skip */ } };
			if (ids) ids.forEach(take); else files.forEach((_, k) => take(k));
			if (out.length) api.addFiles(out);
		};

		elements.observe((ev, tr) => { if (tr.origin !== local) void pull([...ev.keysChanged]); });
		files.observe((ev, tr) => { if (tr.origin !== local) pullFiles([...ev.keysChanged]); });

		// Once connected: take what the others have, and give what only this board has.
		const onSync = () => {
			void pull().then(() => send(api.getSceneElementsIncludingDeleted(), {}));
			pullFiles();
		};
		provider.on("synced", onSync);

		const send = (els: readonly unknown[], fl: Record<string, unknown>) => {
			if (stopped) return;
			ydoc.transact(() => {
				for (const raw of els as El[]) {
					if (seen.get(raw.id) === raw.version) continue;
					seen.set(raw.id, raw.version);
					elements.set(raw.id, JSON.stringify(raw));
				}
				for (const [id, f] of Object.entries(fl)) {
					if (seenFiles.has(id)) continue;
					seenFiles.add(id);
					files.set(id, JSON.stringify(f));
				}
			}, local);
		};

		const paint = () => {
			const map = new Map<string, unknown>();
			provider.awareness.getStates().forEach((st, clientId) => {
				if (clientId === ydoc.clientID) return;
				const u = st.user as { id?: string; name?: string; avatar?: string | null; color?: string } | undefined;
				if (!u) return;
				const c = u.color ?? "#0f766e";
				map.set(String(clientId), { pointer: st.pointer, button: st.button ?? "up", username: u.name ?? "Someone", avatarUrl: u.avatar ?? undefined, color: { background: c, stroke: c }, id: u.id, socketId: String(clientId) });
			});
			api.updateScene({ collaborators: map });
			const list: LivePerson[] = [];
			provider.awareness.getStates().forEach((st, clientId) => {
				const u = st.user as { id?: string; name?: string; avatar?: string | null; color?: string } | undefined;
				if (u && clientId !== ydoc.clientID) list.push({ key: String(clientId), id: u.id, name: u.name ?? "Someone", avatar: u.avatar, color: u.color ?? "#0f766e" });
			});
			setPeople(list);
		};
		provider.awareness.on("change", paint);

		live.current = { elements, files, seen, seenFiles, provider, local, send };
		return () => {
			stopped = true;
			provider.awareness.off("change", paint);
			provider.off("synced", onSync);
			live.current = null;
			provider.destroy();
			ydoc.destroy();
			setPeople([]);
		};
	}, [roomId, api]);

	/** Call from the board's onChange. */
	const changed = useCallback((els: readonly unknown[], files: Record<string, unknown>) => { live.current?.send(els, files); }, []);
	/** Call from the board's onPointerUpdate. */
	const pointer = useCallback((p: { pointer: { x: number; y: number; tool: string }; button: string }) => {
		const a = live.current?.provider.awareness;
		if (!a) return;
		a.setLocalStateField("pointer", p.pointer);
		a.setLocalStateField("button", p.button);
	}, []);

	return { people, changed, pointer };
}
