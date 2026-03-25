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
	device_type?: string; // e.g. "mobile", "tablet", "desktop"
	device_model?: string; // e.g. "Xiaomi Redmi Note 10"
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
 * Detect browser, OS, and device type/model info from User-Agent and client hints.
 * Supports both client-side and server-side execution.
 */
export function detectDeviceInfo(
	userAgent?: string, 
	screenHint?: { width: number; height: number }
): {
	device_name: string;
	browser: string;
	os: string;
	device_type: "mobile" | "tablet" | "desktop" | "unknown";
	device_model: string;
	location: string;
} {
	const ua = userAgent || (typeof window !== "undefined" ? navigator.userAgent : "");
	const screen = screenHint || (typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : undefined);
	
	if (!ua) {
		return { 
			device_name: "Unknown", 
			browser: "Unknown", 
			os: "Unknown", 
			device_type: "unknown",
			device_model: "Unknown",
			location: "Unknown" 
		};
	}

	// 1. Detect Browser
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

	// 2. Detect OS & Specific Model
	let os = "Unknown OS";
	let device_model = "Unknown Device";
	let device_type: "mobile" | "tablet" | "desktop" | "unknown" = "unknown";

	// Check for Mobile/Tablet first
	if (ua.includes("Android")) {
		os = "Android";
		device_type = "mobile";
		// Try to extract model: "Android 10; SM-G991B" -> "SM-G991B"
		const modelMatch = ua.match(/Android [^;]+; ([^;)]+)/);
		if (modelMatch) device_model = modelMatch[1].trim();
		
		// Refine device type if it's a tablet
		if (ua.includes("Tablet") || (screen && screen.width >= 600 && screen.width < 1024)) {
			device_type = "tablet";
		}
	} else if (ua.includes("iPhone")) {
		os = "iOS";
		device_model = "iPhone";
		device_type = "mobile";
	} else if (ua.includes("iPad")) {
		os = "iOS";
		device_model = "iPad";
		device_type = "tablet";
	} else if (ua.includes("Windows NT")) {
		os = "Windows";
		device_type = "desktop";
		if (ua.includes("Windows NT 10.0") || ua.includes("Windows NT 11.0")) os = "Windows 10/11";
		device_model = "PC";
	} else if (ua.includes("Mac OS X")) {
		os = "macOS";
		device_type = "desktop";
		device_model = "Mac";
	} else if (ua.includes("Linux")) {
		os = "Linux";
		device_type = "desktop";
		device_model = "Generic Linux";
	}

	// 3. Brand specific detection (Grep for common brands in UA)
	const brands = ["Samsung", "Xiaomi", "Redmi", "Huawei", "Oppo", "Vivo", "Pixel", "OnePlus", "Infinix", "Tecno"];
	for (const brand of brands) {
		if (ua.toLowerCase().includes(brand.toLowerCase())) {
			if (device_model === "Unknown Device" || device_model === "Android") {
				// Extract a bit more context if it's a brand match
				const brandRegex = new RegExp(`${brand}[^;)]+`, "i");
				const match = ua.match(brandRegex);
				if (match) device_model = match[0];
				else device_model = brand;
			}
			break;
		}
	}

	// 4. Heuristic for Laptop vs Desktop (hard, but we can guess)
	if (device_type === "desktop" && screen && screen.width < 1600) {
		// Most desktops are 1920+, laptops are often 1366 or 1440
		// This is a loose guess
		device_model = `${os} Laptop`;
	} else if (device_type === "desktop") {
		device_model = `${os} Desktop`;
	}

	// Final Name Construction
	const device_name = device_model !== "Unknown Device" 
		? `${device_model} (${browser})` 
		: `${browser} on ${os}`;

	// Derive approximate location from timezone
	let location = "Unknown";
	try {
		const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
		if (tz) {
			const parts = tz.split("/");
			location = parts[parts.length - 1].replace(/_/g, " ");
		}
	} catch {
		// Ignore
	}

	return { device_name, browser, os, device_type, device_model, location };
}

/**
 * Build a TrackedDevice object for the current session.
 */
export function buildCurrentDevice(
	deviceId: string, 
	userAgent?: string,
	screenHint?: { width: number; height: number }
): TrackedDevice {
	const info = detectDeviceInfo(userAgent, screenHint);
	return {
		id: deviceId,
		device_name: info.device_name,
		browser: info.browser,
		os: info.os,
		device_type: info.device_type,
		device_model: info.device_model,
		last_active: new Date().toISOString(),
		is_current: true,
		location: info.location,
	};
}

/**
 * Register a device in a devices list.
 * If the device already exists (by id), update last_active.
 * Also marks only the registration device as is_current.
 * 
 * Returns updated devices array.
 */
export function registerDevice(
	existingDevices: TrackedDevice[] | undefined | null,
	deviceId: string,
	userAgent?: string,
	screenHint?: { width: number; height: number }
): TrackedDevice[] {
	const current = buildCurrentDevice(deviceId, userAgent, screenHint);
	const devices = (existingDevices || []).map((d) => ({ ...d, is_current: false }));

	const existingIdx = devices.findIndex((d) => d.id === current.id);
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
			if (a.id === deviceId) return -1;
			if (b.id === deviceId) return 1;
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
