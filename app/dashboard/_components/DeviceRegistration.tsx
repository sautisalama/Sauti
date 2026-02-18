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

		// Registration logic
		const sessionKey = `ss_device_registered_${userId}`;
		if (sessionStorage.getItem(sessionKey)) return;

		// If device tracking is disabled, skip
		if (settings.device_tracking_enabled === false) return;

		// Update or register the device
		const updatedDevices = registerDevice(currentDevices, currentDeviceId);

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
