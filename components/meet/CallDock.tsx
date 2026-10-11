"use client";

import { useEffect } from "react";
import { Maximize2, PhoneOff, Video } from "lucide-react";
import { callStore, useActiveCall } from "@/lib/client/call-store";
import { cn } from "@/lib/utils";

/**
 * The call in a floating window, so people can keep working on the platform while it runs. It lives in the
 * dashboard layout, so moving between pages does not drop the call.
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
	return (
		<>
			{call.minimized && (
				<div className="fixed bottom-20 right-4 z-[60] flex items-center gap-2 rounded-full border border-black/10 bg-white py-1.5 pl-3 pr-1.5 shadow-lg lg:bottom-4">
					<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
					<span className="text-sm font-medium text-[#37352f]">In a call</span>
					<button onClick={() => callStore.minimize(false)} aria-label="Show the call" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"><Maximize2 className="h-4 w-4" /></button>
					<button onClick={() => callStore.close()} aria-label="Leave the call" className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"><PhoneOff className="h-4 w-4" /></button>
				</div>
			)}
			{/* The frame stays mounted while minimised so the call keeps running. */}
			<div className={cn("fixed bottom-20 right-4 z-[60] overflow-hidden rounded-2xl border border-black/10 bg-[#191919] shadow-2xl lg:bottom-4", call.minimized ? "pointer-events-none h-px w-px opacity-0" : "h-[460px] w-[min(94vw,420px)]")}>
				<iframe
					key={call.code}
					title="Call"
					src={`/meet/${call.code}?embed=1`}
					allow="camera; microphone; display-capture; autoplay; picture-in-picture; clipboard-write"
					className="h-full w-full border-0"
				/>
			</div>
			<span className="sr-only"><Video /></span>
		</>
	);
}
