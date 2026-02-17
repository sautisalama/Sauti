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
	// Additional metadata fields
	title?: string;
	certificateNumber?: string;
	fileType?: string;
	fileSize?: number;
	status?: string;
	notes?: string;
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

	// File size limits (in bytes) - Client side check removed as per user request
	/*private readonly FILE_SIZE_LIMITS = {
		accreditation: 10 * 1024 * 1024, // 10MB
		profile: 5 * 1024 * 1024, // 5MB
		report: 50 * 1024 * 1024, // 50MB
	};*/

	/**
	 * Validates file before upload
	 */
	private validateFile(
		file: File,
		fileType: FileUploadOptions["fileType"]
	): void {
		// Check file size - Disabled to let Supabase Storage buckets handle limits
		/*const maxSize = this.FILE_SIZE_LIMITS[fileType];
		if (file.size > maxSize) {
			throw new FileUploadError(
				`File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`,
				"FILE_TOO_LARGE"
			);
		}*/

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
	 * Deletes a document and removes it from metadata
	 */
	async deleteDocument(
		userId: string,
		documentUrl: string,
		fileType: FileUploadOptions["fileType"] = "accreditation",
		serviceId?: string
	): Promise<void> {
		try {
			// Extract file path from URL
			const url = new URL(documentUrl);
			const pathParts = url.pathname.split("/");
			const bucketName = this.getBucketName(fileType);

			// Find the file path after the bucket name
			const bucketIndex = pathParts.findIndex((part) => part === bucketName);
			if (bucketIndex === -1) {
				throw new FileUploadError("Invalid file URL", "INVALID_URL");
			}

			const filePath = pathParts.slice(bucketIndex + 1).join("/");

			// Delete file from storage
			await this.deleteFile(filePath, fileType);

			// Remove from metadata
			if (serviceId) {
				// Remove from service metadata
				await this.removeFromServiceMetadata(userId, serviceId, documentUrl);
			} else {
				// Remove from profile metadata
				await this.removeFromProfileMetadata(userId, documentUrl);
			}
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`Delete document failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"DELETE_DOCUMENT_FAILED"
			);
		}
	}

	/**
	 * Removes document from profile metadata
	 */
	private async removeFromProfileMetadata(
		userId: string,
		documentUrl: string
	): Promise<void> {
		try {
			const { data: profileData } = await this.supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			const metadataDocs = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata)
				: [];

			// Filter out the document with the matching URL
			const updatedDocs = metadataDocs.filter(
				(doc: any) => doc.url !== documentUrl
			);

			// Update the profile with the filtered documents
			const { error } = await this.supabase
				.from("profiles")
				.update({
					accreditation_files_metadata: updatedDocs,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) {
				throw new FileUploadError(
					`Failed to update profile metadata: ${error.message}`,
					"UPDATE_METADATA_FAILED"
				);
			}
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`Remove from profile metadata failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"REMOVE_METADATA_FAILED"
			);
		}
	}

	/**
	 * Removes document from service metadata
	 */
	private async removeFromServiceMetadata(
		userId: string,
		serviceId: string,
		documentUrl: string
	): Promise<void> {
		try {
			const { data: serviceData } = await this.supabase
				.from("support_services")
				.select("accreditation_files_metadata")
				.eq("id", serviceId)
				.eq("user_id", userId)
				.single();

			const metadataDocs = serviceData?.accreditation_files_metadata
				? Array.isArray(serviceData.accreditation_files_metadata)
					? serviceData.accreditation_files_metadata
					: JSON.parse(serviceData.accreditation_files_metadata)
				: [];

			// Filter out the document with the matching URL
			const updatedDocs = metadataDocs.filter(
				(doc: any) => doc.url !== documentUrl
			);

			// Update the service with the filtered documents
			const { error } = await this.supabase
				.from("support_services")
				.update({
					accreditation_files_metadata: updatedDocs,
					updated_at: new Date().toISOString(),
				})
				.eq("id", serviceId)
				.eq("user_id", userId);

			if (error) {
				throw new FileUploadError(
					`Failed to update service metadata: ${error.message}`,
					"UPDATE_SERVICE_METADATA_FAILED"
				);
			}
		} catch (error) {
			if (error instanceof FileUploadError) {
				throw error;
			}
			throw new FileUploadError(
				`Remove from service metadata failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"REMOVE_SERVICE_METADATA_FAILED"
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
			let folderPath = `${userId}`;

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
	 * Gets all documents for a user, combining metadata and files from storage
	 */
	async getAllUserDocuments(
		userId: string,
		fileType: FileUploadOptions["fileType"] = "accreditation"
	): Promise<UploadedFile[]> {
		try {
			// Get files from storage (only from the root user folder, not service subfolders)
			const storageFiles = await this.listUserFiles(userId, fileType);

			// Get metadata from profile
			const { data: profileData } = await this.supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			const metadataDocs = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata)
				: [];

			// Filter out service-specific documents from metadata
			// Only include documents that don't have a serviceId (accreditation documents)
			const accreditationDocs = metadataDocs.filter((doc: any) => !doc.serviceId);

			// Create a map of files by URL for easy lookup
			const storageFilesMap = new Map<string, UploadedFile>();
			storageFiles.forEach((file) => {
				storageFilesMap.set(file.url, file);
			});

			// Combine metadata with storage files
			const allDocuments: UploadedFile[] = [];

			// Add documents from metadata (these have additional info like title, certificate number)
			accreditationDocs.forEach((doc: any, index: number) => {
				if (doc.url) {
					const storageFile = storageFilesMap.get(doc.url);
					allDocuments.push({
						url: doc.url,
						fileName: doc.title || storageFile?.fileName || `Document ${index + 1}`,
						filePath: storageFile?.filePath || "",
						uploadedAt:
							doc.uploadedAt || storageFile?.uploadedAt || new Date().toISOString(),
						serviceId: doc.serviceId,
						serviceType: doc.serviceType,
						// Additional metadata
						title: doc.title,
						certificateNumber: doc.certificateNumber,
						fileType: doc.fileType,
						fileSize: doc.fileSize,
						status: doc.status || "under_review",
						notes: doc.notes,
					});
				}
			});

			// Add any storage files that don't have metadata (orphaned files)
			// Only include files from the root user folder (not service subfolders)
			storageFiles.forEach((file) => {
				const hasMetadata = accreditationDocs.some(
					(doc: any) => doc.url === file.url
				);
				// Only include files that are in the root user folder (no service subfolder in path)
				const isRootFolderFile =
					!file.filePath.includes("/") || file.filePath.split("/").length === 2;
				if (!hasMetadata && isRootFolderFile) {
					allDocuments.push({
						...file,
						fileName: file.fileName || "Unknown Document",
						status: "under_review",
					});
				}
			});

			// Sort by upload date (newest first)
			allDocuments.sort(
				(a, b) =>
					new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
			);

			return allDocuments;
		} catch (error) {
			console.error("Error getting all user documents:", error);
			throw new FileUploadError(
				`Failed to get documents: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"GET_DOCUMENTS_FAILED"
			);
		}
	}

	/**
	 * Gets service-specific documents for a user
	 */
	async getServiceDocuments(
		userId: string,
		serviceId: string,
		fileType: FileUploadOptions["fileType"] = "accreditation"
	): Promise<UploadedFile[]> {
		try {
			// Get files from storage for the specific service
			const storageFiles = await this.listUserFiles(userId, fileType, serviceId);

			// Get metadata from support_services table
			const { data: serviceData } = await this.supabase
				.from("support_services")
				.select("accreditation_files_metadata")
				.eq("id", serviceId)
				.eq("user_id", userId)
				.single();

			const metadataDocs = serviceData?.accreditation_files_metadata
				? Array.isArray(serviceData.accreditation_files_metadata)
					? serviceData.accreditation_files_metadata
					: JSON.parse(serviceData.accreditation_files_metadata)
				: [];

			// Create a map of files by URL for easy lookup
			const storageFilesMap = new Map<string, UploadedFile>();
			storageFiles.forEach((file) => {
				storageFilesMap.set(file.url, file);
			});

			// Combine metadata with storage files
			const allDocuments: UploadedFile[] = [];

			// Add documents from metadata
			metadataDocs.forEach((doc: any, index: number) => {
				if (doc.url) {
					const storageFile = storageFilesMap.get(doc.url);
					allDocuments.push({
						url: doc.url,
						fileName: doc.title || storageFile?.fileName || `Document ${index + 1}`,
						filePath: storageFile?.filePath || "",
						uploadedAt:
							doc.uploadedAt || storageFile?.uploadedAt || new Date().toISOString(),
						serviceId: doc.serviceId,
						serviceType: doc.serviceType,
						// Additional metadata
						title: doc.title,
						certificateNumber: doc.certificateNumber,
						fileType: doc.fileType,
						fileSize: doc.fileSize,
						status: doc.status || "under_review",
						notes: doc.notes,
					});
				}
			});

			// Add any storage files that don't have metadata (orphaned files)
			storageFiles.forEach((file) => {
				const hasMetadata = metadataDocs.some((doc: any) => doc.url === file.url);
				if (!hasMetadata) {
					allDocuments.push({
						...file,
						fileName: file.fileName || "Unknown Document",
						status: "under_review",
					});
				}
			});

			// Sort by upload date (newest first)
			allDocuments.sort(
				(a, b) =>
					new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
			);

			return allDocuments;
		} catch (error) {
			console.error("Error getting service documents:", error);
			throw new FileUploadError(
				`Failed to get service documents: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				"GET_SERVICE_DOCUMENTS_FAILED"
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
