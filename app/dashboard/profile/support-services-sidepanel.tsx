"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	X,
	FileText,
	Download,
	Eye,
	ExternalLink,
	Building,
	Shield,
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
	Plus,
	Upload,
	Trash2,
	Edit,
	Save,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

// Add Document Form Component
function AddDocumentForm({
	onSave,
	isUploading,
	userId,
	userType,
	serviceId,
	serviceType,
}: {
	onSave: (title: string, file: File) => void;
	isUploading: boolean;
	userId: string;
	userType: UserType;
	serviceId: string;
	serviceType: SupportServiceType;
}) {
	const [title, setTitle] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			alert("Please enter a document title");
			return;
		}
		if (!file) {
			alert("Please select a file to upload");
			return;
		}
		if (!uploadedUrl) {
			alert("Please wait for the file to finish uploading");
			return;
		}

		// Call onSave with the uploaded file
		onSave(title, file);

		// Clear form after successful save
		setTitle("");
		setFile(null);
		setUploading(false);
		setUploadProgress(0);
		setUploadedUrl(null);
		setUploadError(null);

		// Clear the file input
		const fileInput = document.getElementById("file-upload") as HTMLInputElement;
		if (fileInput) {
			fileInput.value = "";
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);

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
				setFile(droppedFile);
				// Auto-fill title if empty
				if (!title) {
					setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
				}
			} else {
				// Show error for invalid file type
				alert("Please select a valid file type (PDF, JPG, PNG, DOC, DOCX)");
			}
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0] || null;
		setFile(selectedFile);
		if (selectedFile && !title) {
			setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
		}

		// Start background upload immediately when file is selected
		if (selectedFile) {
			startBackgroundUpload(selectedFile);
		}
	};

	const startBackgroundUpload = async (file: File) => {
		setUploading(true);
		setUploadProgress(0);
		setUploadError(null);
		setUploadedUrl(null);

		try {
			// Simulate progress for better UX
			const progressInterval = setInterval(() => {
				setUploadProgress((prev) => {
					if (prev >= 90) {
						clearInterval(progressInterval);
						return prev;
					}
					return prev + Math.random() * 10;
				});
			}, 200);

			// Upload the file
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				serviceId,
				serviceType,
				fileType: "accreditation",
				fileName: file.name,
				file: file,
			});

			clearInterval(progressInterval);
			setUploadProgress(100);
			setUploadedUrl(result.url);
			setUploading(false);
		} catch (error) {
			console.error("Background upload failed:", error);
			setUploadError("Upload failed. Please try again.");
			setUploading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label className="text-sm font-medium text-gray-700">
					Document Title *
				</label>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
					placeholder="e.g., License, Certificate"
					required
				/>
			</div>

			<div>
				<label className="text-sm font-medium text-gray-700">Upload File *</label>

				{/* Drag and Drop Area */}
				<div
					className={`mt-1 border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer ${
						isDragOver
							? "border-sauti-orange bg-orange-50"
							: file
							? "border-green-300 bg-green-50"
							: "border-gray-300 hover:border-gray-400"
					}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onClick={(e) => {
						e.preventDefault();
						document.getElementById("file-upload")?.click();
					}}
					onTouchStart={(e) => {
						// Handle touch start to ensure proper mobile interaction
						e.preventDefault();
					}}
					onTouchEnd={(e) => {
						// Allow proper mobile interaction - don't prevent default
						e.preventDefault();
						// Small delay to ensure touch is processed
						setTimeout(() => {
							document.getElementById("file-upload")?.click();
						}, 100);
					}}
				>
					{file ? (
						<div className="space-y-2">
							{uploading ? (
								<>
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sauti-orange mx-auto" />
									<p className="text-sm font-medium text-sauti-orange">Uploading...</p>
									<div className="w-full bg-gray-200 rounded-full h-2">
										<div
											className="bg-sauti-orange h-2 rounded-full transition-all duration-300"
											style={{ width: `${uploadProgress}%` }}
										></div>
									</div>
									<p className="text-xs text-gray-600">{file.name}</p>
								</>
							) : uploadedUrl ? (
								<>
									<FileText className="h-8 w-8 text-green-600 mx-auto" />
									<p className="text-sm font-medium text-green-800">{file.name}</p>
									<p className="text-xs text-green-600">
										{(file.size / 1024 / 1024).toFixed(2)} MB
									</p>
									<p className="text-xs text-green-600 font-medium">
										✓ Uploaded successfully
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setFile(null);
											setUploading(false);
											setUploadProgress(0);
											setUploadedUrl(null);
											setUploadError(null);
										}}
										className="text-red-600 hover:text-red-700"
									>
										Remove
									</Button>
								</>
							) : uploadError ? (
								<>
									<FileText className="h-8 w-8 text-red-600 mx-auto" />
									<p className="text-sm font-medium text-red-800">{file.name}</p>
									<p className="text-xs text-red-600">{uploadError}</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => startBackgroundUpload(file)}
										className="text-sauti-orange hover:text-sauti-orange/80"
									>
										Retry Upload
									</Button>
								</>
							) : (
								<>
									<FileText className="h-8 w-8 text-blue-600 mx-auto" />
									<p className="text-sm font-medium text-blue-800">{file.name}</p>
									<p className="text-xs text-blue-600">
										{(file.size / 1024 / 1024).toFixed(2)} MB
									</p>
									<p className="text-xs text-blue-600">Ready to upload</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setFile(null);
											setUploading(false);
											setUploadProgress(0);
											setUploadedUrl(null);
											setUploadError(null);
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
							<Upload className="h-8 w-8 text-gray-400 mx-auto" />
							<div>
								<p className="text-sm text-gray-600">
									<span className="font-medium text-sauti-orange">Click to upload</span>{" "}
									or drag and drop
								</p>
								<p className="text-xs text-gray-500 mt-1">
									PDF, JPG, PNG, DOC, DOCX (Max 10MB)
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Hidden File Input */}
				<input
					type="file"
					onChange={handleFileChange}
					accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
					className="hidden"
					id="file-upload"
				/>
			</div>

			<div className="flex flex-col sm:flex-row justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setTitle("");
						setFile(null);
						setUploading(false);
						setUploadProgress(0);
						setUploadedUrl(null);
						setUploadError(null);
						const fileInput = document.getElementById(
							"file-upload"
						) as HTMLInputElement;
						if (fileInput) {
							fileInput.value = "";
						}
					}}
					className="w-full sm:w-auto"
				>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={!title || !file || isUploading || uploading || !uploadedUrl}
					className="gap-2 w-full sm:w-auto"
				>
					{isUploading || uploading ? (
						<>
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
							{uploading ? "Uploading..." : "Saving..."}
						</>
					) : uploadedUrl ? (
						<>
							<Upload className="h-4 w-4" />
							Save Document
						</>
					) : (
						<>
							<Upload className="h-4 w-4" />
							Upload Document
						</>
					)}
				</Button>
			</div>
		</form>
	);
}

interface SupportService {
	id: string;
	name: string;
	service_types: SupportServiceType;
	email?: string | null;
	phone_number?: string | null;
	website?: string | null;
	availability?: string | null;
	verification_status?: string | null;
	verification_notes?: string | null;
	last_verification_check?: string | null;
	accreditation_files_metadata?: any;
	created_at?: string | null;
}

interface SupportServiceSidepanelProps {
	service: SupportService | null;
	userId: string;
	userType: UserType;
	onClose: () => void;
	onUpdate: () => void;
}

export function SupportServiceSidepanel({
	service,
	userId,
	userType,
	onClose,
	onUpdate,
}: SupportServiceSidepanelProps) {
	const [documents, setDocuments] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editData, setEditData] = useState({
		name: "",
		email: "",
		phone_number: "",
		website: "",
		availability: "",
	});
	const [isSaving, setIsSaving] = useState(false);
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	const loadServiceDocuments = useCallback(async () => {
		if (!service) return;

		setIsLoading(true);
		try {
			const { data, error } = await supabase
				.from("support_services")
				.select("accreditation_files_metadata")
				.eq("id", service.id)
				.single();

			if (error) throw error;

			const docs = data?.accreditation_files_metadata
				? Array.isArray(data.accreditation_files_metadata)
					? data.accreditation_files_metadata
					: JSON.parse(data.accreditation_files_metadata)
				: [];

			setDocuments(docs);
		} catch (error) {
			console.error("Error loading service documents:", error);
			toast({
				title: "Error",
				description: "Failed to load service documents",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [service, supabase, toast]);

	useEffect(() => {
		if (service) {
			loadServiceDocuments();
			setEditData({
				name: service.name || "",
				email: service.email || "",
				phone_number: service.phone_number || "",
				website: service.website || "",
				availability: service.availability || "",
			});
		}
	}, [service, loadServiceDocuments]);

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditData({
			name: service?.name || "",
			email: service?.email || "",
			phone_number: service?.phone_number || "",
			website: service?.website || "",
			availability: service?.availability || "",
		});
	};

	const handleSaveEdit = async () => {
		if (!service) return;

		setIsSaving(true);
		try {
			const { error } = await supabase
				.from("support_services")
				.update({
					name: editData.name,
					email: editData.email || null,
					phone_number: editData.phone_number || null,
					website: editData.website || null,
					availability: editData.availability || null,
				})
				.eq("id", service.id);

			if (error) throw error;

			toast({
				title: "Success",
				description: "Service details updated successfully",
			});
			setIsEditing(false);
			onUpdate();
		} catch (error) {
			console.error("Error updating service:", error);
			toast({
				title: "Error",
				description: "Failed to update service details",
				variant: "destructive",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const uploadDocument = async (file: File, title: string) => {
		try {
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				serviceId: service?.id,
				serviceType: service?.service_types,
				fileType: "accreditation",
				fileName: file.name,
				file,
			});

			return {
				title,
				url: result.url,
				fileType: file.type,
				fileSize: file.size,
				uploadedAt: new Date().toISOString(),
				uploaded: true,
			};
		} catch (error) {
			console.error("Error uploading file:", error);
			throw error;
		}
	};

	const saveDocuments = async (newDocuments: any[]) => {
		if (!service) return;

		setIsUploading(true);
		try {
			const { error } = await supabase
				.from("support_services")
				.update({
					accreditation_files_metadata: newDocuments,
				})
				.eq("id", service.id);

			if (error) throw error;

			setDocuments(newDocuments);
			onUpdate();
			toast({
				title: "Success",
				description: "Documents saved successfully",
			});
		} catch (error) {
			console.error("Error saving documents:", error);
			toast({
				title: "Error",
				description: "Failed to save documents",
				variant: "destructive",
			});
		} finally {
			setIsUploading(false);
		}
	};

	const getStatusIcon = (status?: string | null) => {
		switch (status) {
			case "verified":
				return <CheckCircle className="h-4 w-4 text-green-600" />;
			case "rejected":
				return <XCircle className="h-4 w-4 text-red-600" />;
			case "under_review":
				return <Clock className="h-4 w-4 text-yellow-600" />;
			default:
				return <AlertCircle className="h-4 w-4 text-gray-600" />;
		}
	};

	const getStatusColor = (status?: string | null) => {
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

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	const formatDate = (dateString: string | null | undefined) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (!service) return null;

	return (
		<div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[720px] xl:w-[800px] bg-white shadow-2xl border-l z-[60] transform transition-transform duration-300 ease-out translate-y-0 sm:translate-x-0">
			{/* Backdrop for mobile */}
			<div className="fixed inset-0 bg-black/20 sm:hidden" onClick={onClose} />
			<div className="relative h-full flex flex-col bg-white">
				{/* Header - Fixed */}
				<div className="sticky top-0 z-10 bg-white border-b border-gray-200 max-h-[50vh] overflow-y-auto">
					{/* Mobile drag handle */}
					<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-12 h-1.5 rounded-full bg-gray-300" />
					
					{/* Header content */}
					<div className="p-4 sm:p-6">
						{/* Top row with close button and actions */}
						<div className="flex items-start justify-between gap-3 mb-4">
							<div className="flex items-start gap-3 min-w-0 flex-1">
								<button
									onClick={onClose}
									className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 -ml-1"
									aria-label="Close panel"
								>
									<X className="h-5 w-5 text-gray-600" />
								</button>
								
								<div className="min-w-0 flex-1">
									{/* Service name and type */}
									<div className="flex items-center gap-2 mb-2">
										<div className="p-1.5 rounded-lg bg-sauti-orange/10">
											<Building className="h-4 w-4 text-sauti-orange" />
										</div>
										<div className="min-w-0 flex-1">
											{isEditing ? (
												<Input
													value={editData.name}
													onChange={(e) => setEditData({ ...editData, name: e.target.value })}
													className="text-lg font-semibold min-w-0 border-0 p-0 focus:ring-0 focus:border-b-2 focus:border-sauti-orange rounded-none"
													placeholder="Enter service name"
												/>
											) : (
												<h1 className="text-lg font-semibold text-gray-900 truncate">
													{service.name}
												</h1>
											)}
										</div>
									</div>
									
									{/* Service metadata - Compact */}
									<div className="flex flex-wrap items-center gap-2 text-xs mb-3">
										<Badge
											className={`${getStatusColor(service.verification_status)} text-xs font-medium px-2 py-0.5`}
										>
											{service.verification_status || "pending"}
										</Badge>
										<span className="text-gray-600 capitalize">
											{service.service_types.replace("_", " ")} Service
										</span>
										{service.created_at && (
											<span className="text-gray-500">
												{formatDate(service.created_at)}
											</span>
										)}
									</div>

									{/* Availability in Header - Compact */}
									<div className="space-y-1">
										<div className="flex items-center gap-1.5">
											<Clock className="h-3 w-3 text-blue-600" />
											<span className="text-xs font-medium text-gray-700">Availability</span>
										</div>
										{isEditing ? (
											<Textarea
												value={editData.availability || ""}
												onChange={(e) =>
													setEditData({ ...editData, availability: e.target.value })
												}
												placeholder="e.g., 24/7, Mon-Fri 9AM-5PM"
												className="text-xs min-h-[50px] resize-none"
												rows={2}
											/>
										) : (
											<div className="min-h-[50px] px-2 py-2 bg-gray-50 rounded-md border border-gray-200">
												<p className="text-xs text-gray-900 whitespace-pre-wrap leading-relaxed">
													{service.availability || "No availability information provided"}
												</p>
											</div>
										)}
									</div>
								</div>
							</div>
							{/* Action buttons - Compact */}
							<div className="flex items-center gap-1.5">
								{isEditing ? (
									<>
										<Button
											variant="outline"
											size="sm"
											onClick={handleCancelEdit}
											disabled={isSaving}
											className="gap-1 px-3 py-1.5 text-xs font-medium h-8"
										>
											<X className="h-3 w-3" />
											<span className="hidden sm:inline">Cancel</span>
										</Button>
										<Button
											onClick={handleSaveEdit}
											disabled={isSaving || !editData.name.trim()}
											className="gap-1 px-3 py-1.5 text-xs font-medium bg-sauti-orange hover:bg-sauti-orange/90 disabled:opacity-50 h-8"
										>
											{isSaving ? (
												<div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
											) : (
												<Save className="h-3 w-3" />
											)}
											<span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
										</Button>
									</>
								) : (
									<>
										<Button
											variant="outline"
											size="sm"
											onClick={handleEdit}
											className="gap-1 px-3 py-1.5 text-xs font-medium h-8"
										>
											<Edit className="h-3 w-3" />
											<span className="hidden sm:inline">Edit</span>
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="rounded-lg hover:bg-gray-100 transition-colors h-8 w-8"
											onClick={onClose}
											aria-label="Close panel"
										>
											<X className="h-4 w-4 text-gray-600" />
										</Button>
									</>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Content */}
				<div className="">
					<div className="p-4 sm:p-6 space-y-4">
						{/* Contact Information Section - Accordion */}
						<Accordion type="single" collapsible defaultValue="contact" className="w-full">
							<AccordionItem value="contact" className="border border-gray-200 rounded-lg">
								<AccordionTrigger className="px-4 py-3 hover:no-underline">
									<div className="flex items-center gap-2">
										<Shield className="h-4 w-4 text-sauti-orange" />
										<span className="text-base font-semibold text-gray-900">Contact Information</span>
									</div>
								</AccordionTrigger>
								<AccordionContent className="px-4 pb-4">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{/* Email */}
										<div className="space-y-1">
											<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
												Email
											</label>
											{isEditing ? (
												<Input
													value={editData.email || ""}
													onChange={(e) => setEditData({ ...editData, email: e.target.value })}
													placeholder="service@example.com"
													className="text-sm h-9"
													type="email"
												/>
											) : (
												<div className="flex items-center gap-2 h-9 px-3 py-2 bg-gray-50 rounded-md">
													{service.email ? (
														<>
															<a
																href={`mailto:${service.email}`}
																className="font-medium text-blue-600 hover:text-blue-700 hover:underline text-sm truncate flex-1"
															>
																{service.email}
															</a>
															<ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
														</>
													) : (
														<span className="text-gray-500 text-sm">Not provided</span>
													)}
												</div>
											)}
										</div>

										{/* Phone */}
										<div className="space-y-1">
											<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
												Phone
											</label>
											{isEditing ? (
												<Input
													value={editData.phone_number || ""}
													onChange={(e) =>
														setEditData({ ...editData, phone_number: e.target.value })
													}
													placeholder="+1 (555) 123-4567"
													className="text-sm h-9"
													type="tel"
												/>
											) : (
												<div className="flex items-center gap-2 h-9 px-3 py-2 bg-gray-50 rounded-md">
													{service.phone_number ? (
														<>
															<a
																href={`tel:${service.phone_number}`}
																className="font-medium text-blue-600 hover:text-blue-700 hover:underline text-sm flex-1"
															>
																{service.phone_number}
															</a>
															<ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
														</>
													) : (
														<span className="text-gray-500 text-sm">Not provided</span>
													)}
												</div>
											)}
										</div>

										{/* Website - Full width on mobile, spans both columns on desktop */}
										<div className="space-y-1 sm:col-span-2">
											<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
												Website
											</label>
											{isEditing ? (
												<Input
													value={editData.website || ""}
													onChange={(e) => setEditData({ ...editData, website: e.target.value })}
													placeholder="https://example.com"
													className="text-sm h-9"
													type="url"
												/>
											) : (
												<div className="flex items-center gap-2 h-9 px-3 py-2 bg-gray-50 rounded-md">
													{service.website ? (
														<>
															<a
																href={service.website}
																target="_blank"
																rel="noopener noreferrer"
																className="font-medium text-blue-600 hover:text-blue-700 hover:underline text-sm truncate flex-1"
															>
																{service.website}
															</a>
															<ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
														</>
													) : (
														<span className="text-gray-500 text-sm">Not provided</span>
													)}
												</div>
											)}
										</div>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>

					</div>

					{service.verification_notes && (
						<Alert className="mt-4">
							<Shield className="h-4 w-4" />
							<AlertDescription>
								<strong>Verification Notes:</strong> {service.verification_notes}
							</AlertDescription>
						</Alert>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4">
					<div className="space-y-6">

						{/* Documents Section - Compact */}
						<section className="space-y-3">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-2">
									<FileText className="h-4 w-4 text-sauti-orange" />
									<h2 className="text-base font-semibold text-gray-900">Documents</h2>
								</div>
								<Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
									{documents.length}
								</Badge>
							</div>
						<div className="flex items-center justify-between mb-3">	

							<p className="text-xs text-gray-600 mb-4">
								Upload professional credentials for verification
							</p>
							<Button
									onClick={() => setIsUploadModalOpen(true)}
									className="gap-2 px-4 py-2 bg-sauti-orange hover:bg-sauti-orange/90 text-white"
								>
									<Plus className="h-4 w-4" />
									Add Document
								</Button>
								</div>

							{/* Documents List */}
							{isLoading ? (
								<div className="space-y-4">
									{Array.from({ length: 2 }).map((_, i) => (
										<div key={i} className="animate-pulse">
											<div className="h-24 bg-gray-200 rounded-xl" />
										</div>
									))}
								</div>
							) : documents.length === 0 ? (
								<div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/30">
									<div className="p-3 rounded-full bg-gray-100 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
										<FileText className="h-6 w-6 text-gray-400" />
									</div>
									<h3 className="text-sm font-medium text-gray-900 mb-1">No documents uploaded</h3>
									<p className="text-xs text-gray-500">
										Upload your professional credentials to get verified
									</p>
								</div>
							) : (
								<div className="space-y-2">
									{documents.map((doc, index) => (
										<div
											key={index}
											className="group flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-sauti-orange/30 hover:shadow-sm transition-all duration-200"
										>
											<div className="flex items-start gap-3 min-w-0 flex-1">
												<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 group-hover:from-sauti-orange/10 group-hover:to-sauti-orange/20 transition-colors">
													<FileText className="h-5 w-5 text-blue-600 group-hover:text-sauti-orange transition-colors" />
												</div>
												<div className="min-w-0 flex-1">
													<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-1">
														<h4 className="font-medium text-gray-900 text-sm leading-tight">
															{doc.title}
														</h4>
														<div className="flex items-center gap-1 flex-wrap">
															{doc.linked && (
																<Badge
																	variant="outline"
																	className="text-xs bg-blue-50 text-blue-700 border-blue-200 font-medium px-1.5 py-0.5"
																>
																	Linked
																</Badge>
															)}
														</div>
													</div>
													<div className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs text-gray-500">
														<span className="flex items-center gap-1">
															<FileText className="h-3 w-3" />
															{formatFileSize(doc.fileSize || 0)}
														</span>
														<span className="hidden sm:inline">•</span>
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{formatDate(doc.uploadedAt)}
														</span>
													</div>
												</div>
											</div>
											<div className="flex items-center gap-1 flex-shrink-0">
												<Button
													variant="outline"
													size="sm"
													onClick={() => window.open(doc.url, "_blank")}
													className="gap-1 text-xs px-2 py-1.5 hover:bg-sauti-orange/5 hover:border-sauti-orange/30 font-medium h-7"
												>
													<Eye className="h-3 w-3" />
													<span className="hidden sm:inline">View</span>
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={async () => {
														try {
															await fileUploadService.deleteFile(doc.url, "accreditation");
															const updatedDocs = documents.filter((_, i) => i !== index);
															await saveDocuments(updatedDocs);
															toast({
																title: "Document Deleted",
																description: "Document has been removed successfully",
															});
														} catch (error) {
															toast({
																title: "Delete Failed",
																description: "Failed to delete document",
																variant: "destructive",
															});
														}
													}}
													className="gap-1 text-xs px-2 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium h-7"
												>
													<Trash2 className="h-3 w-3" />
													<span className="hidden sm:inline">Delete</span>
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</section>
					</div>
				</div>

				{/* Upload Modal */}
				<Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
					<DialogContent className="sm:max-w-md z-[70]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-sauti-orange" />
								Add Document
							</DialogTitle>
							<DialogDescription>
								Upload your professional credentials and supporting documents for verification
							</DialogDescription>
						</DialogHeader>
						<div className="mt-4">
							<AddDocumentForm
								onSave={async (title, file) => {
									try {
										const newDoc = await uploadDocument(file, title);
										const updatedDocs = [...documents, newDoc];
										await saveDocuments(updatedDocs);
										setIsUploadModalOpen(false);
										toast({
											title: "Document Uploaded",
											description: "Document has been uploaded successfully",
										});
									} catch (error) {
										toast({
											title: "Upload Failed",
											description: "Failed to upload document. Please try again.",
											variant: "destructive",
										});
									}
								}}
								isUploading={isUploading}
								userId={userId}
								userType={userType}
								serviceId={service?.id || ""}
								serviceType={service?.service_types || "counseling"}
							/>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
