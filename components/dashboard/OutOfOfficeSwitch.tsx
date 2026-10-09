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

	if (away === null || away) return null;

	const change = async (next: boolean) => {
		setBusy(true);
		setAway(next);
		try {
			await toggleOutOfOffice(next);
			toast({ title: "You are out of office", description: "You will not be matched to new cases or bookings until you turn it off." });
		} catch {
			setAway(!next);
			toast({ title: "Could not update", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex items-center justify-between gap-3 rounded-2xl border border-serene-neutral-100 bg-white px-4 py-3">
			<div className="flex items-center gap-3">
				<Moon className="h-4 w-4 text-amber-600" />
				<div>
					<p className="text-sm font-semibold text-serene-neutral-900">Taking new cases</p>
					<p className="text-xs text-serene-neutral-500">Switch off to pause new matches and bookings</p>
				</div>
			</div>
			<Switch checked={!away} disabled={busy} onCheckedChange={(on) => change(!on)} aria-label="Taking new cases" />
		</div>
	);
}
