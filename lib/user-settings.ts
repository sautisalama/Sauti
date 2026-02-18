/**
 * Unified User Settings utilities
 * 
 * All user preferences are stored in the `settings` JSONB column of the `profiles` table.
 * This module defines the canonical shape and provides safe merge utilities so that
 * different features (policies, device tracking, privacy, notifications) can coexist
 * without accidentally overwriting each other.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface TrackedDevice {
	id: string;           // unique per-device fingerprint (browser-generated UUID)
	device_name: string;  // e.g. "Chrome on Windows"
	browser: string;      // e.g. "Chrome 120"
	os: string;           // e.g. "Windows 11"
	last_active: string;  // ISO timestamp
	ip_hint?: string;     // partial IP for location hint (e.g. "102.x.x.x")
	is_current: boolean;  // true for the device making the request
	location?: string;    // e.g. "Nairobi, KE" (derived from timezone/locale)
}

export interface UserPolicies {
	accepted_policies: string[];           // e.g. ["terms", "privacy", "survivor_safety"]
	all_policies_accepted: boolean;
	policies_accepted_at?: string;          // ISO timestamp
}

export interface UserSettings {
	// ── Device Tracking ──
	device_tracking_enabled?: boolean;      // user can opt out
	// Note: `devices` array has been moved to its own column in the database

	// ── Privacy & Security ──
	two_factor_enabled?: boolean;
	login_alerts_enabled?: boolean;
	public_profile?: boolean;
	data_sharing_enabled?: boolean;

	// ── Notification Preferences ──
	email_notifications?: boolean;
	push_notifications?: boolean;

	// Extensible — allows future additions without schema changes
	[key: string]: any;
}

// ── Defaults ───────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: UserSettings = {
	device_tracking_enabled: true,
	two_factor_enabled: false,
	login_alerts_enabled: true,
	public_profile: true,
	data_sharing_enabled: false,
	email_notifications: true,
	push_notifications: true,
};

export const DEFAULT_POLICIES: UserPolicies = {
	accepted_policies: [],
	all_policies_accepted: false,
};

// ── Utilities ──────────────────────────────────────────────────────────

/**
 * Safely parse the raw settings JSONB value from the database.
 * Returns a typed UserSettings object merged with defaults.
 */
export function parseSettings(raw: unknown): UserSettings {
	if (!raw || typeof raw !== "object") {
		return { ...DEFAULT_SETTINGS };
	}
	return { ...DEFAULT_SETTINGS, ...(raw as Record<string, any>) };
}

/**
 * Merge a partial update into existing settings without losing other keys.
 * This is the ONLY recommended way to build the update payload.
 */
export function mergeSettings(
	existing: unknown,
	patch: Partial<UserSettings>
): UserSettings {
	const current = parseSettings(existing);
	return { ...current, ...patch };
}

/**
 * Safely parse the raw policies JSONB value.
 */
export function parsePolicies(raw: unknown): UserPolicies {
	if (!raw || typeof raw !== "object") {
		return { ...DEFAULT_POLICIES };
	}
	const parsed = raw as Record<string, any>;
	return {
		accepted_policies: Array.isArray(parsed.accepted_policies) ? parsed.accepted_policies : [],
		all_policies_accepted: !!parsed.all_policies_accepted,
		policies_accepted_at: parsed.policies_accepted_at,
	};
}

/**
 * Generate a stable device fingerprint for the current browser.
 * Uses a localStorage-persisted UUID so the same browser always returns the same ID.
 * Also persists to a cookie so the ID is available server-side for session validation.
 */
export function getOrCreateDeviceId(): string {
	if (typeof window === "undefined") return "server";

	const STORAGE_KEY = "ss_device_id";
	let id = localStorage.getItem(STORAGE_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, id);
	}

	// Always ensure cookie is synced for server-side access (middleware/server actions)
	// Expires in 1 year
	if (document.cookie.indexOf(`${STORAGE_KEY}=`) === -1 || !document.cookie.includes(id)) {
		document.cookie = `${STORAGE_KEY}=${id}; path=/; max-age=${
			60 * 60 * 24 * 365
		}; SameSite=Lax`;
	}

	return id;
}

/**
 * Detect browser and OS info from User-Agent for device display.
 */
export function detectDeviceInfo(): { device_name: string; browser: string; os: string; location: string } {
	if (typeof window === "undefined") {
		return { device_name: "Unknown", browser: "Unknown", os: "Unknown", location: "Unknown" };
	}

	const ua = navigator.userAgent;

	// Detect browser
	let browser = "Unknown Browser";
	if (ua.includes("Edg/")) {
		const match = ua.match(/Edg\/([\d.]+)/);
		browser = `Edge ${match?.[1]?.split(".")[0] || ""}`;
	} else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
		const match = ua.match(/Chrome\/([\d.]+)/);
		browser = `Chrome ${match?.[1]?.split(".")[0] || ""}`;
	} else if (ua.includes("Firefox/")) {
		const match = ua.match(/Firefox\/([\d.]+)/);
		browser = `Firefox ${match?.[1]?.split(".")[0] || ""}`;
	} else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
		const match = ua.match(/Version\/([\d.]+)/);
		browser = `Safari ${match?.[1]?.split(".")[0] || ""}`;
	}

	// Detect OS
	let os = "Unknown OS";
	if (ua.includes("Windows NT 10")) os = "Windows";
	else if (ua.includes("Windows NT 11") || (ua.includes("Windows NT 10") && ua.includes("Win64"))) os = "Windows";
	else if (ua.includes("Mac OS X")) os = "macOS";
	else if (ua.includes("Android")) os = "Android";
	else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
	else if (ua.includes("Linux")) os = "Linux";
	else if (ua.includes("CrOS")) os = "Chrome OS";

	const device_name = `${browser} on ${os}`;

	// Derive approximate location from timezone
	let location = "Unknown";
	try {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (tz) {
			// e.g. "Africa/Nairobi" → "Nairobi"
			const parts = tz.split("/");
			location = parts[parts.length - 1].replace(/_/g, " ");
		}
	} catch {
		// Ignore
	}

	return { device_name, browser, os, location };
}

/**
 * Build a TrackedDevice object for the current browser session.
 */
export function buildCurrentDevice(): TrackedDevice {
	const info = detectDeviceInfo();
	return {
		id: getOrCreateDeviceId(),
		device_name: info.device_name,
		browser: info.browser,
		os: info.os,
		last_active: new Date().toISOString(),
		is_current: true,
		location: info.location,
	};
}

/**
 * Register the current device in a devices list.
 * If the device already exists (by id), update last_active.
 * Also marks only the current device as is_current.
 * 
 * Returns updated devices array.
 */
export function registerDevice(existingDevices: TrackedDevice[] | undefined | null): TrackedDevice[] {
	const current = buildCurrentDevice();
	const devices = (existingDevices || []).map(d => ({ ...d, is_current: false }));

	const existingIdx = devices.findIndex(d => d.id === current.id);
	if (existingIdx >= 0) {
		// Update existing
		devices[existingIdx] = {
			...devices[existingIdx],
			...current,
		};
	} else {
		devices.push(current);
	}

	// Keep max 10 devices, remove oldest inactive ones
	if (devices.length > 10) {
		const sorted = devices.sort((a, b) => {
			if (a.is_current) return -1;
			if (b.is_current) return 1;
			return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
		});
		return sorted.slice(0, 10);
	}

	return devices;
}

/**
 * Remove a device by ID from the devices list.
 * Returns updated devices array.
 */
export function removeDevice(devices: TrackedDevice[] | undefined | null, deviceId: string): TrackedDevice[] {
	return (devices || []).filter(d => d.id !== deviceId);
}

/**
 * Get relative time string for a timestamp.
 */
export function getRelativeTime(timestamp: string): string {
	const now = new Date();
	const then = new Date(timestamp);
	const diffMs = now.getTime() - then.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes} min ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return then.toLocaleDateString();
}
