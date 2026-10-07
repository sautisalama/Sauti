"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
		isLoading: false,
	});
	const [isRefreshing, setIsRefreshing] = useState(false);
	const supabase = useMemo(() => createClient(), []);

	const checkCalendarStatus = useCallback(async () => {
		if (!userId) return;

		setIsRefreshing(true);
		try {
			const [{ data: profile, error }, { data: conn }] = await Promise.all([
				supabase.from("profiles").select("calendar_sync_enabled").eq("id", userId).single(),
				supabase.rpc("get_calendar_connection"),
			]);

			if (error) {
				setStatus({ connected: false, syncEnabled: false, isLoading: false, error: undefined });
				return;
			}

			const connection = Array.isArray(conn) ? conn[0] : conn;
			const hasValidTokens = !!connection?.connected;

			setStatus({
				connected: hasValidTokens,
				syncEnabled: profile?.calendar_sync_enabled ?? false,
				lastSync: undefined,
				tokenExpiry: hasValidTokens ? (connection?.expiry_date ?? undefined) : undefined,
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
			const { error: rpcError } = await supabase.rpc("disconnect_calendar");
			if (rpcError) throw rpcError;
			const { error } = await supabase.from("profiles").update({ calendar_sync_enabled: false }).eq("id", userId);

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
