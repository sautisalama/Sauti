"use client";

import { useEffect } from "react";
import { getOrCreateDeviceId } from "@/lib/user-settings";

/**
 * Invisible component that ensures a device ID is generated and 
 * stored in a cookie as soon as the user visits the site.
 * This ensures the ID is available for server-side auth registration.
 */
export function DeviceInitializer() {
	useEffect(() => {
		getOrCreateDeviceId();
	}, []);

	return null;
}
