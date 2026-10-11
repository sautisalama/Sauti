"use client";

import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const b64 = {
	enc: (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); },
	dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

type Listener = (...args: unknown[]) => void;

/**
 * A Yjs provider that carries a document over a Supabase Realtime broadcast channel, so co-editing needs
 * no server of its own. Peers answer a newcomer's state vector with the missing updates; after that every
 * change is broadcast. Presence (cursors, names) rides along as awareness updates.
 */
export class SupabaseYProvider {
	readonly awareness: Awareness;
	synced = false;
	private channel: RealtimeChannel;
	private listeners = new Map<string, Set<Listener>>();
	private destroyed = false;
	private origin = Symbol("supabase-yjs");

	constructor(private doc: Y.Doc, supabase: SupabaseClient, topic: string, private clientKey: string) {
		this.awareness = new Awareness(doc);
		this.channel = supabase.channel(topic, { config: { private: true, broadcast: { self: false, ack: false } } });

		this.channel
			.on("broadcast", { event: "sync-request" }, ({ payload }) => {
				if (payload.from === this.clientKey) return;
				const diff = Y.encodeStateAsUpdate(this.doc, b64.dec(payload.sv));
				this.send("sync-reply", { to: payload.from, from: this.clientKey, update: b64.enc(diff), sv: b64.enc(Y.encodeStateVector(this.doc)) });
			})
			.on("broadcast", { event: "sync-reply" }, ({ payload }) => {
				if (payload.to !== this.clientKey) return;
				Y.applyUpdate(this.doc, b64.dec(payload.update), this.origin);
				// They may be missing things we have: send what their vector lacks.
				this.send("update", { from: this.clientKey, update: b64.enc(Y.encodeStateAsUpdate(this.doc, b64.dec(payload.sv))) });
				this.markSynced();
			})
			.on("broadcast", { event: "update" }, ({ payload }) => {
				if (payload.from === this.clientKey) return;
				Y.applyUpdate(this.doc, b64.dec(payload.update), this.origin);
			})
			.on("broadcast", { event: "awareness" }, ({ payload }) => {
				if (payload.from === this.clientKey) return;
				applyAwarenessUpdate(this.awareness, b64.dec(payload.update), this.origin);
			})
			.subscribe((status) => {
				if (status !== "SUBSCRIBED" || this.destroyed) return;
				this.send("sync-request", { from: this.clientKey, sv: b64.enc(Y.encodeStateVector(this.doc)) });
				this.send("awareness", { from: this.clientKey, update: b64.enc(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) });
				// Alone in the document: nobody answers, so treat the local state as the shared one.
				setTimeout(() => this.markSynced(), 1500);
			});

		doc.on("update", this.onDocUpdate);
		this.awareness.on("update", this.onAwareness);
	}

	private onDocUpdate = (update: Uint8Array, origin: unknown) => {
		if (origin === this.origin || this.destroyed) return;
		this.send("update", { from: this.clientKey, update: b64.enc(update) });
	};

	private onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
		if (origin === this.origin || this.destroyed) return;
		this.send("awareness", { from: this.clientKey, update: b64.enc(encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed])) });
	};

	private send(event: string, payload: Record<string, unknown>) {
		this.channel.send({ type: "broadcast", event, payload }).catch(() => undefined);
	}

	private markSynced() {
		if (this.synced) return;
		this.synced = true;
		this.listeners.get("sync")?.forEach((cb) => cb(true));
		this.listeners.get("synced")?.forEach((cb) => cb(true));
	}

	on(event: string, cb: Listener) {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(cb);
	}

	off(event: string, cb: Listener) {
		this.listeners.get(event)?.delete(cb);
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.doc.off("update", this.onDocUpdate);
		this.awareness.off("update", this.onAwareness);
		removeAwarenessStates(this.awareness, [this.doc.clientID], this.origin);
		this.awareness.destroy();
		this.channel.unsubscribe();
	}
}
