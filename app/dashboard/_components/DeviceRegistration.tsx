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
					// Mark this session as registered (and remember on this device that it was, so a later removal can be noticed)
					sessionStorage.setItem(sessionKey, "1");
					try { localStorage.setItem(`ss_device_known_${userId}`, "1"); } catch { /* private mode */ }
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

	// "Revoke" in Privacy & Security removes a device from the list. A device that finds itself missing
	// signs out, so revoking actually ends that session (checked when the app opens or regains focus).
	useEffect(() => {
		if (!userId) return;
		let stopped = false;
		const supabase = createClient();
		const check = async () => {
			try {
				if (localStorage.getItem(`ss_device_known_${userId}`) !== "1") return;
				const { data } = await supabase.from("profiles").select("devices, settings").eq("id", userId).maybeSingle();
				if (stopped || !data) return;
				if (parseSettings(data.settings).device_tracking_enabled === false) return;
				const list = Array.isArray(data.devices) ? (data.devices as { id?: string }[]) : [];
				if (list.length && !list.some((d) => d.id === getOrCreateDeviceId())) {
					await supabase.auth.signOut();
					try { localStorage.removeItem(`ss_device_known_${userId}`); } catch { /* ignore */ }
					window.location.replace("/signin?reason=signed-out-remotely");
				}
			} catch { /* never block the app on this */ }
		};
		const onVisible = () => document.visibilityState === "visible" && check();
		const t = window.setTimeout(check, 4000);
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", check);
		return () => { stopped = true; window.clearTimeout(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", check); };
	}, [userId]);

	return null;
}
