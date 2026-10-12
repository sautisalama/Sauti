"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { toggleOutOfOffice } from "@/app/actions/availability";
import { useToast } from "@/hooks/use-toast";

/**
 * One-tap "pause new cases" for any provider, whether or not they have listed services: matching skips
 * the person themselves, not just their services. (When it is on, the banner above takes over.)
 */
export function OutOfOfficeSwitch({ userId }: { userId: string }) {
	const [away, setAway] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		const supabase = createClient();
		supabase.from("profiles").select("out_of_office").eq("id", userId).maybeSingle().then(({ data }) => setAway(!!data?.out_of_office));
		const channel = supabase
			.channel(`ooo-switch-${userId}-${Math.random().toString(36).slice(2)}`)
			.on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (p) => setAway(!!(p.new as { out_of_office?: boolean }).out_of_office))
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId]);

	if (away === null) return null;

	const change = async (next: boolean) => {
		setBusy(true);
		setAway(next);
		try {
			await toggleOutOfOffice(next);
			toast(next ? { title: "You are out of office", description: "You will not be matched to new cases or bookings until you turn it back on." } : { title: "You are taking new cases again", description: "Matching and bookings have resumed." });
		} catch {
			setAway(!next);
			toast({ title: "Could not update", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${away ? "border-amber-200 bg-amber-50" : "border-serene-neutral-100 bg-white"}`}>
			<div className="flex min-w-0 items-center gap-3">
				<Moon className="h-4 w-4 shrink-0 text-amber-600" />
				<div className="min-w-0">
					<p className="text-sm font-semibold text-serene-neutral-900">{away ? "Paused: not taking new cases" : "Taking new cases"}</p>
					<p className="text-xs text-serene-neutral-500">{away ? "Switch on to resume matches and bookings" : "Switch off to pause new matches and bookings"}</p>
				</div>
			</div>
			<Switch className="shrink-0" checked={!away} disabled={busy} onCheckedChange={(on) => change(!on)} aria-label="Taking new cases" />
		</div>
	);
}
