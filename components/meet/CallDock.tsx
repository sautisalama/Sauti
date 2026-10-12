"use client";

import { useEffect } from "react";
import { Maximize2, Minimize2, PhoneOff } from "lucide-react";
import { callStore, useActiveCall } from "@/lib/client/call-store";
import { cn } from "@/lib/utils";

/**
 * The call in a floating window, so people can keep working in any suite while it runs. It lives in the
 * dashboard layout, so moving between pages does not drop the call. "Picture in picture" in the call shrinks it
 * into a small always-visible video; the expand button brings the full call back.
 */
export function CallDock() {
	const call = useActiveCall();

	useEffect(() => {
		const onMsg = (e: MessageEvent) => {
			if (e.origin !== window.location.origin) return;
			const t = (e.data as { type?: string } | null)?.type;
			if (t === "meet:minimize") callStore.minimize(true);
			else if (t === "meet:left") callStore.close();
			else if (t === "meet:popout") {
				const c = callStore.get();
				if (c) window.open(`/meet/${c.code}`, "_blank", "noopener");
				callStore.close();
			}
		};
		window.addEventListener("message", onMsg);
		return () => window.removeEventListener("message", onMsg);
	}, []);

	if (!call) return null;
	const params = new URLSearchParams({ embed: "1", autojoin: "1", mic: call.mic === false ? "0" : "1", cam: call.cam === false ? "0" : "1" });
	return (
		<div className={cn("fixed bottom-20 right-4 z-[60] overflow-hidden rounded-2xl border border-black/10 bg-[#191919] shadow-2xl transition-[width,height] duration-200 lg:bottom-4", call.minimized ? "h-[190px] w-[min(70vw,300px)]" : "h-[460px] w-[min(94vw,420px)]")}>
			{/* The frame stays mounted, so the call keeps running while it changes size. */}
			<iframe
				key={call.code}
				title="Call"
				src={`/meet/${call.code}?${params.toString()}`}
				allow="camera; microphone; display-capture; autoplay; picture-in-picture; clipboard-write"
				className="h-full w-full border-0"
			/>
			{call.minimized && (
				<div className="absolute right-1.5 top-1.5 flex gap-1">
					<button onClick={() => callStore.minimize(false)} aria-label="Show the full call" title="Show the full call" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"><Maximize2 className="h-4 w-4" /></button>
					<button onClick={() => callStore.close()} aria-label="Leave the call" title="Leave the call" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ea4335] text-white hover:bg-[#d93025]"><PhoneOff className="h-4 w-4" /></button>
				</div>
			)}
			{!call.minimized && (
				<button onClick={() => callStore.minimize(true)} aria-label="Make the call small" title="Make the call small" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 md:hidden"><Minimize2 className="h-4 w-4" /></button>
			)}
		</div>
	);
}
