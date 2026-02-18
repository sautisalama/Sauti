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
import { cn } from "@/lib/utils";

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
			<Alert className={cn(
				"border-serene-blue-100 bg-serene-blue-50/30 backdrop-blur-sm rounded-2xl p-4 sm:p-5",
				className
			)}>
				<div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
					<div className="h-10 w-10 rounded-xl bg-serene-blue-100 flex items-center justify-center shrink-0">
						{!connected ? (
							<svg viewBox="0 0 24 24" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
								<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
								<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
								<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
								<path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
							</svg>
						) : (
							<Calendar className="h-5 w-5 text-serene-blue-600" />
						)}
					</div>
					<div className="flex-1">
						<AlertDescription className="text-sm font-medium text-serene-blue-900 leading-relaxed pr-2">
							{connected
								? "Calendar connected but sync is disabled. Enable sync to automatically create calendar events for appointments."
								: "Connect your Google Calendar to automatically sync appointments and receive reminders."}
						</AlertDescription>
					</div>
					<div className="shrink-0">
						{connected ? (
							<Button
								variant="outline"
								size="sm"
								onClick={toggleSync}
								className="rounded-xl border-serene-blue-200 text-serene-blue-700 hover:bg-serene-blue-50 font-bold"
								disabled={isLoading || isRefreshing}
							>
								{syncEnabled ? "Disable Sync" : "Enable Sync"}
							</Button>
						) : (
							<Button
								size="sm"
								onClick={connectCalendar}
								disabled={isLoading || isRefreshing}
								className="bg-white hover:bg-serene-neutral-50 text-serene-neutral-900 border-serene-neutral-200 shadow-sm rounded-xl px-4 font-bold transition-all active:scale-95 flex items-center gap-2.5 h-10"
							>
								<svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
									<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
									<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
									<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
									<path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
								</svg>
								Connect Calendar
							</Button>
						)}
					</div>
				</div>
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
									onClick={() => (window.location.href = "/dashboard/profile?section=calendar")}
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
