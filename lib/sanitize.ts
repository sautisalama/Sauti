const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_RE = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const SQL_INJECTION_RE = /(\b(union|select|insert|update|delete|drop|alter|exec|execute|xp_|sp_)\b.*?\b(from|into|where|table|database|set)\b)/gi;

export function sanitizeString(input: unknown): string {
	if (typeof input !== "string") return "";
	let cleaned = input;
	cleaned = cleaned.replace(SCRIPT_RE, "");
	cleaned = cleaned.replace(HTML_TAG_RE, "");
	cleaned = cleaned.replace(EVENT_HANDLER_RE, "");
	return cleaned.trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(
	obj: T,
	stringFields: (keyof T)[]
): T {
	const result = { ...obj };
	for (const field of stringFields) {
		if (typeof result[field] === "string") {
			(result as Record<string, unknown>)[field as string] = sanitizeString(result[field]);
		}
	}
	return result;
}

export function containsSqlInjection(input: string): boolean {
	return SQL_INJECTION_RE.test(input);
}

export function validateEnumValue<T extends string>(
	value: unknown,
	allowed: readonly T[]
): T | null {
	if (typeof value !== "string") return null;
	return allowed.includes(value as T) ? (value as T) : null;
}

export function validateReportPayload(data: Record<string, unknown>): {
	valid: boolean;
	errors: string[];
	sanitized: Record<string, unknown>;
} {
	const errors: string[] = [];
	const sanitized: Record<string, unknown> = {};

	const URGENCY_VALUES = ["high", "medium", "low"] as const;
	const INCIDENT_TYPES = [
		"physical", "emotional", "sexual", "financial",
		"child_abuse", "child_labor", "neglect", "trafficking",
		"stalking", "cyber", "racial", "other",
	] as const;
	const CONSENT_VALUES = ["yes", "no"] as const;

	sanitized.first_name = sanitizeString(data.first_name) || "Anonymous";
	sanitized.last_name = sanitizeString(data.last_name) || null;
	sanitized.incident_description = sanitizeString(data.incident_description);

	if (sanitized.incident_description && containsSqlInjection(sanitized.incident_description as string)) {
		errors.push("Description contains potentially unsafe content");
	}

	const incidentType = validateEnumValue(data.type_of_incident, INCIDENT_TYPES);
	if (!incidentType) {
		errors.push("Invalid incident type");
	}
	sanitized.type_of_incident = incidentType || "other";

	const urgency = validateEnumValue(data.urgency, URGENCY_VALUES);
	if (!urgency) {
		errors.push("Invalid urgency level");
	}
	sanitized.urgency = urgency || "medium";

	const consent = validateEnumValue(data.consent, CONSENT_VALUES);
	sanitized.consent = consent || null;

	if (data.email && typeof data.email === "string") {
		const email = sanitizeString(data.email);
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.push("Invalid email format");
		}
		sanitized.email = email || null;
	} else {
		sanitized.email = null;
	}

	if (data.phone && typeof data.phone === "string") {
		sanitized.phone = sanitizeString(data.phone);
	} else {
		sanitized.phone = null;
	}

	if (typeof data.latitude === "number" && data.latitude >= -90 && data.latitude <= 90) {
		sanitized.latitude = data.latitude;
	} else {
		sanitized.latitude = null;
	}

	if (typeof data.longitude === "number" && data.longitude >= -180 && data.longitude <= 180) {
		sanitized.longitude = data.longitude;
	} else {
		sanitized.longitude = null;
	}

	if (data.password && typeof data.password === "string") {
		if (data.password.length < 6) {
			errors.push("Password must be at least 6 characters");
		}
		if (data.password.length > 128) {
			errors.push("Password exceeds maximum length");
		}
		sanitized.password = data.password;
	} else {
		sanitized.password = null;
	}

	sanitized.consent = sanitized.consent;
	sanitized.contact_preference = sanitizeString(data.contact_preference) || "do_not_contact";
	sanitized.submission_timestamp = new Date().toISOString();
	sanitized.media = data.media || null;
	sanitized.is_onBehalf = !!data.is_onBehalf;
	sanitized.record_only = !!data.record_only;
	sanitized.is_workplace_incident = !!data.is_workplace_incident;
	sanitized.additional_info = data.additional_info || null;
	sanitized.required_services = Array.isArray(data.required_services) ? data.required_services : [];

	return {
		valid: errors.length === 0,
		errors,
		sanitized,
	};
}
