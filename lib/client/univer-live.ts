"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { colorFor, type LivePerson } from "@/lib/client/excalidraw-live";

/** The slice of Univer's facade that live editing needs. */
interface SheetApi {
	addEvent: (name: string, cb: (e: { id: string; type?: number; params: object; options?: Record<string, unknown> }) => void) => { dispose: () => void };
	Event: { CommandExecuted: string; SelectionChanged: string };
	syncExecuteCommand: (id: string, params?: object, options?: Record<string, unknown>) => unknown;
	getActiveWorkbook: () => { save: () => unknown; getId: () => string; getActiveSheet: () => { getSheetName: () => string } } | null;
	disposeUnit: (id: string) => boolean;
	createWorkbook: (snap: object) => unknown;
}

const MUTATION = 2;
/** Changes to the data are shared; where someone is looking (active tab, scroll, selection) stays their own. */
const SHARED = /^sheet\.mutation\./;
const OWN = /(set-worksheet-active|set-selections|set-scroll|set-zoom|set-frozen|set-worksheet-hide-gridlines|set-tab-color)/;

type Msg =
	| { t: "op"; from: string; id: string; params: object }
	| { t: "hello"; from: string; user: PersonInfo }
	| { t: "state"; from: string; to: string; snapshot: object }
	| { t: "here"; from: string; user: PersonInfo; at: string | null };
interface PersonInfo { id?: string; name: string; avatar?: string | null; color: string }

/**
 * Edit a spreadsheet together. Every change to the cells is a small operation that is sent to the others and replayed
 * on their copy (the same operations Univer's own collaboration server would carry), so edits show up as they are made.
 * Someone who joins after changes were made gets the current sheet from whoever is already there. Who is here, and
 * which cell each person is on, shows in the header. Rides on the private "mjengo-doc:" broadcast channels.
 */
export function useLiveSheet({ roomId, api, me, ready }: { roomId: string | null; api: SheetApi | null; me: { id?: string; name: string; avatar?: string | null } | null; ready: boolean }) {
	const [people, setPeople] = useState<(LivePerson & { at: string | null })[]>([]);
	const sendRef = useRef<((m: Msg) => void) | null>(null);
	const meRef = useRef(me);
	meRef.current = me;

	useEffect(() => {
		if (!roomId || !api || !ready || !meRef.current) return;
		const self = meRef.current;
		const key = `${self.id ?? "x"}:${Math.random().toString(36).slice(2, 8)}`;
		const info: PersonInfo = { id: self.id, name: self.name, avatar: self.avatar ?? null, color: colorFor(self.id ?? self.name) };
		const supabase = createClient();
		const channel = supabase.channel(`mjengo-doc:sheet-${roomId}`, { config: { private: true, broadcast: { self: false, ack: false } } });
		let touched = false; // this copy has had changes of its own
		let dirty = false; // this copy has had changes since it was opened
		let gotState = false;
		let stopped = false;
		let myCell: string | null = null;
		const seen = new Map<string, { user: PersonInfo; at: string | null; last: number }>();

		const send = (m: Msg) => { if (!stopped) channel.send({ type: "broadcast", event: "m", payload: m }).catch(() => undefined); };
		sendRef.current = send;

		const publish = () => {
			const now = Date.now();
			for (const [k, v] of seen) if (now - v.last > 15_000) seen.delete(k);
			setPeople([...seen.entries()].map(([k, v]) => ({ key: k, id: v.user.id, name: v.user.name, avatar: v.user.avatar, color: v.user.color, at: v.at })));
		};

		channel
			.on("broadcast", { event: "m" }, ({ payload }) => {
				const m = payload as Msg;
				if (!m || m.from === key) return;
				if (m.t === "op") {
					try { api.syncExecuteCommand(m.id, m.params, { fromCollab: true, onlyLocal: true }); dirty = true; } catch { /* an operation that does not fit this copy is skipped */ }
				} else if (m.t === "hello") {
					seen.set(m.from, { user: m.user, at: null, last: Date.now() });
					publish();
					// Whoever has made changes hands the newcomer the current sheet.
					const wb = api.getActiveWorkbook();
					if (wb && dirty) send({ t: "state", from: key, to: m.from, snapshot: wb.save() as object });
					send({ t: "here", from: key, user: info, at: myCell });
				} else if (m.t === "state") {
					if (m.to !== key || gotState || touched) return;
					gotState = true;
					const wb = api.getActiveWorkbook();
					if (!wb) return;
					const id = wb.getId();
					api.disposeUnit(id);
					api.createWorkbook({ ...(m.snapshot as object), id });
				} else if (m.t === "here") {
					seen.set(m.from, { user: m.user, at: m.at, last: Date.now() });
					publish();
				}
			})
			.subscribe((status) => {
				if (status === "SUBSCRIBED") { send({ t: "hello", from: key, user: info }); send({ t: "here", from: key, user: info, at: myCell }); }
			});

		const op = api.addEvent(api.Event.CommandExecuted, (e) => {
			if (e.type !== MUTATION || !SHARED.test(e.id) || OWN.test(e.id)) return;
			if (e.options?.fromCollab || e.options?.onlyLocal || e.options?.fromChangeset) return;
			touched = true; dirty = true;
			send({ t: "op", from: key, id: e.id, params: e.params });
		});
		const sel = api.addEvent(api.Event.SelectionChanged, (e) => {
			const r = (e as unknown as { selections?: { startRow: number; startColumn: number }[] }).selections?.[0];
			if (!r) return;
			const col = (n: number) => { let s = ""; for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
			myCell = `${col(r.startColumn)}${r.startRow + 1}`;
		});
		const beat = setInterval(() => { send({ t: "here", from: key, user: info, at: myCell }); publish(); }, 5_000);

		return () => {
			stopped = true;
			sendRef.current = null;
			clearInterval(beat);
			op.dispose();
			sel.dispose();
			supabase.removeChannel(channel);
			setPeople([]);
		};
	}, [roomId, api, ready]);

	/** Whether anyone else is here, for the "live" label. */
	const live = useCallback(() => people.length > 0, [people]);
	return { people, live };
}
