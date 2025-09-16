"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Calendar,
	CheckCircle,
	XCircle,
	AlertTriangle,
	ExternalLink,
	Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCalendarStatus } from "@/hooks/useCalendarStatus";

interface CalendarConnectionStatusProps {
	userId: string;
	variant?: "card" | "alert" | "inline";
	showSettings?: boolean;
	className?: string;
}

export function CalendarConnectionStatus({
	userId,
	variant = "card",
	showSettings = true,
	className = "",
}: CalendarConnectionStatusProps) {
	const { toast } = useToast();
	const {
		connected,
		syncEnabled,
		lastSync,
		tokenExpiry,
		calendarsCount,
		isLoading,
		error,
		isRefreshing,
		toggleSync,
		connectCalendar,
		refreshStatus,
	} = useCalendarStatus(userId);

	const getStatusIcon = () => {
		if (isLoading || isRefreshing) {
			return (
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
			);
		}
		if (connected) {
			return <CheckCircle className="h-4 w-4 text-green-500" />;
		}
		return <XCircle className="h-4 w-4 text-red-500" />;
	};

	const getStatusText = () => {
		if (isLoading || isRefreshing) return "Checking...";
		if (connected) {
			return syncEnabled ? "Connected & Syncing" : "Connected (Sync Disabled)";
		}
		return "Not Connected";
	};

	const getStatusColor = () => {
		if (isLoading || isRefreshing) return "bg-gray-100 text-gray-600";
		if (connected) {
			return syncEnabled
				? "bg-green-100 text-green-800"
				: "bg-yellow-100 text-yellow-800";
		}
		return "bg-red-100 text-red-800";
	};

	// Don't show anything if connected and syncing
	if (connected && syncEnabled && variant !== "card") {
		return null;
	}

	// Alert variant for inline notifications
	if (variant === "alert") {
		return (
			<Alert className={`border-orange-200 bg-orange-50 ${className}`}>
				<AlertTriangle className="h-4 w-4 text-orange-600" />
				<AlertDescription className="flex items-center justify-between">
					<span>
						{connected
							? "Calendar connected but sync is disabled. Enable sync to automatically create calendar events for appointments."
							: "Connect your Google Calendar to automatically sync appointments and receive reminders."}
					</span>
					<div className="flex gap-2 ml-4">
						{connected ? (
							<Button
								variant="outline"
								size="sm"
								onClick={toggleSync}
								disabled={isLoading || isRefreshing}
							>
								{syncEnabled ? "Disable Sync" : "Enable Sync"}
							</Button>
						) : (
							<Button
								size="sm"
								onClick={connectCalendar}
								disabled={isLoading || isRefreshing}
							>
								<Calendar className="h-4 w-4 mr-2" />
								Connect Calendar
							</Button>
						)}
					</div>
				</AlertDescription>
			</Alert>
		);
	}

	// Inline variant for compact display
	if (variant === "inline") {
		return (
			<div className={`flex items-center gap-2 ${className}`}>
				{getStatusIcon()}
				<span className="text-sm text-muted-foreground">{getStatusText()}</span>
				{!connected && (
					<Button
						variant="ghost"
						size="sm"
						onClick={connectCalendar}
						disabled={isLoading || isRefreshing}
						className="h-6 px-2 text-xs"
					>
						Connect
					</Button>
				)}
			</div>
		);
	}

	// Card variant (default)
	return (
		<Card className={className}>
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
					{connected
						? "Your calendar is connected and ready to sync appointments."
						: "Connect your Google Calendar to automatically sync appointments and receive reminders."}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				{!connected ? (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Connect your Google Calendar to automatically create events for your
							appointments.
						</p>
						<Button
							onClick={connectCalendar}
							disabled={isLoading || isRefreshing}
							className="w-full"
						>
							{isLoading || isRefreshing ? (
								<>
									<div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
								disabled={isLoading || isRefreshing}
							>
								{syncEnabled ? "Disable" : "Enable"}
							</Button>
						</div>

						{calendarsCount !== undefined && (
							<div className="text-xs text-muted-foreground">
								{calendarsCount} calendar{calendarsCount !== 1 ? "s" : ""} available
							</div>
						)}

						{lastSync && (
							<div className="text-xs text-muted-foreground">
								Last sync: {new Date(lastSync).toLocaleString()}
							</div>
						)}

						{showSettings && (
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => (window.location.href = "/dashboard/settings")}
								>
									<Settings className="h-4 w-4 mr-1" />
									Calendar Settings
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={connectCalendar}
									disabled={isLoading || isRefreshing}
								>
									<ExternalLink className="h-4 w-4 mr-1" />
									Reconnect
								</Button>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
