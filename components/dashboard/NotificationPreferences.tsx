"use client";

import { useState } from "react";
import { Bell, Lock, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { NOTIFICATION_CATEGORIES, type NotificationCategoryId } from "@/lib/notifications/catalog";
import { prefsFromSettings, type Channel, type NotificationPrefs } from "@/lib/notifications/prefs";

/** What we send you, and a switch for each kind over email and over push. */
export function NotificationPreferences() {
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const { toast } = useToast();
	const [saving, setSaving] = useState(false);

	const prefs = prefsFromSettings(profile?.settings);
	const isProvider = profile?.user_type === "professional" || profile?.user_type === "ngo";
	const isAdmin = !!(profile as { is_admin?: boolean } | undefined)?.is_admin;
	const visible = NOTIFICATION_CATEGORIES.filter((c) => c.audience === "everyone" || (c.audience === "providers" && (isProvider || isAdmin)) || (c.audience === "admins" && isAdmin));

	const save = async (next: NotificationPrefs) => {
		if (!userId || !profile) return;
		setSaving(true);
		const settings = {
			...((profile.settings as Record<string, unknown>) ?? {}),
			email_notifications: next.email,
			push_notifications: next.push,
			notification_categories: next.categories,
		};
		try {
			const { error } = await createClient().from("profiles").update({ settings: settings as never }).eq("id", userId);
			if (error) throw error;
			dash?.updatePartial({ profile: { ...profile, settings: settings as never } });
		} catch {
			toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const setMaster = (channel: Channel, on: boolean) => save({ ...prefs, [channel]: on });
	const setCategory = (id: NotificationCategoryId, channel: Channel, on: boolean) =>
		save({ ...prefs, categories: { ...prefs.categories, [id]: { ...prefs.categories[id], [channel]: on } } });
	const everythingOff = !prefs.email && !prefs.push;
	const setAll = (on: boolean) => save({ ...prefs, email: on, push: on });

	const isOn = (id: NotificationCategoryId, channel: Channel) => prefs[channel] && prefs.categories[id]?.[channel] !== false;

	return (
		<Card className="border-neutral-200 shadow-sm">
			<CardHeader className="border-b border-neutral-100 pb-4">
				<div className="flex items-center gap-2">
					<Bell className="h-5 w-5 text-neutral-500" />
					<CardTitle className="text-base">Notifications</CardTitle>
				</div>
				<CardDescription className="mt-1">
					These are the notifications Sauti Salama sends you. Choose email, push (to this phone or computer), both, or neither for each. Everything is always kept in the bell inside the app.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				{/* Master switches */}
				<div className="grid gap-px bg-neutral-100 sm:grid-cols-2">
					<MasterRow icon={<Mail className="h-4 w-4" />} title="Email" hint="Messages to your inbox" checked={prefs.email} disabled={saving} onChange={(v) => setMaster("email", v)} />
					<MasterRow icon={<Smartphone className="h-4 w-4" />} title="Push" hint="Alerts on this device" checked={prefs.push} disabled={saving} onChange={(v) => setMaster("push", v)} />
				</div>
				<div className="flex items-center justify-between gap-3 border-y border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
					<p className="text-xs text-neutral-500">{everythingOff ? "You will only see updates in the app." : "Switch everything off or on at once."}</p>
					<Button size="sm" variant="outline" disabled={saving} onClick={() => setAll(everythingOff)}>
						{everythingOff ? "Turn everything on" : "Turn everything off"}
					</Button>
				</div>

				{/* Per kind */}
				<div className="hidden grid-cols-[1fr_64px_64px] gap-2 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 sm:grid">
					<span>What we send</span>
					<span className="text-center">Email</span>
					<span className="text-center">Push</span>
				</div>
				<ul className="divide-y divide-neutral-100">
					{visible.map((c) => (
						<li key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_64px_64px]">
							<div className="min-w-0">
								<p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
									{c.label}
									{c.locked && <Lock className="h-3 w-3 text-neutral-400" aria-label="Always on" />}
								</p>
								<p className="text-xs leading-relaxed text-neutral-500">{c.description}</p>
							</div>
							{(["email", "push"] as Channel[]).map((ch) => (
								<div key={ch} className="flex flex-col items-center gap-1">
									<span className="text-[10px] font-semibold uppercase text-neutral-400 sm:hidden">{ch}</span>
									{c.channels.includes(ch) ? (
										<Switch
											checked={c.locked && ch === "email" ? true : isOn(c.id, ch)}
											disabled={saving || (c.locked && ch === "email")}
											onCheckedChange={(v) => setCategory(c.id, ch, v)}
											aria-label={`${c.label} by ${ch}`}
										/>
									) : (
										<span className="text-neutral-300" aria-label="Not sent this way">—</span>
									)}
								</div>
							))}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

function MasterRow({ icon, title, hint, checked, disabled, onChange }: { icon: React.ReactNode; title: string; hint: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-center justify-between gap-3 bg-white p-4">
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-600">{icon}</div>
				<div>
					<p className="text-sm font-semibold text-neutral-900">{title}</p>
					<p className="text-xs text-neutral-500">{hint}</p>
				</div>
			</div>
			<Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={`${title} notifications`} />
		</div>
	);
}
