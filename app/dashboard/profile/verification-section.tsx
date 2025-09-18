"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
	Eye,
	Download,
	Upload,
	Shield,
	FileText,
	Calendar,
	User,
	Building,
	RefreshCw,
	Info,
	ExternalLink,
	TrendingUp,
	Plus,
	CheckSquare,
	X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { VerificationDashboard } from "./verification-dashboard";
import { VerificationProgressBar } from "./verification-progress-bar";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

interface VerificationDocument {
	id: string;
	title: string;
	url: string;
	fileType: string;
	fileSize: number;
	uploadedAt: string;
	serviceId?: string;
	serviceType?: SupportServiceType;
	status: "pending" | "verified" | "rejected" | "under_review";
	notes?: string;
	certificateNumber?: string;
	isIdCardFront?: boolean;
}

interface VerificationStatus {
	overall: "pending" | "verified" | "rejected" | "under_review";
	profile: "pending" | "verified" | "rejected" | "under_review";
	documents: "pending" | "verified" | "rejected" | "under_review";
	services: "pending" | "verified" | "rejected" | "under_review";
	lastChecked: string;
	verificationNotes?: string;
}

interface ServiceVerification {
	id: string;
	name: string;
	serviceType: SupportServiceType;
	status: "pending" | "verified" | "rejected" | "under_review";
	documents: VerificationDocument[];
	lastChecked: string;
	notes?: string;
}

interface VerificationSectionProps {
	userId: string;
	userType: UserType;
	profile: any;
	onUpdate?: () => void;
	onNavigateToServices?: () => void;
}

interface DocumentUploadFormProps {
	userId: string;
	userType: UserType;
	onUploadSuccess?: () => void;
}

interface DocumentFormData {
	id: string;
	title: string;
	certificateNumber: string;
	file: File | null;
	uploaded: boolean;
	isIdCardFront?: boolean;
	uploading?: boolean;
	uploadProgress?: number;
	uploadedUrl?: string;
	uploadError?: string;
}

export function DocumentUploadForm({
	userId,
	userType,
	onUploadSuccess,
}: DocumentUploadFormProps) {
	const [documents, setDocuments] = useState<DocumentFormData[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
	const supabase = createClient();
	const { toast } = useToast();

	const addDocument = () => {
		const newDoc: DocumentFormData = {
			id: `doc-${Date.now()}`,
			title: "",
			certificateNumber: "",
			file: null,
			uploaded: false,
			isIdCardFront: documents.length === 0, // First document is ID card front
		};
		setDocuments((prev) => [...prev, newDoc]);
	};

	const removeDocument = (id: string) => {
		setDocuments((prev) => prev.filter((doc) => doc.id !== id));
	};

	const updateDocument = (
		id: string,
		field: keyof DocumentFormData,
		value: any
	) => {
		setDocuments((prev) =>
			prev.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc))
		);

		// If a file is selected, start uploading immediately in the background
		if (field === "file" && value) {
			const doc = documents.find((d) => d.id === id);
			if (doc) {
				startBackgroundUpload(id, value, doc.title);
			}
		}
	};

	const startBackgroundUpload = async (
		id: string,
		file: File,
		title: string
	) => {
		// Mark document as uploading
		setDocuments((prev) =>
			prev.map((doc) =>
				doc.id === id
					? { ...doc, uploading: true, uploadProgress: 0, uploadError: undefined }
					: doc
			)
		);

		try {
			// Upload the file
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				fileType: "accreditation",
				fileName: file.name,
				file: file,
			});

			// Mark as uploaded successfully
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === id
						? {
								...doc,
								uploading: false,
								uploadProgress: 100,
								uploadedUrl: result.url,
								uploaded: true,
						  }
						: doc
				)
			);
		} catch (error) {
			console.error("Background upload failed:", error);
			// Mark as upload failed
			setDocuments((prev) =>
				prev.map((doc) =>
					doc.id === id
						? {
								...doc,
								uploading: false,
								uploadError: "Upload failed. Please try again.",
						  }
						: doc
				)
			);
		}
	};

	const uploadDocument = async (doc: DocumentFormData) => {
		if (!doc.file) return null;

		try {
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				fileType: "accreditation",
				fileName: doc.file.name,
				file: doc.file,
			});

			return result.url;
		} catch (error) {
			console.error("Error uploading file:", error);
			throw error;
		}
	};

	const saveDocuments = async () => {
		if (documents.length === 0) return;

		setIsUploading(true);
		try {
			// First, get existing documents
			const { data: profileData } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			const existingDocs = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata)
				: [];

			const documentsToSave: any[] = [];

			// Process all documents in the current form
			for (const doc of documents) {
				if (!doc.title.trim() || !doc.file) {
					continue;
				}

				// If already uploaded in background, use the uploaded URL
				if (doc.uploaded && doc.uploadedUrl) {
					const savedDoc = {
						title: doc.title,
						certificateNumber: doc.certificateNumber,
						url: doc.uploadedUrl,
						fileType: doc.file?.type || "unknown",
						fileSize: doc.file?.size || 0,
						uploadedAt: new Date().toISOString(),
						uploaded: true,
					};
					documentsToSave.push(savedDoc);
				} else {
					// Upload the file if not already uploaded
					const url = await uploadDocument(doc);
					if (url) {
						const savedDoc = {
							title: doc.title,
							certificateNumber: doc.certificateNumber,
							url,
							fileType: doc.file?.type || "unknown",
							fileSize: doc.file?.size || 0,
							uploadedAt: new Date().toISOString(),
							uploaded: true,
						};
						documentsToSave.push(savedDoc);
					}
				}
			}

			if (documentsToSave.length > 0) {
				// Merge existing documents with new ones
				const allDocuments = [...existingDocs, ...documentsToSave];

				// Update profile with all documents
				const { error } = await supabase
					.from("profiles")
					.update({
						accreditation_files_metadata: allDocuments,
						updated_at: new Date().toISOString(),
					})
					.eq("id", userId);

				if (error) throw error;

				toast({
					title: "Success",
					description: `${documentsToSave.length} document(s) uploaded successfully`,
				});

				// Clear form only after successful save
				setDocuments([]);
				onUploadSuccess?.();
			} else {
				toast({
					title: "Warning",
					description:
						"No documents were uploaded. Please check your files and try again.",
					variant: "destructive",
				});
			}
		} catch (error) {
			console.error("Error saving documents:", error);
			toast({
				title: "Error",
				description: "Failed to upload documents. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsUploading(false);
		}
	};

	// Drag and drop handlers
	const handleDragOver = (e: React.DragEvent, docId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverDocId(docId);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverDocId(null);
	};

	const handleDrop = (e: React.DragEvent, docId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverDocId(null);

		const droppedFiles = Array.from(e.dataTransfer.files);
		if (droppedFiles.length > 0) {
			const droppedFile = droppedFiles[0];
			// Validate file type
			const allowedTypes = [
				"application/pdf",
				"image/jpeg",
				"image/jpg",
				"image/png",
				"image/webp",
				"application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			];

			if (allowedTypes.includes(droppedFile.type)) {
				updateDocument(docId, "file", droppedFile);
				// Auto-fill title if empty
				const doc = documents.find((d) => d.id === docId);
				if (doc && !doc.title) {
					updateDocument(docId, "title", droppedFile.name.replace(/\.[^/.]+$/, ""));
				}
			} else {
				toast({
					title: "Invalid File Type",
					description: "Please select a valid file type (PDF, JPG, PNG, DOC, DOCX)",
					variant: "destructive",
				});
			}
		}
	};

	return (
		<div className="space-y-3 sm:space-y-4">
			{/* Add Document Button */}
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-base sm:text-lg font-semibold">
					Add Professional Documents
				</h3>
				<Button
					onClick={addDocument}
					className="gap-1 sm:gap-2 text-xs sm:text-sm"
					size="sm"
				>
					<Plus className="h-3 w-3 sm:h-4 sm:w-4" />
					Add Document
				</Button>
			</div>

			{/* Document Forms */}
			<div className="space-y-3 sm:space-y-4">
				{documents.map((doc) => (
					<Card
						key={doc.id}
						className="border border-gray-200 sm:border-2 sm:border-dashed"
					>
						<CardContent className="p-3 sm:p-4">
							<div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<h4 className="font-medium text-sm sm:text-base truncate">
										Document {documents.indexOf(doc) + 1}
									</h4>
									{doc.isIdCardFront && (
										<Badge
											variant="secondary"
											className="text-xs bg-blue-100 text-blue-700 flex-shrink-0"
										>
											ID Card Front
										</Badge>
									)}
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => removeDocument(doc.id)}
									className="text-red-600 hover:text-red-700 p-1 sm:p-2 flex-shrink-0"
								>
									<Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
								</Button>
							</div>

							<div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
								<div className="space-y-2">
									<label className="text-xs sm:text-sm font-medium text-gray-700">
										Document Title *
									</label>
									<Input
										placeholder="e.g., Medical License, PhD Certificate"
										value={doc.title}
										onChange={(e) => updateDocument(doc.id, "title", e.target.value)}
										className="text-sm sm:text-base"
									/>
								</div>

								<div className="space-y-2">
									<label className="text-xs sm:text-sm font-medium text-gray-700">
										Certificate/License Number *
									</label>
									<Input
										placeholder="e.g., MD-12345, PhD-2023-001"
										value={doc.certificateNumber}
										onChange={(e) =>
											updateDocument(doc.id, "certificateNumber", e.target.value)
										}
										className="text-sm sm:text-base"
									/>
								</div>
							</div>

							<div className="space-y-2 mt-3 sm:mt-4">
								<label className="text-xs sm:text-sm font-medium text-gray-700">
									Upload File *
								</label>

								{/* Drag and Drop File Input */}
								<div
									className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center transition-colors cursor-pointer ${
										dragOverDocId === doc.id
											? "border-sauti-orange bg-orange-50"
											: doc.file
											? "border-green-300 bg-green-50"
											: "border-gray-300 hover:border-gray-400"
									}`}
									onDragOver={(e) => handleDragOver(e, doc.id)}
									onDragEnter={(e) => handleDragOver(e, doc.id)}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(e, doc.id)}
									onClick={(e) => {
										e.preventDefault();
										document.getElementById(`file-upload-${doc.id}`)?.click();
									}}
									onTouchStart={(e) => {
										// Handle touch start to ensure proper mobile interaction
										e.preventDefault();
									}}
									onTouchEnd={(e) => {
										// Don't prevent default on touch end to allow proper mobile interaction
										e.preventDefault();
										document.getElementById(`file-upload-${doc.id}`)?.click();
									}}
									style={{ minHeight: "120px" }}
								>
									{doc.file ? (
										<div className="space-y-2">
											{doc.uploading ? (
												<>
													<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sauti-orange mx-auto" />
													<p className="text-sm font-medium text-sauti-orange">
														Uploading...
													</p>
													{doc.uploadProgress !== undefined && (
														<div className="w-full bg-gray-200 rounded-full h-2">
															<div
																className="bg-sauti-orange h-2 rounded-full transition-all duration-300"
																style={{ width: `${doc.uploadProgress}%` }}
															></div>
														</div>
													)}
												</>
											) : doc.uploaded && doc.uploadedUrl ? (
												<>
													<FileText className="h-6 w-6 text-green-600 mx-auto" />
													<p className="text-sm font-medium text-green-800 truncate">
														{doc.file.name}
													</p>
													<p className="text-xs text-green-600">
														{(doc.file.size / 1024 / 1024).toFixed(2)} MB
													</p>
													<p className="text-xs text-green-600 font-medium">
														✓ Uploaded successfully
													</p>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															updateDocument(doc.id, "file", null);
														}}
														className="text-red-600 hover:text-red-700"
													>
														Remove
													</Button>
												</>
											) : doc.uploadError ? (
												<>
													<FileText className="h-6 w-6 text-red-600 mx-auto" />
													<p className="text-sm font-medium text-red-800 truncate">
														{doc.file.name}
													</p>
													<p className="text-xs text-red-600">{doc.uploadError}</p>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															startBackgroundUpload(doc.id, doc.file!, doc.title);
														}}
														className="text-sauti-orange hover:text-sauti-orange/80"
													>
														Retry Upload
													</Button>
												</>
											) : (
												<>
													<FileText className="h-6 w-6 text-blue-600 mx-auto" />
													<p className="text-sm font-medium text-blue-800 truncate">
														{doc.file.name}
													</p>
													<p className="text-xs text-blue-600">
														{(doc.file.size / 1024 / 1024).toFixed(2)} MB
													</p>
													<p className="text-xs text-blue-600">Ready to upload</p>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															updateDocument(doc.id, "file", null);
														}}
														className="text-red-600 hover:text-red-700"
													>
														Remove
													</Button>
												</>
											)}
										</div>
									) : (
										<div className="space-y-2">
											<Upload className="h-6 w-6 text-gray-400 mx-auto" />
											<div>
												<p className="text-sm text-gray-600">
													<span className="font-medium text-sauti-orange">
														Tap to upload
													</span>
													<span className="hidden sm:inline"> or drag and drop</span>
												</p>
												<p className="text-xs text-gray-500 mt-1">
													PDF, JPG, PNG, DOC, DOCX
													<span className="hidden sm:inline"> (Max 10MB)</span>
												</p>
											</div>
										</div>
									)}
								</div>

								{/* Hidden File Input */}
								<input
									type="file"
									accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
									onChange={(e) =>
										updateDocument(doc.id, "file", e.target.files?.[0] || null)
									}
									className="hidden"
									id={`file-upload-${doc.id}`}
								/>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Action Buttons */}
			{documents.length > 0 && (
				<div className="flex flex-col sm:flex-row justify-end gap-2">
					<Button
						variant="outline"
						onClick={() => {
							setDocuments([]);
							// Clear all file inputs
							documents.forEach((doc) => {
								const fileInput = document.getElementById(
									`file-upload-${doc.id}`
								) as HTMLInputElement;
								if (fileInput) {
									fileInput.value = "";
								}
							});
						}}
						disabled={isUploading}
						className="gap-1 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto"
						size="sm"
					>
						<X className="h-3 w-3 sm:h-4 sm:w-4" />
						Cancel
					</Button>
					<Button
						onClick={saveDocuments}
						disabled={
							isUploading || documents.some((doc) => !doc.title.trim() || !doc.file)
						}
						className="gap-1 sm:gap-2 bg-sauti-orange hover:bg-sauti-orange/90 text-xs sm:text-sm w-full sm:w-auto"
						size="sm"
					>
						{isUploading ? (
							<>
								<div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
								<span className="hidden sm:inline">Uploading...</span>
								<span className="sm:hidden">Uploading...</span>
							</>
						) : (
							<>
								<Upload className="h-3 w-3 sm:h-4 sm:w-4" />
								<span className="hidden sm:inline">
									Upload {documents.length} Document{documents.length !== 1 ? "s" : ""}
								</span>
								<span className="sm:hidden">Upload {documents.length}</span>
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}

export function VerificationSection({
	userId,
	userType,
	profile,
	onUpdate,
	onNavigateToServices,
}: VerificationSectionProps) {
	const [verificationStatus, setVerificationStatus] =
		useState<VerificationStatus>({
			overall: "pending",
			profile: "pending",
			documents: "pending",
			services: "pending",
			lastChecked: new Date().toISOString(),
		});
	const dash = useDashboardData();
	const [documents, setDocuments] = useState<VerificationDocument[]>([]);
	const [services, setServices] = useState<ServiceVerification[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedDocument, setSelectedDocument] =
		useState<VerificationDocument | null>(null);
	const [viewMode, setViewMode] = useState<"overview" | "dashboard">("overview");
	const [showMobileUpload, setShowMobileUpload] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	const deleteDocument = async (documentUrl: string, serviceId?: string) => {
		try {
			await fileUploadService.deleteDocument(
				userId,
				documentUrl,
				"accreditation",
				serviceId
			);

			// Remove from local state
			setDocuments((prev) => prev.filter((doc) => doc.url !== documentUrl));

			// If it's a service document, also update the services state
			if (serviceId) {
				setServices((prev) =>
					prev.map((service) => {
						if (service.id === serviceId) {
							return {
								...service,
								documents: service.documents.filter((doc) => doc.url !== documentUrl),
							};
						}
						return service;
					})
				);
			}

			toast({
				title: "Success",
				description: "Document deleted successfully",
			});
		} catch (error) {
			console.error("Error deleting document:", error);
			toast({
				title: "Error",
				description: "Failed to delete document. Please try again.",
				variant: "destructive",
			});
		}
	};

	const loadVerificationStatus = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("verification_status, verification_notes, last_verification_check")
				.eq("id", userId)
				.single();

			if (error) throw error;

			setVerificationStatus({
				overall: data?.verification_status || "pending",
				profile: data?.verification_status || "pending",
				documents: data?.verification_status || "pending",
				services: data?.verification_status || "pending",
				lastChecked: data?.last_verification_check || new Date().toISOString(),
				verificationNotes: data?.verification_notes,
			});
		} catch (error) {
			console.error("Error loading verification status:", error);
		}
	}, [userId, supabase]);

	const loadDocuments = useCallback(async () => {
		try {
			// Only load professional credentials (documents without serviceId)
			// Support service documents are loaded separately in loadServices
			const { data: profileData } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata, accreditation_files")
				.eq("id", userId)
				.single();

			const metaDocsRaw = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata)
				: [];
			const legacyDocsRaw = profileData?.accreditation_files
				? Array.isArray(profileData.accreditation_files)
					? profileData.accreditation_files
					: JSON.parse(profileData.accreditation_files)
				: [];

			// Filter out service-specific documents from metadata
			// Only include documents that don't have a serviceId (professional credentials)
			const professionalDocs = metaDocsRaw.filter((doc: any) => !doc.serviceId);

			// Build lookup by url or title to merge notes/description from legacy docs
			const legacyByUrl = new Map<string, any>();
			const legacyByTitle = new Map<string, any>();
			(legacyDocsRaw || []).forEach((ld: any) => {
				if (ld?.url) legacyByUrl.set(ld.url, ld);
				if (ld?.title) legacyByTitle.set(ld.title, ld);
			});

			const merged = professionalDocs.map((doc: any, index: number) => {
				const keyUrl = doc?.url;
				const keyTitle = doc?.title;
				const legacy =
					(keyUrl && legacyByUrl.get(keyUrl)) ||
					(keyTitle && legacyByTitle.get(keyTitle)) ||
					{};
				return {
					id: `doc-${index}`,
					title: doc.title || legacy.title || "Untitled Document",
					url: doc.url || legacy.url || "",
					fileType: doc.fileType || legacy.fileType || "unknown",
					fileSize: doc.fileSize || legacy.fileSize || 0,
					uploadedAt:
						doc.uploadedAt || legacy.uploadedAt || new Date().toISOString(),
					serviceId: doc.serviceId || legacy.serviceId,
					serviceType: doc.serviceType || legacy.serviceType,
					status: (doc.status || legacy.status || "under_review") as any,
					notes: doc.notes || legacy.note || legacy.notes,
					certificateNumber: doc.certificateNumber || legacy.certificateNumber,
					// Mark the first document as ID card front
					isIdCardFront: index === 0,
				};
			});

			setDocuments(merged);
		} catch (error) {
			console.error("Error loading professional credentials:", error);
			setDocuments([]);
		}
	}, [userId, supabase]);

	const loadServices = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("support_services")
				.select(
					"id, name, service_types, verification_status, verification_notes, last_verification_check, accreditation_files_metadata"
				)
				.eq("user_id", userId);

			if (error) throw error;

			setServices(
				data?.map((service) => ({
					id: service.id,
					name: service.name,
					serviceType: service.service_types,
					status: service.verification_status || "pending",
					lastChecked: service.last_verification_check || new Date().toISOString(),
					notes: service.verification_notes,
					documents: service.accreditation_files_metadata
						? (Array.isArray(service.accreditation_files_metadata)
								? service.accreditation_files_metadata
								: JSON.parse(service.accreditation_files_metadata)
						  ).map((doc: any, index: number) => ({
								id: `service-${service.id}-doc-${index}`,
								title: doc.title || "Untitled Document",
								url: doc.url || "",
								fileType: doc.fileType || "unknown",
								fileSize: doc.fileSize || 0,
								uploadedAt: doc.uploadedAt || new Date().toISOString(),
								serviceId: service.id,
								serviceType: service.service_types,
								status: "under_review" as const,
								notes: doc.notes,
						  }))
						: [],
				})) || []
			);
		} catch (error) {
			console.error("Error loading services:", error);
		}
	}, [userId, supabase]);

	const loadVerificationData = useCallback(async () => {
		setIsLoading(true);
		try {
			await Promise.all([
				loadVerificationStatus(),
				loadDocuments(),
				loadServices(), // Load services for all user types
			]);
		} catch (error) {
			console.error("Error loading verification data:", error);
			toast({
				title: "Error",
				description: "Failed to load verification data",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [loadVerificationStatus, loadDocuments, loadServices, toast]);

	useEffect(() => {
		loadVerificationData();
	}, [loadVerificationData]);

	const refreshVerification = async () => {
		setIsRefreshing(true);
		try {
			await loadVerificationData();
			// update provider snapshot with a light refresh
			try {
				const { data } = await supabase
					.from("profiles")
					.select(
						"verification_status, last_verification_check, accreditation_files_metadata"
					)
					.eq("id", userId)
					.single();
				const docs = data?.accreditation_files_metadata
					? Array.isArray(data.accreditation_files_metadata)
						? data.accreditation_files_metadata
						: JSON.parse(data.accreditation_files_metadata)
					: [];
				(dash as any)?.updatePartial?.({
					verification: {
						overallStatus: data?.verification_status || "pending",
						lastChecked: data?.last_verification_check || null,
						documentsCount: (docs || []).length,
					},
				});
			} catch {}
			toast({
				title: "Refreshed",
				description: "Verification data has been updated",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to refresh verification data",
				variant: "destructive",
			});
		} finally {
			setIsRefreshing(false);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "verified":
				return <CheckCircle className="h-5 w-5 text-green-600" />;
			case "rejected":
				return <XCircle className="h-5 w-5 text-red-600" />;
			case "under_review":
				return <Clock className="h-5 w-5 text-yellow-600" />;
			default:
				return <AlertCircle className="h-5 w-5 text-gray-600" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "verified":
				return "bg-green-100 text-green-800 border-green-200";
			case "rejected":
				return "bg-red-100 text-red-800 border-red-200";
			case "under_review":
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const getProgressPercentage = () => {
		// For professionals: Documents only
		// For NGOs: Documents + Services
		const totalSteps = userType === "ngo" ? 2 : 1; // Documents + Services (NGO) or Documents only (Professional)
		let completedSteps = 0;

		if (verificationStatus.documents === "verified") completedSteps++;
		if (userType === "ngo" && verificationStatus.services === "verified")
			completedSteps++;

		return Math.round((completedSteps / totalSteps) * 100);
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	// Long, detailed date for modal and detailed views
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Compact date for list rows
	const formatDateCompact = (dateString: string) => {
		const d = new Date(dateString);
		return d.toLocaleString(undefined, {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Helper function to check if services have accreditation files
	const getServicesWithoutAccreditation = () => {
		return services.filter((service) => {
			const hasDocs = service.documents && service.documents.length > 0;
			return !hasDocs;
		});
	};

	// Helper function to check if any service has accreditation files
	const hasServicesWithAccreditation = () => {
		return services.some((service) => {
			return service.documents && service.documents.length > 0;
		});
	};

	// Show dashboard view if selected
	if (viewMode === "dashboard") {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-bold text-gray-900">
							Verification Dashboard
						</h2>
						<p className="text-gray-600 mt-1">
							Comprehensive view of your verification status and progress
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setViewMode("overview")}
							className="gap-2"
						>
							<Shield className="h-4 w-4" />
							Overview
						</Button>
						<Button
							variant="outline"
							onClick={refreshVerification}
							disabled={isRefreshing}
							className="gap-2"
						>
							<RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
							Refresh
						</Button>
					</div>
				</div>
				<VerificationDashboard
					userId={userId}
					userType={userType}
					profile={profile}
					onUpdate={onUpdate}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Single Consolidated Progress Bar */}
			<VerificationProgressBar
				hasAccreditation={documents.length > 0}
				hasSupportServices={services.length > 0}
				verificationStatus={verificationStatus.overall}
				hasMatches={false} // TODO: Add logic to check for matches
				verificationNotes={verificationStatus.verificationNotes}
				documentsCount={documents.length}
				servicesCount={services.length}
			/>

			{/* Document Upload and List Section */}
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-6">
				{/* Document Upload Form - Desktop Only */}
				<div className="hidden sm:block lg:col-span-1 xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-3 sm:pb-4">
							<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
								<FileText className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
								Professional Credentials
							</CardTitle>
							<p className="text-xs sm:text-sm text-gray-600">
								Upload your professional licenses, certifications, and academic
								documents
							</p>
						</CardHeader>
						<CardContent>
							<DocumentUploadForm
								userId={userId}
								userType={userType}
								onUploadSuccess={() => {
									loadVerificationData();
									onUpdate?.();
								}}
							/>
						</CardContent>
					</Card>
				</div>

				{/* Mobile Documents Header */}
				<div className="sm:hidden">
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1">
									<CardTitle className="flex items-center gap-2 text-base">
										<FileText className="h-4 w-4 text-sauti-orange flex-shrink-0" />
										<span className="truncate">Professional Credentials</span>
									</CardTitle>
									<p className="text-xs text-gray-600 mt-1 line-clamp-2">
										{documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
										uploaded
									</p>
								</div>
								<Button
									size="sm"
									className={`gap-2 flex-shrink-0 ${
										showMobileUpload
											? "bg-red-600 hover:bg-red-700"
											: "bg-sauti-orange hover:bg-sauti-orange/90"
									}`}
									onClick={(e) => {
										e.preventDefault();
										setShowMobileUpload(!showMobileUpload);
									}}
									onTouchEnd={(e) => {
										e.preventDefault();
										setShowMobileUpload(!showMobileUpload);
									}}
								>
									{showMobileUpload ? (
										<X className="h-4 w-4" />
									) : (
										<Plus className="h-4 w-4" />
									)}
									{showMobileUpload ? "Cancel" : "Add"}
								</Button>
							</div>
						</CardHeader>
						{showMobileUpload && (
							<CardContent className="pt-0">
								<DocumentUploadForm
									userId={userId}
									userType={userType}
									onUploadSuccess={() => {
										loadVerificationData();
										onUpdate?.();
										setShowMobileUpload(false);
									}}
								/>
							</CardContent>
						)}
					</Card>
				</div>

				{/* Uploaded Documents List - Right Side */}
				<div className="lg:col-span-1 xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-3 sm:pb-4">
							<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
								<CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
								Uploaded Documents ({documents.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{documents.length === 0 ? (
								<div className="text-center py-8 sm:py-12">
									<div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center">
										<FileText className="h-6 w-6 sm:h-8 sm:w-8 text-sky-600" />
									</div>
									<h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
										No documents uploaded yet
									</h3>
									<p className="text-gray-500 text-xs sm:text-sm">
										Your uploaded documents will appear here
									</p>
								</div>
							) : (
								<div className="space-y-2 sm:space-y-3">
									{documents.map((doc) => (
										<div
											key={doc.id}
											className="bg-white rounded-lg sm:rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md group"
										>
											<div className="p-3 sm:p-4">
												{/* Header */}
												<div className="flex items-start justify-between mb-2 sm:mb-3">
													<div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
														<div
															className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm flex-shrink-0 ${
																getStatusColor(doc.status).includes("green")
																	? "bg-gradient-to-br from-green-100 to-green-200 text-green-700"
																	: getStatusColor(doc.status).includes("yellow")
																	? "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700"
																	: getStatusColor(doc.status).includes("red")
																	? "bg-gradient-to-br from-red-100 to-red-200 text-red-700"
																	: "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
															}`}
														>
															<FileText className="h-4 w-4 sm:h-5 sm:w-5" />
														</div>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2 mb-1">
																<h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
																	{doc.title}
																</h4>
																{doc.isIdCardFront && (
																	<Badge
																		variant="secondary"
																		className="text-xs bg-blue-100 text-blue-700"
																	>
																		ID Card Front
																	</Badge>
																)}
															</div>
															<div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
																<span>{formatDateCompact(doc.uploadedAt)}</span>
															</div>
															{doc.notes && (
																<p className="mt-1 text-xs sm:text-sm text-gray-600 line-clamp-2">
																	{doc.notes}
																</p>
															)}
														</div>
													</div>
													<div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
														<Badge className={`${getStatusColor(doc.status)} border text-xs`}>
															{doc.status.replace("_", " ")}
														</Badge>
													</div>
												</div>

												{/* Actions */}
												<div className="flex gap-1 sm:gap-2">
													<Dialog>
														<DialogTrigger asChild>
															<Button
																variant="outline"
																size="sm"
																className="flex-1 gap-1 sm:gap-2 text-xs sm:text-sm"
															>
																<Eye className="h-3 w-3 sm:h-4 sm:w-4" />
																<span className="hidden sm:inline">View Details</span>
																<span className="sm:hidden">View</span>
															</Button>
														</DialogTrigger>
														<DialogContent className="max-w-3xl">
															<DialogHeader>
																<DialogTitle className="flex items-center gap-2">
																	<FileText className="h-5 w-5 text-sauti-orange" />
																	{doc.title}
																	{doc.isIdCardFront && (
																		<Badge
																			variant="secondary"
																			className="text-xs bg-blue-100 text-blue-700"
																		>
																			ID Card Front
																		</Badge>
																	)}
																</DialogTitle>
																<DialogDescription>
																	Professional credential document details
																</DialogDescription>
															</DialogHeader>
															<div className="space-y-6">
																{/* Document Preview */}
																<div className="border rounded-lg p-4 bg-gray-50">
																	<div className="flex items-center gap-3">
																		<div className="h-12 w-12 rounded-lg bg-sauti-orange/10 flex items-center justify-center">
																			<FileText className="h-6 w-6 text-sauti-orange" />
																		</div>
																		<div className="flex-1 min-w-0">
																			<h4 className="font-medium text-gray-900 truncate">
																				{doc.title}
																			</h4>
																			<p className="text-sm text-gray-500">
																				{doc.fileType.toUpperCase()} •{" "}
																				{formatFileSize(doc.fileSize)}
																			</p>
																		</div>
																		<Badge className={`${getStatusColor(doc.status)} text-xs`}>
																			{doc.status.replace("_", " ")}
																		</Badge>
																	</div>
																</div>

																{/* Document Details */}
																<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																	<div className="space-y-3">
																		<div>
																			<label className="text-sm font-medium text-gray-600">
																				Upload Date
																			</label>
																			<p className="text-sm text-gray-900">
																				{formatDate(doc.uploadedAt)}
																			</p>
																		</div>
																		<div>
																			<label className="text-sm font-medium text-gray-600">
																				File Type
																			</label>
																			<p className="text-sm text-gray-900 capitalize">
																				{doc.fileType}
																			</p>
																		</div>
																	</div>
																	<div className="space-y-3">
																		<div>
																			<label className="text-sm font-medium text-gray-600">
																				File Size
																			</label>
																			<p className="text-sm text-gray-900">
																				{formatFileSize(doc.fileSize)}
																			</p>
																		</div>
																		{doc.certificateNumber && (
																			<div>
																				<label className="text-sm font-medium text-gray-600">
																					Certificate Number
																				</label>
																				<p className="text-sm text-gray-900 font-mono">
																					{doc.certificateNumber}
																				</p>
																			</div>
																		)}
																	</div>
																</div>

																{doc.notes && (
																	<div>
																		<label className="text-sm font-medium text-gray-600">
																			Notes
																		</label>
																		<div className="mt-1 p-3 bg-gray-50 rounded-md">
																			<p className="text-sm text-gray-900">{doc.notes}</p>
																		</div>
																	</div>
																)}

																{/* Action Buttons */}
																<div className="space-y-3 pt-4 border-t">
																	<div className="flex gap-2">
																		<Button
																			onClick={() => window.open(doc.url, "_blank")}
																			className="gap-2 flex-1"
																		>
																			<ExternalLink className="h-4 w-4" />
																			View Document
																		</Button>
																		<Button
																			variant="outline"
																			onClick={() => {
																				const link = document.createElement("a");
																				link.href = doc.url;
																				link.download = doc.title;
																				link.click();
																			}}
																			className="gap-2 flex-1"
																		>
																			<Download className="h-4 w-4" />
																			Download
																		</Button>
																	</div>
																	<Button
																		variant="outline"
																		onClick={() => deleteDocument(doc.url)}
																		className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
																	>
																		<Trash2 className="h-4 w-4" />
																		Delete Document
																	</Button>
																</div>
															</div>
														</DialogContent>
													</Dialog>
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															const link = document.createElement("a");
															link.href = doc.url;
															link.download = doc.title;
															link.click();
														}}
														className="gap-1 sm:gap-2 text-xs sm:text-sm"
													>
														<Download className="h-3 w-3 sm:h-4 sm:w-4" />
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Support Services (NGO only) */}
			{userType === "ngo" && (
				<Card>
					<CardHeader className="pb-3 sm:pb-6">
						<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
							<Building className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
							Support Services ({services.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{services.length === 0 ? (
							<div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
								<Building className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
								<h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
									No Services Registered
								</h3>
								<p className="text-gray-500 mb-3 sm:mb-4 text-sm">
									Register your support services to get verified
								</p>
								<Button
									className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90 text-xs sm:text-sm"
									size="sm"
									onClick={() => {
										// Navigate to services tab
										onNavigateToServices?.();
									}}
								>
									<Plus className="h-3 w-3 sm:h-4 sm:w-4" />
									Add Support Service
								</Button>
							</div>
						) : (
							<div className="space-y-3 sm:space-y-4">
								{services.map((service) => (
									<div key={service.id} className="border rounded-lg p-3 sm:p-4">
										<div className="flex items-center justify-between mb-2 sm:mb-3">
											<div className="flex-1 min-w-0">
												<h4 className="font-semibold text-sm sm:text-base truncate">
													{service.name}
												</h4>
												<p className="text-xs sm:text-sm text-gray-600 capitalize">
													{service.serviceType.replace("_", " ")} Service
												</p>
											</div>
											<Badge className={`${getStatusColor(service.status)} text-xs`}>
												{service.status.replace("_", " ")}
											</Badge>
										</div>
										{service.documents.length > 0 && (
											<div className="mt-2 sm:mt-3">
												<p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">
													Documents ({service.documents.length})
												</p>
												<div className="space-y-1 sm:space-y-2">
													{service.documents.map((doc) => (
														<div
															key={doc.id}
															className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
														>
															<div className="flex items-center gap-2 min-w-0 flex-1">
																<FileText className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600 flex-shrink-0" />
																<span className="text-xs sm:text-sm truncate">{doc.title}</span>
															</div>
															<div className="flex items-center gap-2">
																<Badge
																	className={`${getStatusColor(
																		doc.status
																	)} text-xs flex-shrink-0`}
																>
																	{doc.status.replace("_", " ")}
																</Badge>
																<Dialog>
																	<DialogTrigger asChild>
																		<Button
																			variant="ghost"
																			size="sm"
																			className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-200"
																		>
																			<Eye className="h-3 w-3" />
																		</Button>
																	</DialogTrigger>
																	<DialogContent className="max-w-3xl">
																		<DialogHeader>
																			<DialogTitle className="flex items-center gap-2">
																				<FileText className="h-5 w-5 text-sauti-orange" />
																				{doc.title}
																			</DialogTitle>
																			<DialogDescription>
																				Service document details - {service.name}
																			</DialogDescription>
																		</DialogHeader>
																		<div className="space-y-6">
																			{/* Document Preview */}
																			<div className="border rounded-lg p-4 bg-gray-50">
																				<div className="flex items-center gap-3">
																					<div className="h-12 w-12 rounded-lg bg-sauti-orange/10 flex items-center justify-center">
																						<FileText className="h-6 w-6 text-sauti-orange" />
																					</div>
																					<div className="flex-1 min-w-0">
																						<h4 className="font-medium text-gray-900 truncate">
																							{doc.title}
																						</h4>
																						<p className="text-sm text-gray-500">
																							{doc.fileType.toUpperCase()} •{" "}
																							{formatFileSize(doc.fileSize)}
																						</p>
																					</div>
																					<Badge className={`${getStatusColor(doc.status)} text-xs`}>
																						{doc.status.replace("_", " ")}
																					</Badge>
																				</div>
																			</div>

																			{/* Document Details */}
																			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																				<div className="space-y-3">
																					<div>
																						<label className="text-sm font-medium text-gray-600">
																							Service
																						</label>
																						<p className="text-sm text-gray-900">{service.name}</p>
																					</div>
																					<div>
																						<label className="text-sm font-medium text-gray-600">
																							Upload Date
																						</label>
																						<p className="text-sm text-gray-900">
																							{formatDateCompact(doc.uploadedAt)}
																						</p>
																					</div>
																				</div>
																				<div className="space-y-3">
																					<div>
																						<label className="text-sm font-medium text-gray-600">
																							File Type
																						</label>
																						<p className="text-sm text-gray-900 capitalize">
																							{doc.fileType}
																						</p>
																					</div>
																					<div>
																						<label className="text-sm font-medium text-gray-600">
																							File Size
																						</label>
																						<p className="text-sm text-gray-900">
																							{formatFileSize(doc.fileSize)}
																						</p>
																					</div>
																				</div>
																			</div>

																			{doc.notes && (
																				<div>
																					<label className="text-sm font-medium text-gray-600">
																						Notes
																					</label>
																					<div className="mt-1 p-3 bg-gray-50 rounded-md">
																						<p className="text-sm text-gray-900">{doc.notes}</p>
																					</div>
																				</div>
																			)}

																			{/* Action Buttons */}
																			<div className="space-y-3 pt-4 border-t">
																				<div className="flex gap-2">
																					<Button
																						onClick={() => {
																							window.open(doc.url, "_blank");
																						}}
																						className="gap-2 flex-1"
																					>
																						<ExternalLink className="h-4 w-4" />
																						View Document
																					</Button>
																					<Button
																						variant="outline"
																						onClick={() => {
																							const link = document.createElement("a");
																							link.href = doc.url;
																							link.download = doc.title;
																							link.click();
																						}}
																						className="gap-2 flex-1"
																					>
																						<Download className="h-4 w-4" />
																						Download
																					</Button>
																				</div>
																				<Button
																					variant="outline"
																					onClick={() => deleteDocument(doc.url, service.id)}
																					className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
																				>
																					<Trash2 className="h-4 w-4" />
																					Delete Document
																				</Button>
																			</div>
																		</div>
																	</DialogContent>
																</Dialog>
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			)}
			{/* Verification Actions - Desktop Only */}
			{services.length === 0 || !hasServicesWithAccreditation() ? (
				<Card className="hidden sm:block">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-lg font-semibold text-gray-900">
									Verification Actions
								</h3>
								<p className="text-sm text-gray-600">
									{services.length === 0
										? "Add support services to start helping survivors"
										: "Add accreditation files for your support services"}
								</p>
							</div>
							<div className="flex gap-2">
								{services.length === 0 ? (
									<Button
										className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90"
										onClick={() => {
											// Navigate to services tab
											onNavigateToServices?.();
										}}
									>
										<Plus className="h-4 w-4" />
										Add Support Service
									</Button>
								) : (
									<Button
										className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90"
										onClick={() => {
											// Navigate to services tab to add accreditation files
											onNavigateToServices?.();
										}}
									>
										<FileText className="h-4 w-4" />
										Add Accreditation
									</Button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
