"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Calendar,
	CheckCircle,
	XCircle,
	RefreshCw,
	ExternalLink,
	Unlink,
	CalendarSync,
	CalendarCheck,
	Bell,
	Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "next/navigation";

interface CalendarIntegrationSettingsProps {
	userId: string;
	isProfessional: boolean;
}

interface CalendarConnectionState {
	connected: boolean;
	syncEnabled: boolean;
	lastSync?: string;
	calendarsCount: number;
	isLoading: boolean;
}

export function CalendarIntegrationSettings({
	userId,
	isProfessional,
}: CalendarIntegrationSettingsProps) {
	const { toast } = useToast();
	const supabase = createClient();
	const searchParams = useSearchParams();

	const [state, setState] = useState<CalendarConnectionState>({
		connected: false,
		syncEnabled: false,
		calendarsCount: 0,
		isLoading: true,
	});
	const [disconnecting, setDisconnecting] = useState(false);

	// Check for OAuth callback results in URL
	useEffect(() => {
		const calendarSuccess = searchParams?.get("calendar_success");
		const calendarError = searchParams?.get("calendar_error");

		if (calendarSuccess === "true") {
			toast({
				title: "Calendar Connected!",
				description:
					"Your Google Calendar has been successfully linked. Appointments will now sync automatically.",
			});
			// Clean up URL params
			const url = new URL(window.location.href);
			url.searchParams.delete("calendar_success");
			window.history.replaceState({}, "", url.toString());
		}

		if (calendarError) {
			const errorMessages: Record<string, string> = {
				access_denied: "You denied access to Google Calendar. You can try again anytime.",
				initiation_failed: "Failed to start the connection. Please try again.",
				missing_params: "Invalid callback response from Google.",
				invalid_state: "Security check failed. Please try connecting again.",
				expired_state: "The connection request expired. Please try again.",
				user_mismatch: "User verification failed. Please log in and try again.",
				token_exchange_failed: "Failed to complete the connection. Please try again.",
				db_column_missing:
					"Database setup required. Please run the migration to add calendar support.",
				storage_failed: "Failed to save your calendar connection. Please try again.",
			};
			toast({
				title: "Connection Failed",
				description: errorMessages[calendarError] || `Error: ${calendarError}`,
				variant: "destructive",
			});
			// Clean up URL params
			const url = new URL(window.location.href);
			url.searchParams.delete("calendar_error");
			window.history.replaceState({}, "", url.toString());
		}
	}, [searchParams, toast]);

	// Fetch calendar connection status
	const fetchStatus = useCallback(async () => {
		if (!userId) return;

		try {
			const { data: profile, error } = await supabase
				.from("profiles")
				.select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry, calendar_sync_enabled")
				.eq("id", userId)
				.single();

			if (error) {
				// Column may not exist — that's OK
				setState((prev) => ({ ...prev, isLoading: false, connected: false }));
				return;
			}

			const hasTokens = !!profile?.google_calendar_token;

			setState({
				connected: hasTokens,
				syncEnabled: profile?.calendar_sync_enabled ?? false,
				lastSync: undefined,
				calendarsCount: 0,
				isLoading: false,
			});
		} catch {
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	}, [userId, supabase]);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	// Connect to Google Calendar
	const handleConnect = () => {
		// Redirect to our OAuth initiation endpoint
		window.location.href = "/api/auth/google";
	};

	// Toggle sync on/off
	const handleToggleSync = async () => {
		try {
			const newSyncEnabled = !state.syncEnabled;
			const { error } = await supabase
				.from("profiles")
				.update({ calendar_sync_enabled: newSyncEnabled })
				.eq("id", userId);

			if (error) throw error;

			setState((prev) => ({ ...prev, syncEnabled: newSyncEnabled }));
			toast({
				title: "Sync Updated",
				description: `Calendar sync ${newSyncEnabled ? "enabled" : "disabled"}.`,
			});
		} catch {
			toast({
				title: "Update Failed",
				description: "Could not update sync settings. Please try again.",
				variant: "destructive",
			});
		}
	};

	// Disconnect Google Calendar
	const handleDisconnect = async () => {
		setDisconnecting(true);
		try {
			const { error } = await supabase
				.from("profiles")
				.update({
					google_calendar_token: null,
					google_calendar_refresh_token: null,
					google_calendar_token_expiry: null,
					calendar_sync_enabled: false,
				})
				.eq("id", userId);

			if (error) throw error;

			setState({
				connected: false,
				syncEnabled: false,
				calendarsCount: 0,
				isLoading: false,
			});
			toast({
				title: "Calendar Disconnected",
				description: "Your Google Calendar has been unlinked from your account.",
			});
		} catch {
			toast({
				title: "Disconnect Failed",
				description: "Could not disconnect your calendar. Please try again.",
				variant: "destructive",
			});
		} finally {
			setDisconnecting(false);
		}
	};

	// Loading state
	if (state.isLoading) {
		return (
			<div className="space-y-6 max-w-4xl">
				<div className="bg-gradient-to-r from-blue-50 to-white p-4 sm:p-6 rounded-2xl border border-blue-100 animate-pulse">
					<div className="h-6 bg-blue-100 rounded w-1/3 mb-2" />
					<div className="h-4 bg-blue-50 rounded w-2/3" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-4xl">
			{/* Header */}
			<div className="bg-gradient-to-r from-blue-50 to-white p-4 sm:p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
				<div className="p-3 bg-white rounded-xl shadow-sm border border-blue-100 shrink-0">
					<Calendar className="h-6 w-6 text-blue-600" />
				</div>
				<div>
					<h2 className="text-lg font-bold text-neutral-900 leading-tight">
						Calendar Integration
					</h2>
					<p className="text-neutral-600 text-sm mt-1 leading-relaxed">
						{isProfessional
							? "Connect your Google Calendar to automatically sync appointments with clients."
							: "Link your Google Calendar to receive appointment reminders and stay organized."}
					</p>
				</div>
			</div>

			{/* Google Calendar Connection Card */}
			<Card className="border-neutral-200 shadow-sm">
				<CardHeader className="border-b border-neutral-100 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{/* Google "G" icon */}
							<div className="w-5 h-5 flex items-center justify-center">
								<svg viewBox="0 0 24 24" className="w-5 h-5">
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
							</div>
							<CardTitle className="text-base">Google Calendar</CardTitle>
						</div>
						<Badge
							className={
								state.connected
									? state.syncEnabled
										? "bg-green-100 text-green-800"
										: "bg-yellow-100 text-yellow-800"
									: "bg-neutral-100 text-neutral-600"
							}
						>
							{state.connected ? (
								<CheckCircle className="h-3.5 w-3.5 mr-1" />
							) : (
								<XCircle className="h-3.5 w-3.5 mr-1" />
							)}
							{state.connected
								? state.syncEnabled
									? "Connected & Syncing"
									: "Connected (Sync Off)"
								: "Not Connected"}
						</Badge>
					</div>
					<CardDescription className="mt-1">
						{state.connected
							? "Your Google Calendar is linked to your Sauti account."
							: "Connect your Google Calendar to sync appointments and events."}
					</CardDescription>
				</CardHeader>

				<CardContent className="p-0">
					{!state.connected ? (
						/* ── Not Connected ── */
						<div className="p-4 sm:p-6 space-y-4">
							<div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/60">
								<div className="flex gap-3">
									<Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="text-sm font-medium text-blue-900">
											What you&apos;ll get
										</p>
										<ul className="text-xs text-blue-700 space-y-1">
											{isProfessional ? (
												<>
													<li className="flex items-center gap-1.5">
														<CalendarSync className="h-3.5 w-3.5" />
														Auto-sync appointments to your calendar
													</li>
													<li className="flex items-center gap-1.5">
														<CalendarCheck className="h-3.5 w-3.5" />
														Calendar events created for new bookings
													</li>
													<li className="flex items-center gap-1.5">
														<Bell className="h-3.5 w-3.5" />
														Automatic reminders for upcoming sessions
													</li>
												</>
											) : (
												<>
													<li className="flex items-center gap-1.5">
														<CalendarCheck className="h-3.5 w-3.5" />
														Appointment events added to your calendar
													</li>
													<li className="flex items-center gap-1.5">
														<Bell className="h-3.5 w-3.5" />
														Reminders before your scheduled sessions
													</li>
													<li className="flex items-center gap-1.5">
														<CalendarSync className="h-3.5 w-3.5" />
														Stay organized across all your devices
													</li>
												</>
											)}
										</ul>
									</div>
								</div>
							</div>

							<Button
								onClick={handleConnect}
								className="w-full h-12 gap-3 bg-white hover:bg-neutral-50 text-neutral-800 border-2 border-neutral-200 hover:border-neutral-300 rounded-xl shadow-sm transition-all"
							>
								<svg viewBox="0 0 24 24" className="w-5 h-5">
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								<span className="font-semibold">Connect Google Calendar</span>
							</Button>

							<p className="text-xs text-neutral-400 text-center">
								We only access calendar events — never emails or contacts.
							</p>
						</div>
					) : (
						/* ── Connected ── */
						<div className="divide-y divide-neutral-100">
							{/* Auto-sync toggle */}
							<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
								<div className="space-y-0.5">
									<div className="font-medium text-sm flex items-center gap-2">
										{isProfessional
											? "Auto-sync Appointments"
											: "Sync Appointment Reminders"}
									</div>
									<p className="text-xs text-neutral-500">
										{isProfessional
											? "Automatically create calendar events for new bookings."
											: "Add appointment reminders to your Google Calendar."}
									</p>
								</div>
								<Switch
									checked={state.syncEnabled}
									onCheckedChange={handleToggleSync}
								/>
							</div>

							{/* Upcoming events info (professional only) */}
							{isProfessional && (
								<div className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
									<div className="space-y-0.5">
										<div className="font-medium text-sm">
											Calendar Event Notifications
										</div>
										<p className="text-xs text-neutral-500">
											Send Google Calendar reminders 30 min before appointments.
										</p>
									</div>
									<Badge variant="outline" className="text-xs text-neutral-400">
										Automatic
									</Badge>
								</div>
							)}

							{/* Reconnect & Disconnect buttons */}
							<div className="p-4 space-y-3">
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={handleConnect}
										className="gap-2 text-neutral-600 hover:text-blue-600 rounded-xl"
									>
										<RefreshCw className="h-4 w-4" />
										Reconnect
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											window.open(
												"https://calendar.google.com",
												"_blank"
											)
										}
										className="gap-2 text-neutral-600 hover:text-blue-600 rounded-xl"
									>
										<ExternalLink className="h-4 w-4" />
										Open Google Calendar
									</Button>
								</div>

								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl w-full justify-start"
										>
											<Unlink className="h-4 w-4" />
											Disconnect Google Calendar
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Disconnect Google Calendar?
											</AlertDialogTitle>
											<AlertDialogDescription>
												This will unlink your Google Calendar from Sauti.
												Existing calendar events won&apos;t be deleted, but
												new appointments will no longer sync automatically.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel className="rounded-xl">
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={handleDisconnect}
												disabled={disconnecting}
												className="bg-red-600 hover:bg-red-700 rounded-xl"
											>
												{disconnecting ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														Disconnecting...
													</>
												) : (
													"Disconnect"
												)}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Future Calendar Integrations Placeholder */}
			<Card className="border-neutral-200 shadow-sm border-dashed">
				<CardContent className="p-4 sm:p-6">
					<div className="flex items-center gap-3 text-neutral-400">
						<Calendar className="h-5 w-5" />
						<div>
							<p className="text-sm font-medium text-neutral-500">
								More Calendars Coming Soon
							</p>
							<p className="text-xs text-neutral-400 mt-0.5">
								Outlook, Apple Calendar, and other integrations are planned for
								future releases.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
