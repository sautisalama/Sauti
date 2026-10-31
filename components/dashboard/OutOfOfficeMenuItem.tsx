"use client";

import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { useAvailability } from "./availability-store";

/** The same setting as the overview card, one tap from the account menu. On means taking new cases. */
export function OutOfOfficeMenuItem({ userId }: { userId: string }) {
	const dash = useDashboardData();
	const { taking, setTaking, busy } = useAvailability(userId, (dash?.data?.profile as { out_of_office?: boolean | null } | undefined)?.out_of_office ?? null);
	const { toast } = useToast();
	if (taking === null) return null;

	const change = async (next: boolean) => {
		const ok = await setTaking(next);
		toast(
			!ok
				? { title: "Could not update", description: "Nothing changed. Please try again.", variant: "destructive" }
				: next
					? { title: "You're taking new cases again", description: "Matching and bookings have resumed." }
					: { title: "New cases are paused", description: "You won't be offered new cases or bookings." }
		);
	};

	return (
		// preventDefault keeps the menu open so the switch visibly flips.
		<DropdownMenuItem
			onSelect={(e) => {
				e.preventDefault();
				if (!busy) change(!taking);
			}}
			className="flex cursor-pointer items-center gap-3 rounded-xl p-3"
		>
			{taking ? <Sun className="h-4 w-4 text-teal-600" aria-hidden /> : <Moon className="h-4 w-4 text-amber-700" aria-hidden />}
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium leading-none">Taking new cases</p>
				<p className="mt-1 text-xs leading-tight text-serene-neutral-600">{taking ? "On: you can be matched" : "Off: matches paused"}</p>
			</div>
			<Switch checked={taking} disabled={busy} aria-label="Taking new cases" tabIndex={-1} className="pointer-events-none" />
		</DropdownMenuItem>
	);
}
