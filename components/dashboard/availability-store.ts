"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";
import { toggleOutOfOffice } from "@/app/actions/availability";

/**
 * Whether the signed-in provider is taking new cases, held once for every place that shows it (the
 * overview card, the account menu, calendar settings). They all read and write this one value, so they
 * can never disagree, and it is seeded from the profile the dashboard already loaded, so nothing pops in.
 */
let owner: string | null = null;
let away: boolean | null = null;
let inflight = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
	listeners.add(l);
	return () => listeners.delete(l);
};

let channelFor: string | null = null;
let channelCleanup: (() => void) | null = null;
let subscribers = 0;

function watch(userId: string) {
	if (channelFor === userId) return;
	channelCleanup?.();
	const supabase = createClient();
	supabase
		.from("profiles")
		.select("out_of_office")
		.eq("id", userId)
		.maybeSingle()
		.then(({ data }) => {
			if (owner === userId && data) {
				away = !!data.out_of_office;
				emit();
			}
		});
	const channel = supabase
		.channel(`availability-${userId}`)
		.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (p) => {
			away = !!(p.new as { out_of_office?: boolean }).out_of_office;
			emit();
		})
		.subscribe();
	channelFor = userId;
	channelCleanup = () => {
		supabase.removeChannel(channel);
		channelFor = null;
		channelCleanup = null;
	};
}

export type Availability = {
	/** True while paused. Null only until the first answer, which is normally already known. */
	away: boolean | null;
	/** The friendlier way round: true when taking new cases. */
	taking: boolean | null;
	setTaking: (taking: boolean) => Promise<boolean>;
	busy: boolean;
};

/** `initial` is the profile's out_of_office as the dashboard already knows it. */
export function useAvailability(userId: string | null | undefined, initial?: boolean | null): Availability {
	if (userId && owner !== userId) {
		owner = userId;
		away = initial ?? null;
	} else if (userId && away === null && initial != null) {
		away = initial;
	}

	const value = useSyncExternalStore(subscribe, () => away, () => initial ?? null);
	const busy = useSyncExternalStore(subscribe, () => inflight, () => false);

	useEffect(() => {
		if (!userId) return;
		subscribers++;
		watch(userId);
		return () => {
			if (--subscribers === 0) channelCleanup?.();
		};
	}, [userId]);

	const setTaking = useCallback(async (taking: boolean) => {
		const previous = away;
		away = !taking;
		inflight = true;
		emit();
		try {
			await toggleOutOfOffice(!taking);
			return true;
		} catch {
			away = previous;
			return false;
		} finally {
			inflight = false;
			emit();
		}
	}, []);

	return { away: value, taking: value === null ? null : !value, setTaking, busy };
}
