/**
 * Media handling utilities for voice recordings and file uploads
 */

export interface MediaFile {
	title: string;
	url: string;
	type: string;
	size: number;
	uploadedAt?: string;
}

export interface AudioUploadResult {
	success: boolean;
	media?: MediaFile;
	error?: string;
}

/**
 * Validates audio blob before upload
 */
export function validateAudioBlob(blob: Blob): {
	valid: boolean;
	error?: string;
} {
	if (!blob) {
		return { valid: false, error: "No audio data provided" };
	}

	if (blob.size === 0) {
		return { valid: false, error: "Audio file is empty" };
	}

	// Check file size (max 50MB)
	const maxSize = 50 * 1024 * 1024; // 50MB
	if (blob.size > maxSize) {
		return { valid: false, error: "Audio file is too large (max 50MB)" };
	}

	// Check MIME type
	const allowedTypes = ["audio/webm", "audio/mp4", "audio/wav", "audio/ogg"];
	if (!allowedTypes.includes(blob.type)) {
		return { valid: false, error: "Unsupported audio format" };
	}

	return { valid: true };
}

/**
 * Generates a unique filename for audio uploads
 */
export function generateAudioFilename(blob: Blob): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).slice(2);
	const extension = blob.type.split("/")[1] || "webm";
	return `reports/${timestamp}-${random}.${extension}`;
}

/**
 * Creates a media object from uploaded audio
 */
export function createAudioMediaObject(
	url: string,
	blob: Blob,
	title: string = "Voice Recording"
): MediaFile {
	return {
		title,
		url,
		type: blob.type || "audio/webm",
		size: blob.size,
		uploadedAt: new Date().toISOString(),
	};
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Checks if a URL is a valid Supabase storage URL
 */
export function isValidStorageUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return (
			urlObj.hostname.includes("supabase") || urlObj.hostname.includes("storage")
		);
	} catch {
		return false;
	}
}
