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
	detectDeviceInfo,
	type UserSettings,
	type UserPolicies,
	type TrackedDevice,
} from "@/lib/user-settings";
import { POLICIES } from "../_views/PolicyContent";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
			const updatedDevices = registerDevice(currentDevices, currentDeviceId);
			
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
			const devices = registerDevice([], getOrCreateDeviceId());
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

	const handleDownloadData = async () => {
		if (!profile) return;
		setLoading("download");

		try {
			const { default: jsPDF } = await import("jspdf");
			const { default: autoTable } = await import("jspdf-autotable");

			const doc = new jsPDF();
			const now = new Date();
			const deviceInfo = detectDeviceInfo();

			// Handle Logo
			try {
				const logoImg = new Image();
				logoImg.src = "/Logo.png";
				await new Promise((resolve) => {
					logoImg.onload = resolve;
					logoImg.onerror = resolve;
				});
				if (logoImg.complete && logoImg.naturalWidth > 0) {
					// Position at top right
					doc.addImage(logoImg, "PNG", 165, 10, 25, 25);
				}
			} catch (e) {
				console.error("Logo load error:", e);
			}

			// Add Header
			doc.setFontSize(22);
			doc.setTextColor(14, 165, 233); // matches sauti blue ish
			doc.text("Sauti Salama", 20, 25);
			
			doc.setFontSize(10);
			doc.setTextColor(100);
			doc.text("Personal Data Export", 20, 32);
			
			doc.setDrawColor(229, 231, 235);
			doc.line(20, 38, 190, 38);

			// Metadata
			doc.setFontSize(9);
			doc.setTextColor(156, 163, 175);
			doc.text(`Generated on: ${now.toLocaleString()}`, 20, 48);
			doc.text(`Access Device: ${deviceInfo.device_name}`, 20, 53);
			doc.text(`Browser Environment: ${deviceInfo.browser} (${deviceInfo.os})`, 20, 58);

			// Personal Profile
			doc.setFontSize(14);
			doc.setTextColor(17, 24, 39);
			doc.text("Account Profile", 20, 75);
			
			const profileData = [
				["Full Name", `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Anonymous"],
				["Email Address", profile.email || "N/A"],
				["User Role", (profile.user_type || "N/A").toUpperCase()],
				["Professional Title", profile.professional_title || "N/A"],
				["Verification Status", (profile.verification_status || "Pending").toUpperCase()],
				["Phone Number", profile.phone || "Not Set"],
				["Biography", profile.bio || "None provided"],
			];

			autoTable(doc, {
				startY: 80,
				head: [["Information Field", "Registered Data"]],
				body: profileData,
				theme: "striped",
				headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: "bold" },
				styles: { fontSize: 9, cellPadding: 3 },
				columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } }
			});

			// Support Services (if Professional/NGO)
			const services = dash?.data?.supportServices || [];
			if (services.length > 0) {
				const finalY = (doc as any).lastAutoTable.finalY + 15;
				doc.setFontSize(14);
				doc.setTextColor(17, 24, 39);
				doc.text("Registered Support Services", 20, finalY);

				const servicesData = services.map(s => [
					s.name,
					(s.service_types as string).replace("_", " ").toUpperCase(),
					s.coverage_area_radius ? "In-Person" : "Remote",
					s.is_active ? "ACTIVE" : "INACTIVE"
				]);

				autoTable(doc, {
					startY: finalY + 5,
					head: [["Service Name", "Category", "Location", "Status"]],
					body: servicesData,
					theme: "grid",
					headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
					styles: { fontSize: 8 }
				});
			}

			// Security Notice Footer
			const pageCount = doc.getNumberOfPages();
			for (let i = 1; i <= pageCount; i++) {
				doc.setPage(i);
				doc.setFontSize(8);
				doc.setTextColor(156, 163, 175);
				doc.text(
					"CONFIDENTIAL: This document contains sensitive personal information managed by Sauti Salama.",
					doc.internal.pageSize.width / 2,
					doc.internal.pageSize.height - 15,
					{ align: "center" }
				);
				doc.text(
					`Page ${i} of ${pageCount}`,
					doc.internal.pageSize.width / 2,
					doc.internal.pageSize.height - 10,
					{ align: "center" }
				);
			}

			doc.save(`sauti_salama_export_${profile.first_name || "user"}_${now.getTime()}.pdf`);
			
			toast({
				title: "Data Export Complete",
				description: "Your personal data has been securely exported.",
			});
		} catch (err) {
			console.error("Export Error:", err);
			toast({
				title: "Export Failed",
				description: "Could not generate your data export. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(null);
		}
	};

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
													<div className="text-sm font-medium text-neutral-900 flex items-center gap-2">
														{device.device_name}
														{isCurrent && (
															<Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 font-bold border-0">
																This Device
															</Badge>
														)}
													</div>
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
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors group">
							<div className="space-y-0.5">
								<div className="font-medium text-sm group-hover:text-purple-600">Download My Data</div>
								<p className="text-xs text-neutral-500">Get a copy of your data on Sauti Salama.</p>
							</div>
							<Button 
								variant="ghost" 
								size="sm" 
								className="gap-2 text-neutral-600 group-hover:text-purple-600"
								onClick={handleDownloadData}
								disabled={loading === "download"}
							>
								{loading === "download" ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<>
										<Download className="h-4 w-4" /> 
										Download
									</>
								)}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Policy Acceptance Status */}
			{policies.all_policies_accepted && (
				<Card className="border-neutral-200 shadow-sm">
					<CardHeader className="border-b border-neutral-100 pb-3">
						<div className="flex items-center gap-2">
							<Shield className="h-4 w-4 text-emerald-600" />
							<CardTitle className="text-sm font-bold">Platform Policies</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<div className="divide-y divide-neutral-100">
							{POLICIES.filter(p => {
								const base = p.id === 'terms' || p.id === 'privacy';
								if (profile?.user_type === 'survivor') return base || p.id === 'survivor_safety';
								if (profile?.user_type === 'professional') return base || p.id === 'professional_conduct';
								if (profile?.user_type === 'ngo') return base || p.id === 'professional_conduct' || p.id === 'referral_policy';
								return base;
							}).map((policy) => (
								<div key={policy.id} className="p-4 flex items-center justify-between">
									<div className="space-y-0.5">
										<div className="font-medium text-sm text-neutral-900">{policy.title}</div>
										<p className="text-xs text-neutral-500">
											{policies.policies_accepted_at
												? `Accepted on ${new Date(policies.policies_accepted_at).toLocaleDateString()}`
												: "Policy accepted during onboarding."}
										</p>
									</div>
									<Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] px-2 py-0">✓ Accepted</Badge>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

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
						<div className="p-4 flex items-center justify-between opacity-60">
							<div className="space-y-0.5">
								<div className="font-medium text-sm flex items-center gap-2">
									Two-Factor Authentication
									<Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] uppercase font-bold px-1.5 py-0">Coming Soon</Badge>
								</div>
								<p className="text-xs text-neutral-500">Add an extra layer of security to your account.</p>
							</div>
							<Switch 
								checked={false}
								disabled={true}
							/>
						</div>
						
						<div className="p-4 flex items-center justify-between opacity-60">
							<div className="space-y-0.5">
								<div className="font-medium text-sm flex items-center gap-2">
									Login Alerts
									<Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] uppercase font-bold px-1.5 py-0">Coming Soon</Badge>
								</div>
								<p className="text-xs text-neutral-500">Get notified of new sign-ins on your account.</p>
							</div>
							<Switch 
								checked={false}
								disabled={true}
							/>
						</div>

						<div className="p-4 flex items-center justify-between opacity-60">
							<div className="space-y-0.5">
								<div className="font-medium text-sm flex items-center gap-2">
									Change Password
									<Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] uppercase font-bold px-1.5 py-0">Coming Soon</Badge>
								</div>
								<p className="text-xs text-neutral-500">Update your password periodically.</p>
							</div>
							<ChevronRight className="h-4 w-4 text-neutral-300" />
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-center pt-4">
				<button className="text-xs text-neutral-400 hover:underline flex items-center gap-1">
					<AlertTriangle className="h-3 w-3" /> Report a security issue
				</button>
			</div>
		</div>
	);
}
