"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import {
	parseSettings,
	registerDevice,
	getOrCreateDeviceId,
} from "@/lib/user-settings";

/**
 * Invisible component that registers the current device in the user's
 * settings.devices array on dashboard load.
 * 
 * It runs once per session (using a sessionStorage flag) and only if
 * device tracking is enabled.
 */
export function DeviceRegistration() {
	const dash = useDashboardData();
	const userId = dash?.data?.userId;
	const profile = dash?.data?.profile;
	const hasRun = useRef(false);

	useEffect(() => {
		if (!userId || !profile || hasRun.current) return;

		const settings = parseSettings(profile.settings);
		const currentDeviceId = getOrCreateDeviceId();
		const currentDevices = (profile.devices as any[]) || [];

		// check if authorized
		if (settings.device_tracking_enabled && currentDevices.length > 0) {
			const isAuthorized = currentDevices.some(d => d.id === currentDeviceId);
			if (!isAuthorized) {
				console.warn("This device has been revoked. Logging out.");
				const supabase = createClient();
				supabase.auth.signOut().then(() => {
					window.location.href = "/signin?reason=session_revoked";
				});
				return;
			}
		}

		// Only run registration once per browser session
		const sessionKey = `ss_device_registered_${userId}`;
		if (sessionStorage.getItem(sessionKey)) return;

		// If device tracking is disabled, skip
		if (settings.device_tracking_enabled === false) return;

		// Only register if device is new or if the session hasn't registered yet
		const updatedDevices = registerDevice(currentDevices);

		const supabase = createClient();

		supabase
			.from("profiles")
			.update({ devices: updatedDevices as any })
			.eq("id", userId)
			.then(({ error }) => {
				if (!error) {
					// Mark this session as registered
					sessionStorage.setItem(sessionKey, "1");
					hasRun.current = true;

					// Update the provider so the settings page shows updated data
					if (dash && profile) {
						dash.updatePartial({
							profile: {
								...profile,
								devices: updatedDevices as any,
							},
						});
					}
				}
			});
	}, [userId, profile, dash]);

	return null;
}
