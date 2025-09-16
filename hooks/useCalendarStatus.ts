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
					calendarsCount: result.data?.calendarsCount || 0,
					isLoading: false,
					error: undefined,
				});
			} else {
				setStatus({
					connected: false,
					syncEnabled: false,
					isLoading: false,
					error: result.error || "Failed to check calendar status",
				});
			}
		} catch (error) {
			console.error("Error checking calendar status:", error);
			setStatus({
				connected: false,
				syncEnabled: false,
				isLoading: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsRefreshing(false);
		}
	}, [userId]);

	const toggleSync = useCallback(async () => {
		if (!userId) return;

		try {
			const { error } = await supabase
				.from("profiles")
				.update({ calendar_sync_enabled: !status.syncEnabled })
				.eq("id", userId);

			if (error) throw error;

			setStatus((prev) => ({
				...prev,
				syncEnabled: !prev.syncEnabled,
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
		window.location.href = "/api/auth/google-calendar";
	}, []);

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
		refreshStatus,
	};
}
