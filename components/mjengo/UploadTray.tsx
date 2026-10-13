"use client";

import { Check, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trayDismiss, useTray } from "@/lib/client/upload-tray";

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Everything being uploaded, with a real percentage, bottom right. Calm, small and out of the way. */
export function UploadTray() {
	const items = useTray();
	if (!items.length) return null;
	return (
		<div role="status" aria-live="polite" className="fixed bottom-20 left-3 z-[70] w-[min(92vw,320px)] space-y-2 lg:bottom-4">
			{items.slice(-4).map((u) => (
				<div key={u.id} className="rounded-2xl border border-black/10 bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
					<div className="flex items-center gap-2.5">
						<span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", u.state === "error" ? "bg-red-50 text-red-600" : u.state === "done" ? "bg-emerald-50 text-emerald-600" : "bg-sauti-teal-light text-sauti-teal")}>
							{u.state === "done" ? <Check className="h-4 w-4" /> : u.state === "error" ? <X className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-[#37352f]">{u.name}</p>
							<p className={cn("text-xs", u.state === "error" ? "text-red-600" : "text-[#787774]")}>
								{u.state === "error" ? u.error : u.state === "done" ? "Added" : `${u.pct}% of ${size(u.size)}`}
							</p>
						</div>
						{u.state === "error" && <button onClick={() => trayDismiss(u.id)} aria-label="Dismiss" className="rounded-full p-1 text-[#787774] hover:bg-black/5"><X className="h-4 w-4" /></button>}
					</div>
					{u.state === "uploading" && (
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]" role="progressbar" aria-valuenow={u.pct} aria-valuemin={0} aria-valuemax={100}>
							<div className="h-full rounded-full bg-sauti-teal transition-[width] duration-150" style={{ width: `${u.pct}%` }} />
						</div>
					)}
				</div>
			))}
		</div>
	);
}
