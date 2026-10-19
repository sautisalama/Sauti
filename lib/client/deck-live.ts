"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { createClient } from "@/utils/supabase/client";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";
import { colorFor } from "@/lib/client/excalidraw-live";
import { THEMES, uid, type Deck, type El, type Slide, type Theme } from "@/lib/deck/model";

export interface DeckPerson { key: string; id?: string; name: string; avatar?: string | null; color: string; slide?: string | null; el?: string | null }

const LOCAL = Symbol("deck-local");

/**
 * A presentation kept in a shared Yjs document, so everyone who has it open edits the same slides: the order of
 * slides, each slide's notes, and every box by id (a box is replaced as a whole, newest change winning). Presence
 * (name, photo, the slide and box each person has selected) rides along as awareness. Without a room it is simply
 * the editor's own state, with the same undo.
 */
export function useDeckDoc({ roomId, seed, me, enabled }: { roomId: string | null; seed: Deck | null; me: { id?: string; name: string; avatar?: string | null } | null; enabled: boolean }) {
	const [deck, setDeck] = useState<Deck | null>(null);
	const [people, setPeople] = useState<DeckPerson[]>([]);
	const [synced, setSynced] = useState(false);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const ref = useRef<{ doc: Y.Doc; provider: SupabaseYProvider | null; um: Y.UndoManager } | null>(null);
	const seedRef = useRef(seed);
	seedRef.current = seed;
	const meRef = useRef(me);
	meRef.current = me;

	useEffect(() => {
		if (!enabled || !seedRef.current) return;
		const doc = new Y.Doc();
		const meta = doc.getMap<string>("meta");
		const order = doc.getMap<number>("order");
		const slides = doc.getMap<string>("slides");
		const els = doc.getMap<string>("els");
		const um = new Y.UndoManager([meta, order, slides, els], { trackedOrigins: new Set([LOCAL]), captureTimeout: 500 });
		const self = meRef.current;
		let provider: SupabaseYProvider | null = null;
		let alive = true;

		const read = () => {
			if (!alive) return;
			const ids = [...order.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
			if (!ids.length) { setDeck(null); return; }
			const byslide = new Map<string, El[]>();
			els.forEach((v, k) => {
				const sid = k.slice(0, k.indexOf("/"));
				try { const e = JSON.parse(v) as El; (byslide.get(sid) ?? byslide.set(sid, []).get(sid)!).push(e); } catch { /* skip a broken box */ }
			});
			let theme: Theme = THEMES[0];
			try { theme = { ...THEMES[0], ...(JSON.parse(meta.get("theme") ?? "{}") as Partial<Theme>) }; } catch { /* default theme */ }
			setDeck({
				v: 1,
				title: meta.get("title") ?? "Untitled presentation",
				theme,
				slides: ids.map((id): Slide => {
					let m: { bg?: string; notes?: string } = {};
					try { m = JSON.parse(slides.get(id) ?? "{}"); } catch { /* none */ }
					return { id, bg: m.bg, notes: m.notes ?? "", els: (byslide.get(id) ?? []).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)) };
				}),
			});
		};
		let raf = 0;
		const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; read(); }); };
		doc.on("update", soon);
		const hist = () => { setCanUndo(um.undoStack.length > 0); setCanRedo(um.redoStack.length > 0); };
		um.on("stack-item-added", hist); um.on("stack-item-popped", hist); um.on("stack-cleared", hist);

		const put = () => {
			const d = seedRef.current!;
			doc.transact(() => {
				meta.set("title", d.title);
				meta.set("theme", JSON.stringify(d.theme));
				d.slides.forEach((s, i) => {
					order.set(s.id, i);
					slides.set(s.id, JSON.stringify({ bg: s.bg, notes: s.notes ?? "" }));
					s.els.forEach((e, j) => els.set(`${s.id}/${e.id}`, JSON.stringify({ ...e, z: e.z ?? j })));
				});
			}, "seed");
			um.clear();
			setSynced(true);
		};

		if (roomId && self) {
			provider = new SupabaseYProvider(doc, createClient(), `mjengo-doc:deck-${roomId}`, `${self.id ?? "x"}:${Math.random().toString(36).slice(2, 8)}`);
			provider.awareness.setLocalStateField("user", { id: self.id, name: self.name, avatar: self.avatar ?? null, color: colorFor(self.id ?? self.name) });
			const onAware = () => {
				const list: DeckPerson[] = [];
				provider!.awareness.getStates().forEach((st, cid) => {
					if (cid === doc.clientID) return;
					const u = st.user as { id?: string; name?: string; avatar?: string | null; color?: string } | undefined;
					if (u) list.push({ key: String(cid), id: u.id, name: u.name ?? "Someone", avatar: u.avatar, color: u.color ?? "#0f766e", slide: st.slide ?? null, el: st.el ?? null });
				});
				setPeople(list);
			};
			provider.awareness.on("change", onAware);
			// Once connected: if nobody has the presentation yet, put the saved one in (every copy writes the same ids, so a tie is harmless).
			provider.on("synced", () => { if (order.size === 0) put(); else { setSynced(true); read(); } });
		} else {
			put();
		}
		ref.current = { doc, provider, um };
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ref.current = null;
			provider?.destroy();
			um.destroy();
			doc.destroy();
			setDeck(null); setPeople([]); setSynced(false);
		};
	}, [roomId, enabled]);

	const tx = useCallback((fn: (m: { meta: Y.Map<string>; order: Y.Map<number>; slides: Y.Map<string>; els: Y.Map<string> }) => void) => {
		const r = ref.current;
		if (!r) return;
		r.doc.transact(() => fn({ meta: r.doc.getMap("meta"), order: r.doc.getMap("order"), slides: r.doc.getMap("slides"), els: r.doc.getMap("els") }), LOCAL);
	}, []);

	const ops = useMemo(() => {
		const sortedIds = (order: Y.Map<number>) => [...order.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
		const maxZ = (els: Y.Map<string>, sid: string) => { let z = 0; els.forEach((v, k) => { if (k.startsWith(`${sid}/`)) { try { z = Math.max(z, (JSON.parse(v) as El).z ?? 0); } catch { /* skip */ } } }); return z; };
		return {
			setTitle: (t: string) => tx(({ meta }) => meta.set("title", t.slice(0, 120))),
			setTheme: (t: Theme) => tx(({ meta }) => meta.set("theme", JSON.stringify(t))),
			/** Add a slide after `afterId` (or at the end); returns its id. */
			addSlide: (s: Slide, afterId?: string | null): string => {
				tx(({ order, slides, els }) => {
					const ids = sortedIds(order);
					const i = afterId ? ids.indexOf(afterId) : ids.length - 1;
					const prev = i >= 0 ? order.get(ids[i])! : -1;
					const next = i + 1 < ids.length ? order.get(ids[i + 1])! : prev + 2;
					order.set(s.id, (prev + next) / 2);
					slides.set(s.id, JSON.stringify({ bg: s.bg, notes: s.notes ?? "" }));
					s.els.forEach((e, j) => els.set(`${s.id}/${e.id}`, JSON.stringify({ ...e, z: e.z ?? j })));
				});
				return s.id;
			},
			duplicateSlide: (id: string): string => {
				const nid = uid();
				tx(({ order, slides, els }) => {
					const ids = sortedIds(order);
					const i = ids.indexOf(id);
					const prev = order.get(id)!;
					const next = i + 1 < ids.length ? order.get(ids[i + 1])! : prev + 2;
					order.set(nid, (prev + next) / 2);
					slides.set(nid, slides.get(id) ?? "{}");
					els.forEach((v, k) => { if (k.startsWith(`${id}/`)) { const e = JSON.parse(v) as El; const ne = { ...e, id: uid() }; els.set(`${nid}/${ne.id}`, JSON.stringify(ne)); } });
				});
				return nid;
			},
			deleteSlide: (id: string) => tx(({ order, slides, els }) => {
				if (order.size <= 1) return;
				order.delete(id); slides.delete(id);
				[...els.keys()].forEach((k) => { if (k.startsWith(`${id}/`)) els.delete(k); });
			}),
			moveSlide: (id: string, toIndex: number) => tx(({ order }) => {
				const ids = sortedIds(order).filter((x) => x !== id);
				const i = Math.max(0, Math.min(toIndex, ids.length));
				const prev = i > 0 ? order.get(ids[i - 1])! : (order.get(ids[0]) ?? 1) - 2;
				const next = i < ids.length ? order.get(ids[i])! : prev + 2;
				order.set(id, (prev + next) / 2);
			}),
			setSlide: (id: string, patch: { bg?: string | null; notes?: string }) => tx(({ slides }) => {
				let cur: { bg?: string; notes?: string } = {};
				try { cur = JSON.parse(slides.get(id) ?? "{}"); } catch { /* none */ }
				const next = { ...cur, ...patch } as { bg?: string | null; notes?: string };
				if (next.bg === null) delete next.bg;
				slides.set(id, JSON.stringify(next));
			}),
			addEl: (sid: string, e: El) => tx(({ els }) => els.set(`${sid}/${e.id}`, JSON.stringify({ ...e, z: maxZ(els, sid) + 1 }))),
			updateEl: (sid: string, id: string, patch: Partial<El>) => tx(({ els }) => {
				const k = `${sid}/${id}`;
				const cur = els.get(k);
				if (!cur) return;
				els.set(k, JSON.stringify({ ...(JSON.parse(cur) as El), ...patch }));
			}),
			removeEl: (sid: string, id: string) => tx(({ els }) => els.delete(`${sid}/${id}`)),
			/** Move a box up or down the stack. */
			layer: (sid: string, id: string, dir: 1 | -1) => tx(({ els }) => {
				const k = `${sid}/${id}`;
				const cur = els.get(k);
				if (!cur) return;
				const e = JSON.parse(cur) as El;
				els.set(k, JSON.stringify({ ...e, z: dir > 0 ? maxZ(els, sid) + 1 : (e.z ?? 0) - 1.5 }));
			}),
			/** Replace everything (a template or a generated deck chosen from inside the editor). */
			replaceAll: (d: Deck) => tx(({ meta, order, slides, els }) => {
				[...order.keys()].forEach((k) => order.delete(k));
				[...slides.keys()].forEach((k) => slides.delete(k));
				[...els.keys()].forEach((k) => els.delete(k));
				meta.set("title", d.title); meta.set("theme", JSON.stringify(d.theme));
				d.slides.forEach((s, i) => {
					order.set(s.id, i);
					slides.set(s.id, JSON.stringify({ bg: s.bg, notes: s.notes ?? "" }));
					s.els.forEach((e, j) => els.set(`${s.id}/${e.id}`, JSON.stringify({ ...e, z: e.z ?? j })));
				});
			}),
		};
	}, [tx]);

	const select = useCallback((slide: string | null, el: string | null) => {
		const a = ref.current?.provider?.awareness;
		if (!a) return;
		a.setLocalStateField("slide", slide);
		a.setLocalStateField("el", el);
	}, []);

	return { deck, people, synced, ops, select, canUndo, canRedo, undo: () => ref.current?.um.undo(), redo: () => ref.current?.um.redo() };
}
