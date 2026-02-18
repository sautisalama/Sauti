"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Settings,
	Bell,
	Shield,
	Info,
	CheckCircle,
	FileText,
	LogOut,
	Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/(auth)/actions/auth";
import {
	parseSettings,
	parsePolicies,
	mergeSettings,
	type UserSettings,
	type UserPolicies,
} from "@/lib/user-settings";
import { POLICIES } from "../_views/PolicyContent";

export function AppSettingsSection() {
	const { toast } = useToast();
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const supabase = createClient();

	const [settings, setSettings] = useState<UserSettings>(() =>
		parseSettings(profile?.settings)
	);
	const [policies, setPolicies] = useState<UserPolicies>(() =>
		parsePolicies(profile?.policies)
	);
	const [savingKey, setSavingKey] = useState<keyof UserSettings | null>(null);
	const [signingOut, setSigningOut] = useState(false);

	// Sync settings and policies from profile when it changes
	useEffect(() => {
		if (profile?.settings) {
			setSettings(parseSettings(profile.settings));
		}
		if (profile?.policies) {
			setPolicies(parsePolicies(profile.policies));
		}
	}, [profile?.settings, profile?.policies]);

	/**
	 * Persist a partial settings update to the database.
	 */
	const persistSettings = useCallback(
		async (patch: Partial<UserSettings>) => {
			if (!userId) return;

			const merged = mergeSettings(settings, patch);
			setSettings(merged);

			try {
				const { error } = await supabase
					.from("profiles")
					.update({ settings: merged as any })
					.eq("id", userId);

				if (error) throw error;

				if (dash && profile) {
					dash.updatePartial({
						profile: {
							...profile,
							settings: merged as any,
						},
					});
				}
			} catch (err) {
				console.error("Failed to save settings:", err);
				setSettings(parseSettings(profile?.settings));
			}
		},
		[userId, settings, supabase, dash, profile]
	);

	const handleToggle = async (key: keyof UserSettings) => {
		setSavingKey(key);
		await persistSettings({ [key]: !settings[key] });
		toast({
			title: "Settings Updated",
			description: "Your preferences have been saved.",
		});
		setSavingKey(null);
	};

	const handleSignOut = async () => {
		setSigningOut(true);
		try {
			await signOut();
		} catch {
			setSigningOut(false);
		}
	};

	// Use separated policy state
	const acceptedPolicies = policies.accepted_policies || [];

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Header */}
			<div className="bg-gradient-to-r from-neutral-50 to-white p-4 sm:p-6 rounded-2xl border border-neutral-100 flex items-start gap-4">
				<div className="p-3 bg-white rounded-xl shadow-sm border border-neutral-100 shrink-0">
					<Settings className="h-6 w-6 text-neutral-600" />
				</div>
				<div>
					<h2 className="text-lg font-bold text-neutral-900 leading-tight">App Settings</h2>
					<p className="text-neutral-600 text-sm mt-1 leading-relaxed">
						Manage notifications, policies, and general preferences.
					</p>
				</div>
			</div>

			{/* Notification Preferences */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<Bell className="h-5 w-5 text-neutral-500" />
						<CardTitle className="text-base">Notifications</CardTitle>
					</div>
					<CardDescription className="mt-1">
						Choose how you want to receive updates.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<div className="divide-y divide-neutral-100">
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm">Email Notifications</div>
								<p className="text-xs text-neutral-500">
									Receive updates about messages, appointments, and matches via email.
								</p>
							</div>
							<Switch
								checked={!!settings.email_notifications}
								onCheckedChange={() => handleToggle("email_notifications")}
								disabled={savingKey === "email_notifications"}
							/>
						</div>

						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm">Push Notifications</div>
								<p className="text-xs text-neutral-500">
									Browser notifications for real-time alerts and messages.
								</p>
							</div>
							<Switch
								checked={!!settings.push_notifications}
								onCheckedChange={() => handleToggle("push_notifications")}
								disabled={savingKey === "push_notifications"}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Platform Policies */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-neutral-500" />
						<CardTitle className="text-base">Platform Policies</CardTitle>
					</div>
					<CardDescription className="mt-1">
						View the policies you&apos;ve accepted on Sauti Salama.
					</CardDescription>
				</CardHeader>
				<CardContent className="p-4 space-y-3">
					{POLICIES.map((policy) => {
						const isAccepted = acceptedPolicies.includes(policy.id);
						return (
							<div
								key={policy.id}
								className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
									isAccepted
										? "bg-emerald-50/40 border-emerald-100"
										: "bg-neutral-50/50 border-neutral-100"
								}`}
							>
								<div className="flex items-center gap-3">
									{isAccepted ? (
										<div className="p-1.5 bg-emerald-100 rounded-full">
											<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
										</div>
									) : (
										<div className="p-1.5 bg-neutral-100 rounded-full">
											<Info className="h-3.5 w-3.5 text-neutral-400" />
										</div>
									)}
									<div>
										<p className="text-sm font-medium text-neutral-900">{policy.title}</p>
										<p className="text-xs text-neutral-400">
											{isAccepted ? "Accepted" : "Not yet accepted"}
										</p>
									</div>
								</div>
								<Badge
									className={
										isAccepted
											? "bg-emerald-100 text-emerald-700 border-0 text-[10px]"
											: "bg-neutral-100 text-neutral-500 border-0 text-[10px]"
									}
								>
									{isAccepted ? "✓" : "—"}
								</Badge>
							</div>
						);
					})}

					{policies.policies_accepted_at && (
						<p className="text-xs text-neutral-400 text-center pt-2">
							Last accepted on{" "}
							{new Date(policies.policies_accepted_at).toLocaleDateString("en-US", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</p>
					)}
				</CardContent>
			</Card>

			{/* Sign Out */}
			<Card className="border-neutral-200 shadow-sm">
				<CardContent className="p-4">
					<Button
						variant="outline"
						onClick={handleSignOut}
						disabled={signingOut}
						className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 h-12 rounded-xl"
					>
						{signingOut ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<LogOut className="h-4 w-4" />
						)}
						Sign Out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
