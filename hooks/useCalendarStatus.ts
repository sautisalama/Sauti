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
			// Calendar integration is now optional - always return available status
			setStatus({
				connected: true,
				syncEnabled: false,
				lastSync: undefined,
				tokenExpiry: undefined,
				calendarsCount: 0,
				isLoading: false,
				error: undefined,
			});
		} catch (error) {
			console.error("Error checking calendar status:", error);
			setStatus({
				connected: true,
				syncEnabled: false,
				isLoading: false,
				error: undefined,
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
		// Calendar integration is now optional - show info message
		console.log("Calendar integration is optional and can be enabled later");
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
