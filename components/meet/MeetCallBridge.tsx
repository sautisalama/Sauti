"use client";

import { useLayoutEffect } from "react";
import { callStore, useActiveCall } from "@/lib/client/call-store";

type Props = {
	code: string;
	mode: "video" | "voice";
	title: string | null;
	description?: string;
	resources?: { label: string; url: string }[];
	defaultName: string;
	canSave: boolean;
	userId?: string | null;
	endsAt?: string | null;
	startMic?: boolean;
	startCam?: boolean;
};

/**
 * Registers this meet in the dashboard CallDock (one live MeetRoom) and expands it when the person
 * returns to the meet URL. Guests never use this — they render MeetRoom on the page itself.
 */
export function MeetCallBridge(props: Props) {
	const call = useActiveCall();

	useLayoutEffect(() => {
		const cur = callStore.get();
		if (cur?.live && cur.code !== props.code) return;
		callStore.open(props.code, props.mode, {
			minimized: false,
			live: cur?.code === props.code ? cur.live : false,
			mic: props.startMic,
			cam: props.startCam,
			title: props.title,
			description: props.description,
			resources: props.resources,
			defaultName: props.defaultName,
			canSave: props.canSave,
			userId: props.userId,
			endsAt: props.endsAt,
		});
	}, [
		props.code,
		props.mode,
		props.title,
		props.description,
		props.resources,
		props.defaultName,
		props.canSave,
		props.userId,
		props.endsAt,
		props.startMic,
		props.startCam,
	]);

	if (call?.live && call.code !== props.code) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center text-[#202124]">
				<p className="text-lg font-medium">You already have a call open</p>
				<p className="max-w-sm text-sm text-[#5f6368]">
					Expand it from the corner, or leave that call before opening this one.
				</p>
				<button
					type="button"
					onClick={() => {
						callStore.minimize(false);
						window.location.assign(`/meet/${call.code}`);
					}}
					className="mt-2 rounded-full bg-[#068297] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#056d7e]"
				>
					Return to your call
				</button>
			</main>
		);
	}

	if (!call || call.code !== props.code) {
		return (
			<main className="flex min-h-dvh items-center justify-center bg-white text-sm text-[#5f6368]">
				Opening the call…
			</main>
		);
	}

	// CallDock owns MeetRoom for suite users.
	return null;
}
