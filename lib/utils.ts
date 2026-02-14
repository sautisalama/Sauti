import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parses a Supabase Json value into an array.
 * Supabase returns Json as object/array if already parsed, or string if raw.
 */
export function safelyParseJsonArray<T = any>(value: any): T[] {
	if (value === null || value === undefined) return [];
	if (Array.isArray(value)) return value;
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? (parsed as T[]) : [parsed as T];
		} catch {
			return [];
		}
	}
	return [value as T];
}
