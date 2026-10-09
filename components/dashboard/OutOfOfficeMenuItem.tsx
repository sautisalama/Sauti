"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { toggleOutOfOffice } from "@/app/actions/availability";
import { useToast } from "@/hooks/use-toast";

/** One-tap "Out of office" switch for the account menu: while on, no new cases or bookings are offered. */
export function OutOfOfficeMenuItem({ userId }: { userId: string }) {
	const [away, setAway] = useState(false);
	const [busy, setBusy] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		createClient()
			.from("profiles")
			.select("out_of_office")
			.eq("id", userId)
			.maybeSingle()
			.then(({ data }) => setAway(!!data?.out_of_office));
	}, [userId]);

	const change = async (next: boolean) => {
		setBusy(true);
		setAway(next);
		try {
			await toggleOutOfOffice(next);
			toast({
				title: next ? "You are out of office" : "You are back in office",
				description: next ? "You will not be matched to new cases or bookings." : "You can be matched to new cases again.",
			});
		} catch {
			setAway(!next);
			toast({ title: "Could not update", description: "Please try again.", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		// preventDefault keeps the menu open so the switch visibly flips.
		<DropdownMenuItem
			onSelect={(e) => {
				e.preventDefault();
				if (!busy) change(!away);
			}}
			className="flex cursor-pointer items-center gap-3 rounded-xl p-3"
		>
			<Moon className="h-4 w-4 text-amber-600" />
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium leading-none">Out of office</p>
				<p className="mt-1 text-[11px] leading-tight text-serene-neutral-500">{away ? "Not receiving matches" : "Pause new matches"}</p>
			</div>
			<Switch checked={away} disabled={busy} aria-label="Out of office" tabIndex={-1} className="pointer-events-none" />
		</DropdownMenuItem>
	);
}
