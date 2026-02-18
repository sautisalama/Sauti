"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Shield,
	Lock,
	Smartphone,
	Eye,
	LogOut,
	ChevronRight,
	AlertTriangle,
	Download,
	Monitor,
	Tablet,
	Loader2,
	Trash2,
	MapPin,
	Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import {
	parseSettings,
	parsePolicies,
	mergeSettings,
	registerDevice,
	removeDevice,
	getRelativeTime,
	getOrCreateDeviceId,
	type UserSettings,
	type UserPolicies,
	type TrackedDevice,
} from "@/lib/user-settings";

export function PrivacySecuritySettings() {
	const { toast } = useToast();
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const supabase = createClient();

	const [loading, setLoading] = useState<string | null>(null);
	const [settings, setSettings] = useState<UserSettings>(() =>
		parseSettings(profile?.settings)
	);
	const [policies, setPolicies] = useState<UserPolicies>(() =>
		parsePolicies(profile?.policies)
	);
	const [savingKey, setSavingKey] = useState<string | null>(null);

	// Sync settings and policies from profile when it changes
	useEffect(() => {
		if (profile?.settings) {
			setSettings(parseSettings(profile.settings));
		}
		if (profile?.policies) {
			setPolicies(parsePolicies(profile.policies));
		}
	}, [profile?.settings, profile?.policies]);

	// Register current device on mount if tracking is enabled
	useEffect(() => {
		if (!userId || !settings.device_tracking_enabled || !profile) return;

		const currentDeviceId = getOrCreateDeviceId();
		const currentDevices = (profile.devices as any[]) || [];
		const existingDevice = currentDevices.find(d => d.id === currentDeviceId);
		
		// Only register if device is new or hasn't been updated in 5 minutes
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		if (!existingDevice || existingDevice.last_active < fiveMinutesAgo) {
			const updatedDevices = registerDevice(currentDevices);
			
			// Perist to dedicated column
			supabase
				.from("profiles")
				.update({ devices: updatedDevices as any })
				.eq("id", userId)
				.then(() => {
					dash?.updatePartial({
						profile: { ...profile, devices: updatedDevices as any }
					});
				});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId, settings.device_tracking_enabled, profile?.id]);

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

				// Update dashboard context so other components see the change
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
				// Revert local state
				setSettings(parseSettings(profile?.settings));
			}
		},
		[userId, settings, supabase, dash, profile]
	);

	const handleToggle = async (key: Extract<keyof UserSettings, string>) => {
		setSavingKey(key);
		const newValue = !settings[key];
		
		await persistSettings({ [key]: newValue });

		toast({
			title: "Settings Updated",
			description: "Your privacy preferences have been saved.",
		});
		setSavingKey(null);
	};

	const handleToggleDeviceTracking = async () => {
		setSavingKey("device_tracking");
		const newValue = !settings.device_tracking_enabled;

		if (!newValue) {
			// Turning off — clear all tracked devices (in dedicated column)
			await persistSettings({ device_tracking_enabled: false });
			
			const { error } = await supabase
				.from("profiles")
				.update({ devices: [] as any })
				.eq("id", userId);
				
			if (!error && dash && profile) {
				dash.updatePartial({
					profile: { ...profile, devices: [] as any }
				});
			}

			toast({
				title: "Device Tracking Disabled",
				description: "All tracked device sessions have been cleared.",
			});
		} else {
			// Turning on — register current device
			const devices = registerDevice([]);
			await persistSettings({ device_tracking_enabled: true });
			
			const { error } = await supabase
				.from("profiles")
				.update({ devices: devices as any })
				.eq("id", userId);
				
			if (!error && dash && profile) {
				dash.updatePartial({
					profile: { ...profile, devices: devices as any }
				});
			}

			toast({
				title: "Device Tracking Enabled",
				description: "Your active sessions will now be tracked.",
			});
		}
		setSavingKey(null);
	};

	const handleRevokeDevice = async (deviceId: string) => {
		if (!userId) return;
		setLoading(deviceId);
		
		const updatedDevices = removeDevice(profile?.devices as any, deviceId);
		
		try {
			const { error } = await supabase
				.from("profiles")
				.update({ devices: updatedDevices as any })
				.eq("id", userId);

			if (error) throw error;

			if (dash && profile) {
				dash.updatePartial({
					profile: { ...profile, devices: updatedDevices as any }
				});
			}

			toast({
				title: "Session Revoked",
				description: "The device has been removed from your active sessions.",
			});
		} catch (err) {
			console.error("Failed to revoke device:", err);
		} finally {
			setLoading(null);
		}
	};

	const handleLogoutOther = async () => {
		if (!userId) return;
		setLoading("logout");
		
		const currentDeviceId = getOrCreateDeviceId();
		const currentDevices = (profile?.devices as any[]) || [];
		const filtered = currentDevices.filter(d => d.id === currentDeviceId);
		
		try {
			const { error } = await supabase
				.from("profiles")
				.update({ devices: filtered as any })
				.eq("id", userId);

			if (error) throw error;

			if (dash && profile) {
				dash.updatePartial({
					profile: { ...profile, devices: filtered as any }
				});
			}

			toast({
				title: "Logged Out of Other Devices",
				description: "All other device sessions have been revoked.",
			});
		} catch (err) {
			console.error("Failed to logout other devices:", err);
		} finally {
			setLoading(null);
		}
	};

	const getDeviceIcon = (device: TrackedDevice) => {
		const name = device.device_name.toLowerCase();
		if (name.includes("iphone") || name.includes("android") || name.includes("mobile")) {
			return <Smartphone className="h-4 w-4" />;
		}
		if (name.includes("ipad") || name.includes("tablet")) {
			return <Tablet className="h-4 w-4" />;
		}
		return <Monitor className="h-4 w-4" />;
	};

	const currentDeviceId = typeof window !== "undefined" ? getOrCreateDeviceId() : "";
	const activeDevices = (profile?.devices as any[]) || [];
	const otherDevices = activeDevices.filter(d => d.id !== currentDeviceId);

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Header */}
			<div className="bg-gradient-to-r from-purple-50 to-white p-4 sm:p-6 rounded-2xl border border-purple-100 flex items-start gap-4">
				<div className="p-3 bg-white rounded-xl shadow-sm border border-purple-100 shrink-0">
					<Shield className="h-6 w-6 text-purple-600" />
				</div>
				<div>
					<h2 className="text-lg font-bold text-neutral-900 leading-tight">Privacy & Security</h2>
					<p className="text-neutral-600 text-sm mt-1 leading-relaxed">
						Manage account security and control your data.
					</p>
				</div>
			</div>

			{/* Account Security */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<Lock className="h-5 w-5 text-neutral-500" />
						<CardTitle className="text-base">Login & Security</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<div className="divide-y divide-neutral-100">
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm flex items-center gap-2">
									Two-Factor Authentication
									<Badge variant="outline" className="text-xs font-normal text-neutral-500">Recommended</Badge>
								</div>
								<p className="text-xs text-neutral-500">Add an extra layer of security to your account.</p>
							</div>
							<Switch 
								checked={!!settings.two_factor_enabled}
								onCheckedChange={() => handleToggle('two_factor_enabled')}
								disabled={savingKey === 'two_factor_enabled'}
							/>
						</div>
						
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm">Login Alerts</div>
								<p className="text-xs text-neutral-500">Get notified of new sign-ins on your account.</p>
							</div>
							<Switch 
								checked={!!settings.login_alerts_enabled}
								onCheckedChange={() => handleToggle('login_alerts_enabled')}
								disabled={savingKey === 'login_alerts_enabled'}
							/>
						</div>

						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors cursor-pointer group">
							<div className="space-y-0.5">
								<div className="font-medium text-sm group-hover:text-purple-600 transition-colors">Change Password</div>
								<p className="text-xs text-neutral-500">Update your password periodically.</p>
							</div>
							<ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-purple-600" />
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Data Privacy */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<Eye className="h-5 w-5 text-neutral-500" />
						<CardTitle className="text-base">Data & Privacy</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<div className="divide-y divide-neutral-100">
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm">Profile Visibility</div>
								<p className="text-xs text-neutral-500">Allow survivors to see your professional profile.</p>
							</div>
							<Switch 
								checked={!!settings.public_profile}
								onCheckedChange={() => handleToggle('public_profile')}
								disabled={savingKey === 'public_profile'}
							/>
						</div>
						
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors group cursor-pointer">
							<div className="space-y-0.5">
								<div className="font-medium text-sm group-hover:text-purple-600">Download My Data</div>
								<p className="text-xs text-neutral-500">Get a copy of your data on Sauti Salama.</p>
							</div>
							<Button variant="ghost" size="sm" className="gap-2 text-neutral-600 group-hover:text-purple-600">
								<Download className="h-4 w-4" /> Download
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Active Sessions / Device Tracking */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Smartphone className="h-5 w-5 text-neutral-500" />
							<CardTitle className="text-base">Active Sessions</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xs text-neutral-400 mr-1">
								{settings.device_tracking_enabled ? "Tracking On" : "Tracking Off"}
							</span>
							<Switch
								checked={!!settings.device_tracking_enabled}
								onCheckedChange={handleToggleDeviceTracking}
								disabled={savingKey === "device_tracking"}
							/>
						</div>
					</div>
					{!settings.device_tracking_enabled && (
						<CardDescription className="mt-2 text-amber-600 text-xs">
							Device tracking is disabled. Enable it to see and manage your active sessions.
						</CardDescription>
					)}
				</CardHeader>

				{settings.device_tracking_enabled && (
					<CardContent className="p-4 space-y-3">
						{activeDevices.length === 0 ? (
							<div className="text-center py-6 text-neutral-400">
								<Smartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
								<p className="text-sm font-medium">No tracked sessions yet</p>
								<p className="text-xs mt-1">Sessions will appear here as you use the platform.</p>
							</div>
						) : (
							<>
								{activeDevices.map(device => {
									const isCurrent = device.id === currentDeviceId;
									const isRevoking = loading === device.id;

									return (
										<div
											key={device.id}
											className={cn(
												"flex items-center justify-between p-3 rounded-xl transition-all",
												isCurrent
													? "bg-green-50/60 border border-green-100"
													: "bg-neutral-50/50 border border-neutral-100 hover:bg-neutral-50"
											)}
										>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"p-2 rounded-full",
														isCurrent
															? "bg-green-100 text-green-600"
															: "bg-neutral-100 text-neutral-400"
													)}
												>
													{getDeviceIcon(device)}
												</div>
												<div>
													<p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
														{device.device_name}
														{isCurrent && (
															<Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 font-bold border-0">
																This Device
															</Badge>
														)}
													</p>
													<div className="flex items-center gap-2 mt-0.5">
														{device.location && (
															<span className="text-xs text-neutral-400 flex items-center gap-1">
																<MapPin className="h-3 w-3" />
																{device.location}
															</span>
														)}
														<span className="text-xs text-neutral-400 flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{isCurrent ? (
																<span className="text-green-600 font-medium">Active Now</span>
															) : (
																getRelativeTime(device.last_active)
															)}
														</span>
													</div>
												</div>
											</div>
											{!isCurrent && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleRevokeDevice(device.id)}
													disabled={isRevoking}
													className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2 gap-1"
												>
													{isRevoking ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<>
															<Trash2 className="h-3.5 w-3.5" />
															<span className="hidden sm:inline">Revoke</span>
														</>
													)}
												</Button>
											)}
										</div>
									);
								})}
							</>
						)}

						{otherDevices.length > 0 && (
							<div className="pt-2 border-t border-neutral-100">
								<Button 
									variant="outline" 
									className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
									onClick={handleLogoutOther}
									disabled={loading === "logout"}
								>
									{loading === "logout" ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<LogOut className="h-4 w-4" />
									)}
									Log Out of Other Devices
								</Button>
							</div>
						)}
					</CardContent>
				)}
			</Card>

			{/* Policy Acceptance Status */}
			{policies.all_policies_accepted && (
				<Card className="border-neutral-200 shadow-sm">
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-emerald-100 rounded-full">
								<Shield className="h-4 w-4 text-emerald-600" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium text-neutral-900">Platform Policies Accepted</p>
								<p className="text-xs text-neutral-400">
									{policies.policies_accepted_at
										? `Accepted on ${new Date(policies.policies_accepted_at).toLocaleDateString()}`
										: "All required policies have been accepted."}
								</p>
							</div>
							<Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">✓ Accepted</Badge>
						</div>
					</CardContent>
				</Card>
			)}

			<div className="flex justify-center pt-4">
				<button className="text-xs text-neutral-400 hover:underline flex items-center gap-1">
					<AlertTriangle className="h-3 w-3" /> Report a security issue
				</button>
			</div>
		</div>
	);
}
