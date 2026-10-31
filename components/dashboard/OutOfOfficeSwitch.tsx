"use client";

import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { useAvailability } from "./availability-store";

/**
 * The one place a provider sees and changes whether they are taking new cases. It shows the state, what
 * it means for them, and (when paused) a single clear way back. Switch on always means "taking cases".
 */
export function OutOfOfficeSwitch({ userId }: { userId: string }) {
	const dash = useDashboardData();
	const { taking, setTaking, busy } = useAvailability(userId, (dash?.data?.profile as { out_of_office?: boolean | null } | undefined)?.out_of_office ?? null);
	const { toast } = useToast();

	if (taking === null) return <div className="h-[68px] rounded-2xl bg-serene-neutral-100/70" aria-hidden />;

	const change = async (next: boolean) => {
		const ok = await setTaking(next);
		if (!ok) return toast({ title: "Could not update", description: "Nothing changed. Please try again.", variant: "destructive" });
		toast(
			next
				? { title: "You're taking new cases again", description: "Matching and bookings have resumed." }
				: { title: "New cases are paused", description: "You won't be offered new cases or bookings. Your current cases stay as they are." }
		);
	};

	return (
		<section
			aria-label="Availability"
			className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${taking ? "border-serene-neutral-100 bg-white" : "border-amber-200 bg-amber-50"}`}
		>
			<div className="flex min-w-0 items-center gap-3">
				{taking ? <Sun className="h-5 w-5 shrink-0 text-teal-600" aria-hidden /> : <Moon className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />}
				<div className="min-w-0">
					<p className="text-sm font-semibold text-serene-neutral-900">{taking ? "Taking new cases" : "Not taking new cases"}</p>
					<p className="text-sm text-serene-neutral-600">
						{taking ? "Turn off to pause new matches and bookings." : "You won't be offered new cases or bookings. Turn on when you're back."}
					</p>
				</div>
			</div>
			<Switch className="shrink-0" checked={taking} disabled={busy} onCheckedChange={change} aria-label="Taking new cases" />
		</section>
	);
}
