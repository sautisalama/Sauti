"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { FormSettings, Question } from "@/lib/forms/schema";

export interface FormState { title: string; description: string; questions: Question[]; settings: FormSettings }
export interface Peer { id: string; name: string }

interface Patch {
	from: string;
	title?: string;
	description?: string;
	settings?: FormSettings;
	/** Questions that changed or are new, by id. */
	q?: Record<string, Question>;
	/** The order of every question after the change. */
	order?: string[];
	/** Everyone in the room right now, sent with each patch is not needed: presence covers it. */
}

/**
 * Live editing of one form between people. Edits travel as small patches over a Supabase realtime channel:
 * a changed question replaces only that question, so two people working on different questions never
 * overwrite each other. The last change to the same question wins. The channel also tracks who is here.
 */
export function useFormLive(opts: { formId: string; me: Peer | null; ready: boolean; state: FormState; apply: (p: Partial<FormState>) => void }) {
	const { formId, me, ready, state, apply } = opts;
	const [peers, setPeers] = useState<Peer[]>([]);
	const chan = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
	const last = useRef<FormState>(state);
	const remote = useRef(false);
	const applyRef = useRef(apply);
	applyRef.current = apply;
	const stateRef = useRef(state);
	stateRef.current = state;

	useEffect(() => {
		if (!ready || !me) return;
		const sb = createClient();
		const ch = sb.channel(`mjengo-form:${formId}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });
		chan.current = ch;
		last.current = stateRef.current;
		ch.on("broadcast", { event: "patch" }, ({ payload }) => {
			const p = payload as Patch;
			if (p.from === me.id) return;
			remote.current = true;
			const cur = stateRef.current;
			const next: Partial<FormState> = {};
			if (p.title !== undefined) next.title = p.title;
			if (p.description !== undefined) next.description = p.description;
			if (p.settings !== undefined) next.settings = p.settings;
			if (p.q || p.order) {
				const byId = new Map(cur.questions.map((q) => [q.id, q] as const));
				for (const [id, q] of Object.entries(p.q ?? {})) byId.set(id, q);
				const order = p.order ?? cur.questions.map((q) => q.id);
				next.questions = order.map((id) => byId.get(id)).filter(Boolean) as Question[];
			}
			// What arrived is now the baseline, so it is not sent back out.
			last.current = { ...cur, ...next } as FormState;
			applyRef.current(next);
			setTimeout(() => { remote.current = false; }, 50);
		});
		ch.on("presence", { event: "sync" }, () => {
			const st = ch.presenceState() as Record<string, { name?: string }[]>;
			setPeers(Object.entries(st).map(([id, v]) => ({ id, name: v[0]?.name ?? "Someone" })));
		});
		ch.subscribe(async (status) => {
			if (status === "SUBSCRIBED") await ch.track({ name: me.name });
		});
		return () => { sb.removeChannel(ch); chan.current = null; };
	}, [formId, ready, me?.id, me?.name]); // eslint-disable-line react-hooks/exhaustive-deps

	// Send what changed, shortly after the last keystroke.
	useEffect(() => {
		if (!ready || !me || !chan.current || remote.current) return;
		const t = setTimeout(() => {
			const prev = last.current;
			const p: Patch = { from: me.id };
			if (state.title !== prev.title) p.title = state.title;
			if (state.description !== prev.description) p.description = state.description;
			if (JSON.stringify(state.settings) !== JSON.stringify(prev.settings)) p.settings = state.settings;
			const before = new Map(prev.questions.map((q) => [q.id, JSON.stringify(q)] as const));
			const changed: Record<string, Question> = {};
			for (const q of state.questions) if (before.get(q.id) !== JSON.stringify(q)) changed[q.id] = q;
			if (Object.keys(changed).length) p.q = changed;
			if (state.questions.map((q) => q.id).join() !== prev.questions.map((q) => q.id).join()) p.order = state.questions.map((q) => q.id);
			if (Object.keys(p).length > 1) {
				chan.current?.send({ type: "broadcast", event: "patch", payload: p }).catch(() => undefined);
				last.current = state;
			}
		}, 350);
		return () => clearTimeout(t);
	}, [state.title, state.description, state.questions, state.settings, ready, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	return { peers };
}
