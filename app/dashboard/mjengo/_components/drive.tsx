"use client";

import { useEffect } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

/** Link that starts "Save to Google Drive" for a vault file or an uploaded entity document. */
export const driveHref = (kind: "vault" | "entity", id: string) =>
	`/api/mjengo/drive/google/start?kind=${kind}&id=${encodeURIComponent(id)}&return=${encodeURIComponent(typeof window === "undefined" ? "/dashboard/mjengo/vault" : window.location.pathname)}`;

/** Navigate to Google (a full page load: the sign-in happens there and returns here). */
export const saveToDrive = (kind: "vault" | "entity", id: string) => {
	window.location.href = driveHref(kind, id);
};

/** Tell the person how "Save to Google Drive" went once they are sent back. Mount once per page. */
export function DriveResult() {
	const { toast } = useToast();
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		const ok = p.get("drive");
		const err = p.get("drive_error");
		if (!ok && !err) return;
		if (ok) {
			const link = p.get("link");
			toast({
				title: "Saved to Google Drive",
				description: `${p.get("name") ?? "The file"} is in your “Sauti Salama” folder.`,
				action: link && /^https:\/\/(drive|docs)\.google\.com\//.test(link)
					? <ToastAction altText="Open in Google Drive" onClick={() => window.open(link, "_blank", "noopener")}>Open</ToastAction>
					: undefined,
			});
		} else {
			toast({ title: "Could not save to Google Drive", description: err ?? undefined, variant: "destructive" });
		}
		["drive", "drive_error", "name", "link"].forEach((k) => p.delete(k));
		const rest = p.toString();
		window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return null;
}
