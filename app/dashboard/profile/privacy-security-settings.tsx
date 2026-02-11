"use client";

import { useState } from "react";
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
	Key,
	History,
	ChevronRight,
	AlertTriangle,
	Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PrivacySecuritySettings() {
	const { toast } = useToast();
	const [loading, setLoading] = useState<string | null>(null);
	
	const [settings, setSettings] = useState({
		twoFactor: false,
		publicProfile: true,
		loginAlerts: true,
		dataSharing: false,
	});

	const [sessions, setSessions] = useState([
		{ id: 1, device: "Chrome on Windows", location: "Nairobi, KE", active: true, lastActive: "Now" },
		{ id: 2, device: "Safari on iPhone", location: "Mombasa, KE", active: false, lastActive: "2 days ago" },
	]);

	const handleToggle = (key: keyof typeof settings) => {
		setSettings(prev => ({ ...prev, [key]: !prev[key] }));
		toast({ 
			title: "Settings Updated", 
			description: "Your privacy preferences have been saved."
		});
	};

	const handleLogoutOther = () => {
		setLoading("logout");
		setTimeout(() => {
			setSessions(prev => prev.filter(s => s.active));
			setLoading(null);
			toast({ title: "Logged out of other devices" });
		}, 1000);
	};

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Header */}
			<div className="bg-gradient-to-r from-purple-50 to-white p-6 rounded-2xl border border-purple-100 flex items-start gap-4">
				<div className="p-3 bg-white rounded-xl shadow-sm border border-purple-100">
					<Shield className="h-6 w-6 text-purple-600" />
				</div>
				<div>
					<h2 className="text-lg font-bold text-neutral-900">Privacy & Security</h2>
					<p className="text-neutral-600 text-sm mt-1">
						Manage your account security and control how your data is used.
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
								checked={settings.twoFactor}
								onCheckedChange={() => handleToggle('twoFactor')}
							/>
						</div>
						
						<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
							<div className="space-y-0.5">
								<div className="font-medium text-sm">Login Alerts</div>
								<p className="text-xs text-neutral-500">Get notified of new sign-ins on your account.</p>
							</div>
							<Switch 
								checked={settings.loginAlerts}
								onCheckedChange={() => handleToggle('loginAlerts')}
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
								checked={settings.publicProfile}
								onCheckedChange={() => handleToggle('publicProfile')}
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

			{/* Active Sessions */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<Smartphone className="h-5 w-5 text-neutral-500" />
						<CardTitle className="text-base">Active Sessions</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="p-4 space-y-4">
					{sessions.map(session => (
						<div key={session.id} className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className={cn("p-2 rounded-full", session.active ? "bg-green-100 text-green-600" : "bg-neutral-100 text-neutral-400")}>
									<Smartphone className="h-4 w-4" />
								</div>
								<div>
									<p className="text-sm font-medium text-neutral-900">{session.device}</p>
									<p className="text-xs text-neutral-500">
										{session.location} • {session.active ? <span className="text-green-600 font-medium">Active Now</span> : session.lastActive}
									</p>
								</div>
							</div>
							{!session.active && (
								<Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2">
									Revoke
								</Button>
							)}
						</div>
					))}
					
					<div className="pt-2 border-t border-neutral-100">
						<Button 
							variant="outline" 
							className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
							onClick={handleLogoutOther}
							disabled={!!loading}
						>
							<LogOut className="h-4 w-4" />
							Log Out of Other Devices
						</Button>
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

// Helper for conditional classes
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
