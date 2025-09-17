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
			// Calendar integration is now optional - always show as available
			setStatus({
				connected: true,
				syncEnabled: false,
				lastSync: undefined,
				tokenExpiry: undefined,
			});
		} catch (error) {
			console.error("Error checking calendar status:", error);
			setStatus({
				connected: true,
				syncEnabled: false,
			});
		}
	};

	const connectCalendar = async () => {
		setIsLoading(true);
		try {
			// Calendar integration is now optional - show info message
			toast({
				title: "Calendar Integration",
				description:
					"Calendar integration is optional and can be enabled later. The app works without it.",
			});
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
			// Calendar integration is now optional - show info message
			toast({
				title: "Calendar Integration",
				description: "Calendar integration is optional and can be enabled later.",
			});
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
			// Calendar integration is now optional - show info message
			toast({
				title: "Calendar Integration",
				description: "Calendar integration is optional and can be enabled later.",
			});
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
			return status.syncEnabled ? "Available & Syncing" : "Available (Optional)";
		}
		return "Available (Optional)";
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
					Calendar integration is optional. You can use the app without connecting to
					Google Calendar.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Calendar integration is optional. The app works perfectly without it.
					</p>
					<Button onClick={connectCalendar} disabled={isLoading} className="w-full">
						{isLoading ? (
							<>
								<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
								Loading...
							</>
						) : (
							<>
								<Calendar className="h-4 w-4 mr-2" />
								Learn More (Optional)
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
