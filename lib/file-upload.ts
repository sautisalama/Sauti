import { createClient } from "@/utils/supabase/client";
import { Database } from "@/types/db-schema";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

export interface FileUploadOptions {
	userId: string;
	userType: UserType;
	serviceId?: string;
	serviceType?: SupportServiceType;
	fileType: "accreditation" | "profile" | "report";
	fileName: string;
	file: File;
}

export interface UploadedFile {
	url: string;
	fileName: string;
	filePath: string;
	uploadedAt: string;
	serviceId?: string;
	serviceType?: SupportServiceType;
}

export class FileUploadError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "FileUploadError";
	}
}

export class FileUploadService {
	private supabase = createClient();

	// Allowed file types and their MIME types
	private readonly ALLOWED_FILE_TYPES = {
		accreditation: [
			"application/pdf",
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		],
		profile: ["image/jpeg", "image/png", "image/webp", "image/gif"],
		report: [
			"image/jpeg",
			"image/png",
			"image/webp",
			"audio/webm",
			"audio/mp4",
			"audio/wav",
			"audio/ogg",
			"audio/mpeg",
		],
	};

	// File size limits (in bytes)
	private readonly FILE_SIZE_LIMITS = {
		accreditation: 10 * 1024 * 1024, // 10MB
		profile: 5 * 1024 * 1024, // 5MB
		report: 50 * 1024 * 1024, // 50MB
	};

	/**
	 * Validates file before upload
	 */
	private validateFile(
		file: File,
		fileType: FileUploadOptions["fileType"]
	): void {
		// Check file size
		const maxSize = this.FILE_SIZE_LIMITS[fileType];
		if (file.size > maxSize) {
			throw new FileUploadError(
				`File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`,
				"FILE_TOO_LARGE"
			);
		}

		// Check file type
		const allowedTypes = this.ALLOWED_FILE_TYPES[fileType];
		if (!allowedTypes.includes(file.type)) {
			throw new FileUploadError(
				`File type ${file.type} is not allowed for ${fileType} uploads`,
				"INVALID_FILE_TYPE"
			);
		}

		// Check for potentially dangerous file names
		const dangerousPatterns = /[<>:"/\\|?*]/;
		const hasControlChars = Array.from(file.name).some((char) => {
			const code = char.charCodeAt(0);
			return code >= 0 && code <= 31; // Control characters 0x00-0x1f
		});
		if (dangerousPatterns.test(file.name) || hasControlChars) {
			throw new FileUploadError(
				"File name contains invalid characters",
				"INVALID_FILE_NAME"
			);
		}
	}

	/**
	 * Generates a secure file path based on user and service
	 */
	private generateFilePath(options: FileUploadOptions): string {
		const { userId, userType, serviceId, serviceType, fileType, fileName } =
			options;

		// Sanitize file name
		const sanitizedFileName = fileName
			.replace(/[^a-zA-Z0-9.-]/g, "_")
			.toLowerCase();

		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		const fileExt = sanitizedFileName.split(".").pop();
		const baseFileName = sanitizedFileName.replace(/\.[^/.]+$/, "");
		const finalFileName = `${baseFileName}_${timestamp}_${randomSuffix}.${fileExt}`;

		// Build path based on user type (fileType is already the bucket name)
		// Ensure userId is properly formatted as UUID
		const formattedUserId = userId.toString();
		let path = `${formattedUserId}`;

		// For NGO users with multiple services, add service-specific folders
		if (userType === "ngo" && serviceId && serviceType) {
			path += `/${serviceType}/${serviceId}`;
		}

		return `${path}/${finalFileName}`;
	}

	/**
	 * Determines the appropriate bucket for the file type
	 */
	private getBucketName(fileType: FileUploadOptions["fileType"]): string {
		switch (fileType) {
			case "accreditation":
				return "accreditation-files";
			case "profile":
				return "profile-images";
			case "report":
				return "report-media";
			default:
				throw new FileUploadError("Invalid file type", "INVALID_FILE_TYPE");
		}
	}

	/**
	 * Uploads a file with proper organization and validation
	 */
	async uploadFile(options: FileUploadOptions): Promise<UploadedFile> {
		try {
			// Validate file
			this.validateFile(options.file, options.fileType);

			// Generate file path
			const filePath = this.generateFilePath(options);
			const bucketName = this.getBucketName(options.fileType);

			// Debug logging
			console.log("Upload details:", {
				userId: options.userId,
				userType: options.userType,
				filePath,
				bucketName,
				fileName: options.fileName,
			});

			// Check authentication
			const {
				data: { user },
				error: authError,
			} = await this.supabase.auth.getUser();
			if (authError || !user) {
				throw new FileUploadError("User not authenticated", "AUTH_ERROR");
			}
			console.log("Auth check:", {
				authUserId: user.id,
				expectedUserId: options.userId,
				userIdMatch: user.id === options.userId,
				filePath,
				folderName: filePath.split("/")[0],
			});

			// Upload to Supabase Storage
			const { error: uploadError } = await this.supabase.storage
				.from(bucketName)
				.upload(filePath, options.file, {
					contentType: options.file.type,
					cacheControl: "3600",
					upsert: false,
				});

			if (uploadError) {
				throw new FileUploadError(
					`Upload failed: ${uploadError.message}`,
					uploadError.message.includes("already exists")
						? "FILE_EXISTS"
						: "UPLOAD_FAILED"
				);
			}

			// Get public URL
			const { data: urlData } = this.supabase.storage
				.from(bucketName)
				.getPublicUrl(filePath);

			if (!urlData?.publicUrl) {
				throw new FileUploadError(
					"Failed to generate public URL",
					"URL_GENERATION_FAILED"
				);
			}

			return {
				url: urlData.publicUrl,
				fileName: options.fileName,
				filePath,
				uploadedAt: new Date().toISOString(),
				serviceId: options.serviceId,
				serviceType: options.serviceType,
			};
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`Upload failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"UPLOAD_FAILED"
			);
		}
	}

	/**
	 * Deletes a file from storage
	 */
	async deleteFile(
		filePath: string,
		fileType: FileUploadOptions["fileType"]
	): Promise<void> {
		try {
			const bucketName = this.getBucketName(fileType);

			const { error } = await this.supabase.storage
				.from(bucketName)
				.remove([filePath]);

			if (error) {
				throw new FileUploadError(
					`Delete failed: ${error.message}`,
					"DELETE_FAILED"
				);
			}
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`Delete failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"DELETE_FAILED"
			);
		}
	}

	/**
	 * Lists files for a user in a specific folder
	 */
	async listUserFiles(
		userId: string,
		fileType: FileUploadOptions["fileType"],
		serviceId?: string
	): Promise<UploadedFile[]> {
		try {
			const bucketName = this.getBucketName(fileType);
			let folderPath = `${fileType}/${userId}`;

			if (serviceId) {
				folderPath += `/${serviceId}`;
			}

			const { data, error } = await this.supabase.storage
				.from(bucketName)
				.list(folderPath, {
					limit: 100,
					offset: 0,
				});

			if (error) {
				throw new FileUploadError(`List failed: ${error.message}`, "LIST_FAILED");
			}

			return (data || []).map((file) => ({
				url: this.supabase.storage
					.from(bucketName)
					.getPublicUrl(`${folderPath}/${file.name}`).data.publicUrl,
				fileName: file.name,
				filePath: `${folderPath}/${file.name}`,
				uploadedAt: file.created_at || new Date().toISOString(),
			}));
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`List failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				"LIST_FAILED"
			);
		}
	}

	/**
	 * Validates service type compatibility for NGO users
	 */
	static validateServiceCompatibility(
		existingServices: SupportServiceType[],
		newServiceType: SupportServiceType,
		userType: UserType
	): { valid: boolean; reason?: string } {
		// Only NGO users can have multiple services
		if (userType !== "ngo" && existingServices.length > 0) {
			return {
				valid: false,
				reason: "Only NGO users can create multiple services",
			};
		}

		// For NGO users, check if they're trying to create services in related fields
		if (userType === "ngo" && existingServices.length > 0) {
			const relatedFields = {
				legal: ["legal"],
				medical: ["medical", "mental_health"],
				mental_health: ["medical", "mental_health"],
				shelter: ["shelter", "financial_assistance"],
				financial_assistance: ["shelter", "financial_assistance"],
				other: ["other"],
			};

			const existingFieldGroups = existingServices
				.map((service) =>
					Object.keys(relatedFields).find((field) =>
						relatedFields[field as keyof typeof relatedFields].includes(service)
					)
				)
				.filter(Boolean);

			const newFieldGroup = Object.keys(relatedFields).find((field) =>
				relatedFields[field as keyof typeof relatedFields].includes(newServiceType)
			);

			// Check if new service is in a different field group
			if (newFieldGroup && existingFieldGroups.includes(newFieldGroup)) {
				return {
					valid: false,
					reason: `Cannot create ${newServiceType} service - you already have services in the ${newFieldGroup} field`,
				};
			}
		}

		return { valid: true };
	}
}

// Export singleton instance
export const fileUploadService = new FileUploadService();
