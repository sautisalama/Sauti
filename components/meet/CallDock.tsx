"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, PhoneOff } from "lucide-react";
import { callStore, useActiveCall } from "@/lib/client/call-store";
import { MeetRoom } from "@/components/meet/MeetRoom";
import { cn } from "@/lib/utils";

/**
 * Hosts the live MeetRoom in the dashboard shell. Picture-in-picture minimises that same room into a
 * floating panel so people can move around Sauti Salama / Mjengo without dropping the WebRTC session.
 */
export function CallDock() {
	const call = useActiveCall();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();

	// Remember the last non-meet page so PiP can send people back there.
	useEffect(() => {
		if (!pathname) return;
		const q = searchParams?.toString();
		const path = q ? `${pathname}?${q}` : pathname;
		callStore.rememberReturn(path);
	}, [pathname, searchParams]);

	// Soft-minimise if someone navigates away from the meet route without using PiP (e.g. browser back).
	useEffect(() => {
		if (!call) return;
		const onMeet = pathname === `/meet/${call.code}`;
		if (!onMeet && !call.minimized) {
			if (call.live) callStore.minimize(true);
			else callStore.close();
		}
	}, [pathname, call]);

	if (!call) return null;

	const onMeet = pathname === `/meet/${call.code}`;
	const floating = call.minimized || !onMeet;

	const expand = () => {
		callStore.minimize(false);
		if (!onMeet) router.push(`/meet/${call.code}`);
	};

	return (
		<div
			className={cn(
				"overflow-hidden bg-[#0E1318] shadow-2xl transition-[width,height,border-radius] duration-200",
				floating && call.pip
					? "fixed bottom-20 right-4 z-[60] h-12 w-[min(80vw,260px)] rounded-full border border-black/10 lg:bottom-4"
					: floating
						? "fixed bottom-20 right-4 z-[60] h-[190px] w-[min(70vw,300px)] rounded-2xl border border-black/10 lg:bottom-4"
						: "fixed inset-0 z-[100]",
			)}
		>
			{/* Kept mounted while the call is in its own window, so nothing is dropped; only hidden. */}
			<div className={cn("h-full w-full", floating && call.pip && "hidden")}>
			<MeetRoom
				key={call.code}
				code={call.code}
				mode={call.mode}
				title={call.title}
				description={call.description ?? ""}
				resources={call.resources ?? []}
				defaultName={call.defaultName}
				canSave={call.canSave}
				userId={call.userId ?? null}
				endsAt={call.endsAt ?? null}
				embedded={floating}
				inSuite
				autoJoin={call.live}
				startMic={call.mic !== false}
				startCam={call.cam !== false}
			/>
			</div>
			{floating && call.pip && (
				<span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-white">Call is in its own window</span>
			)}
			{floating && (
				<div className="absolute right-1.5 top-1.5 z-[70] flex gap-1">
					<button
						type="button"
						onClick={expand}
						aria-label="Return to the full call"
						title="Return to the full call"
						className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
					>
						<Maximize2 className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => callStore.requestLeave()}
						aria-label="Leave the call"
						title="Leave the call"
						className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ea4335] text-white hover:bg-[#d93025]"
					>
						<PhoneOff className="h-4 w-4" />
					</button>
				</div>
			)}
		</div>
	);
}
