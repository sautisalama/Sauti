"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Calendar,
	CheckCircle,
	XCircle,
	RefreshCw,
	Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CalendarStatus {
	connected: boolean;
	syncEnabled: boolean;
	lastSync?: string;
	tokenExpiry?: number;
}

export function CalendarConnection({ userId }: { userId: string }) {
	const [status, setStatus] = useState<CalendarStatus>({
		connected: false,
		syncEnabled: false,
	});
	const [isLoading, setIsLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const { toast } = useToast();
	const supabase = createClient();

	useEffect(() => {
		checkCalendarStatus();
	}, [userId]);

	const checkCalendarStatus = async () => {
		try {
			// Test the calendar integration
			const response = await fetch("/api/test/calendar-integration");
			const result = await response.json();

			if (result.success) {
				setStatus({
					connected: true,
					syncEnabled: result.data?.syncEnabled || false,
					lastSync: result.data?.tokenExpiry
						? new Date(result.data.tokenExpiry).toISOString()
						: undefined,
					tokenExpiry: result.data?.tokenExpiry,
				});
			} else {
				setStatus({
					connected: false,
					syncEnabled: false,
				});
			}
		} catch (error) {
			console.error("Error checking calendar status:", error);
			setStatus({
				connected: false,
				syncEnabled: false,
			});
		}
	};

	const connectCalendar = async () => {
		setIsLoading(true);
		try {
			// Since we're using Supabase OAuth, we need to re-authenticate with calendar scopes
			// This will redirect to Google OAuth with the additional scopes
			window.location.href = "/api/auth/google-calendar";
		} catch (error) {
			toast({
				title: "Connection Failed",
				description: "Failed to connect to Google Calendar. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const toggleSync = async () => {
		setIsLoading(true);
		try {
			const { error } = await supabase
				.from("profiles")
				.update({ calendar_sync_enabled: !status.syncEnabled })
				.eq("id", userId);

			if (error) throw error;

			setStatus((prev) => ({ ...prev, syncEnabled: !prev.syncEnabled }));

			toast({
				title: "Sync Updated",
				description: `Calendar sync ${
					!status.syncEnabled ? "enabled" : "disabled"
				}`,
			});
		} catch (error) {
			toast({
				title: "Update Failed",
				description: "Failed to update sync settings.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const refreshToken = async () => {
		setIsRefreshing(true);
		try {
			const response = await fetch("/api/calendar/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "refresh_token" }),
			});

			if (response.ok) {
				await checkCalendarStatus();
				toast({
					title: "Token Refreshed",
					description: "Calendar connection refreshed successfully.",
				});
			} else {
				throw new Error("Failed to refresh token");
			}
		} catch (error) {
			toast({
				title: "Refresh Failed",
				description: "Failed to refresh calendar connection.",
				variant: "destructive",
			});
		} finally {
			setIsRefreshing(false);
		}
	};

	const syncAllAppointments = async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/calendar/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "sync_all" }),
			});

			const result = await response.json();

			if (response.ok) {
				toast({
					title: "Sync Complete",
					description: `Synced ${result.synced} appointments to Google Calendar.`,
				});
			} else {
				throw new Error(result.error || "Sync failed");
			}
		} catch (error) {
			toast({
				title: "Sync Failed",
				description: "Failed to sync appointments with Google Calendar.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const getStatusIcon = () => {
		if (status.connected) {
			return <CheckCircle className="h-5 w-5 text-green-500" />;
		}
		return <XCircle className="h-5 w-5 text-red-500" />;
	};

	const getStatusText = () => {
		if (status.connected) {
			return status.syncEnabled
				? "Connected & Syncing"
				: "Connected (Sync Disabled)";
		}
		return "Not Connected";
	};

	const getStatusColor = () => {
		if (status.connected) {
			return status.syncEnabled
				? "bg-green-100 text-green-800"
				: "bg-yellow-100 text-yellow-800";
		}
		return "bg-red-100 text-red-800";
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						<CardTitle>Google Calendar</CardTitle>
					</div>
					<Badge className={getStatusColor()}>
						{getStatusIcon()}
						<span className="ml-1">{getStatusText()}</span>
					</Badge>
				</div>
				<CardDescription>
					Connect your Google Calendar to automatically sync appointments and receive
					reminders.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{!status.connected ? (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Connect your Google Calendar to automatically create events for your
							appointments.
						</p>
						<Button onClick={connectCalendar} disabled={isLoading} className="w-full">
							{isLoading ? (
								<>
									<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									Connecting...
								</>
							) : (
								<>
									<Calendar className="h-4 w-4 mr-2" />
									Connect Google Calendar
								</>
							)}
						</Button>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium">Auto-sync appointments</p>
								<p className="text-xs text-muted-foreground">
									Automatically create calendar events for new appointments
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={toggleSync}
								disabled={isLoading}
							>
								{status.syncEnabled ? "Disable" : "Enable"}
							</Button>
						</div>

						{status.lastSync && (
							<div className="text-xs text-muted-foreground">
								Last sync: {new Date(status.lastSync).toLocaleString()}
							</div>
						)}

						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={refreshToken}
								disabled={isRefreshing}
							>
								{isRefreshing ? (
									<RefreshCw className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
								Refresh
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={syncAllAppointments}
								disabled={isLoading}
							>
								<Settings className="h-4 w-4 mr-1" />
								Sync All
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
