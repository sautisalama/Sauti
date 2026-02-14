"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export interface CalendarStatus {
	connected: boolean;
	syncEnabled: boolean;
	lastSync?: string;
	tokenExpiry?: number;
	calendarsCount?: number;
	isLoading: boolean;
	error?: string;
}

export function useCalendarStatus(userId: string) {
	const [status, setStatus] = useState<CalendarStatus>({
		connected: false,
		syncEnabled: false,
		isLoading: true,
	});
	const [isRefreshing, setIsRefreshing] = useState(false);
	const supabase = createClient();

	const checkCalendarStatus = useCallback(async () => {
		if (!userId) return;

		setIsRefreshing(true);
		try {
			const { data: profile, error } = await supabase
				.from("profiles")
				.select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry, calendar_sync_enabled")
				.eq("id", userId)
				.single();

			if (error) {
				// Column may not exist yet — handle gracefully
				setStatus({
					connected: false,
					syncEnabled: false,
					isLoading: false,
					error: undefined,
				});
				return;
			}

			const hasValidTokens = !!profile?.google_calendar_token;

			setStatus({
				connected: hasValidTokens,
				syncEnabled: profile?.calendar_sync_enabled ?? false,
				lastSync: undefined,
				tokenExpiry: hasValidTokens ? (profile?.google_calendar_token_expiry ?? undefined) : undefined,
				calendarsCount: 0,
				isLoading: false,
				error: undefined,
			});
		} catch (error) {
			console.error("Error checking calendar status:", error);
			setStatus({
				connected: false,
				syncEnabled: false,
				isLoading: false,
				error: undefined,
			});
		} finally {
			setIsRefreshing(false);
		}
	}, [userId, supabase]);

	const toggleSync = useCallback(async () => {
		if (!userId) return;

		try {
			const newSync = !status.syncEnabled;
			const { error } = await supabase
				.from("profiles")
				.update({ calendar_sync_enabled: newSync })
				.eq("id", userId);

			if (error) throw error;

			setStatus((prev) => ({
				...prev,
				syncEnabled: newSync,
			}));
		} catch (error) {
			console.error("Error toggling sync:", error);
			setStatus((prev) => ({
				...prev,
				error:
					error instanceof Error ? error.message : "Failed to update sync settings",
			}));
		}
	}, [userId, status.syncEnabled, supabase]);

	const connectCalendar = useCallback(() => {
		// Redirect the user to the Google OAuth flow
		window.location.href = "/api/auth/google";
	}, []);

	const disconnectCalendar = useCallback(async () => {
		if (!userId) return;

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

			setStatus({
				connected: false,
				syncEnabled: false,
				isLoading: false,
				error: undefined,
			});
		} catch (error) {
			console.error("Error disconnecting calendar:", error);
		}
	}, [userId, supabase]);

	const refreshStatus = useCallback(() => {
		checkCalendarStatus();
	}, [checkCalendarStatus]);

	useEffect(() => {
		checkCalendarStatus();
	}, [checkCalendarStatus]);

	return {
		...status,
		isRefreshing,
		toggleSync,
		connectCalendar,
		disconnectCalendar,
		refreshStatus,
	};
}
