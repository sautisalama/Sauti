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
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { VerificationDashboard } from "./verification-dashboard";
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
}

export function DocumentUploadForm({
	userId,
	userType,
	onUploadSuccess,
}: DocumentUploadFormProps) {
	const [documents, setDocuments] = useState<DocumentFormData[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	const addDocument = () => {
		const newDoc: DocumentFormData = {
			id: `doc-${Date.now()}`,
			title: "",
			certificateNumber: "",
			file: null,
			uploaded: false,
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
			const documentsToSave: any[] = [];

			for (const doc of documents) {
				if (!doc.title.trim() || !doc.file) continue;

				const url = await uploadDocument(doc);
				if (url) {
					documentsToSave.push({
						title: doc.title,
						certificateNumber: doc.certificateNumber,
						url,
						fileType: doc.file?.type || "unknown",
						fileSize: doc.file?.size || 0,
						uploadedAt: new Date().toISOString(),
						uploaded: true,
					});
				}
			}

			if (documentsToSave.length > 0) {
				// Update profile with new documents
				const { error } = await supabase
					.from("profiles")
					.update({
						accreditation_files_metadata: documentsToSave,
						updated_at: new Date().toISOString(),
					})
					.eq("id", userId);

				if (error) throw error;

				toast({
					title: "Success",
					description: `${documentsToSave.length} document(s) uploaded successfully`,
				});

				// Clear form
				setDocuments([]);
				onUploadSuccess?.();
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
							<div className="flex items-center justify-between mb-3 sm:mb-4">
								<h4 className="font-medium text-sm sm:text-base">
									Document {documents.indexOf(doc) + 1}
								</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => removeDocument(doc.id)}
									className="text-red-600 hover:text-red-700 p-1 sm:p-2"
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
								<Input
									type="file"
									accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
									onChange={(e) =>
										updateDocument(doc.id, "file", e.target.files?.[0] || null)
									}
									className="file:mr-2 sm:file:mr-4 file:py-1 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded-md sm:file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-sauti-orange file:text-white hover:file:bg-sauti-orange/90 text-sm sm:text-base"
								/>
								<p className="text-xs text-gray-500">
									Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
								</p>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Save Button */}
			{documents.length > 0 && (
				<div className="flex justify-end">
					<Button
						onClick={saveDocuments}
						disabled={
							isUploading || documents.some((doc) => !doc.title.trim() || !doc.file)
						}
						className="gap-1 sm:gap-2 bg-sauti-orange hover:bg-sauti-orange/90 text-xs sm:text-sm"
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

			{documents.length === 0 && (
				<div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg border border-gray-200 sm:border-2 sm:border-dashed">
					<FileText className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
					<h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
						No Documents Added
					</h3>
					<p className="text-gray-500 mb-3 sm:mb-4 text-sm">
						Click "Add Document" to start uploading your professional credentials
					</p>
					<Button
						onClick={addDocument}
						className="gap-1 sm:gap-2 bg-sauti-orange hover:bg-sauti-orange/90 text-xs sm:text-sm"
						size="sm"
					>
						<Plus className="h-3 w-3 sm:h-4 sm:w-4" />
						Add Your First Document
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
	const supabase = createClient();
	const { toast } = useToast();

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
			// Load documents from profile accreditation_files_metadata; seed from provider if available to avoid skeleton flicker
			// Instant seed from provider snapshot
			const seededDocCount = (dash?.data as any)?.verification?.documentsCount;
			if (typeof seededDocCount === "number" && seededDocCount >= 0) {
				// We can't reconstruct full docs without metadata, so we proceed to fetch; seeding could drive counters/UI elsewhere
			}
			const { data: profileData } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata, accreditation_files")
				.eq("id", userId)
				.single();

			const metaDocsRaw = profileData?.accreditation_files_metadata
				? (Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata))
				: [];
			const legacyDocsRaw = profileData?.accreditation_files
				? (Array.isArray(profileData.accreditation_files)
					? profileData.accreditation_files
					: JSON.parse(profileData.accreditation_files))
				: [];
			// Build lookup by url or title to merge notes/description from legacy docs
			const legacyByUrl = new Map<string, any>();
			const legacyByTitle = new Map<string, any>();
			(legacyDocsRaw || []).forEach((ld: any) => {
				if (ld?.url) legacyByUrl.set(ld.url, ld);
				if (ld?.title) legacyByTitle.set(ld.title, ld);
			});

			const merged = (metaDocsRaw || []).map((doc: any, index: number) => {
				const keyUrl = doc?.url;
				const keyTitle = doc?.title;
				const legacy = (keyUrl && legacyByUrl.get(keyUrl)) || (keyTitle && legacyByTitle.get(keyTitle)) || {};
				return {
					id: `doc-${index}`,
					title: doc.title || legacy.title || "Untitled Document",
					url: doc.url || legacy.url || "",
					fileType: doc.fileType || legacy.fileType || "unknown",
					fileSize: doc.fileSize || legacy.fileSize || 0,
					uploadedAt: doc.uploadedAt || legacy.uploadedAt || new Date().toISOString(),
					serviceId: doc.serviceId || legacy.serviceId,
					serviceType: doc.serviceType || legacy.serviceType,
					status: (doc.status || legacy.status || "under_review") as any,
					notes: doc.notes || legacy.note || legacy.notes,
				};
			});

			setDocuments(merged);
		} catch (error) {
			console.error("Error loading documents:", error);
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
				userType === "ngo" ? loadServices() : Promise.resolve(),
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
	}, [userType, loadVerificationStatus, loadDocuments, loadServices, toast]);

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
					.select("verification_status, last_verification_check, accreditation_files_metadata")
					.eq("id", userId)
					.single();
				const docs = data?.accreditation_files_metadata
					? (Array.isArray(data.accreditation_files_metadata)
						? data.accreditation_files_metadata
						: JSON.parse(data.accreditation_files_metadata))
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

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sauti-orange mx-auto"></div>
						<p className="mt-4 text-gray-600">Loading verification data...</p>
					</div>
				</div>
			</div>
		);
	}

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
			{/* Notifications at the top */}
			<div className="space-y-3">
				{/* Verification Status Alert */}
				<Alert
					className={`${
						verificationStatus.overall === "verified"
							? "border-green-200 bg-green-50"
							: verificationStatus.overall === "rejected"
							? "border-red-200 bg-red-50"
							: "border-yellow-200 bg-yellow-50"
					}`}
				>
					{getStatusIcon(verificationStatus.overall)}
					<AlertDescription
						className={`${
							verificationStatus.overall === "verified"
								? "text-green-800"
								: verificationStatus.overall === "rejected"
								? "text-red-800"
								: "text-yellow-800"
						}`}
					>
						<strong>Verification Status:</strong>{" "}
						{verificationStatus.overall.replace("_", " ").toUpperCase()}
						{verificationStatus.verificationNotes && (
							<span className="block mt-1 text-sm">
								<strong>Notes:</strong> {verificationStatus.verificationNotes}
							</span>
						)}
					</AlertDescription>
				</Alert>

				{/* Progress Alert */}
				<Alert className="border-blue-200 bg-blue-50">
					<Info className="h-4 w-4 text-blue-600" />
					<AlertDescription className="text-blue-800">
						<strong>Progress:</strong> {getProgressPercentage()}% complete (
						{documents.length} document{documents.length !== 1 ? "s" : ""} uploaded)
						{userType === "ngo" && (
							<span>
								{" "}
								• {services.length} service{services.length !== 1 ? "s" : ""} registered
							</span>
						)}
					</AlertDescription>
				</Alert>
			</div>

			{/* Document Upload and List Section */}
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-6">
				{/* Document Upload Form - Left Side */}
				<div className="lg:col-span-1 xl:col-span-3">
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
															<h4 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
																{doc.title}
															</h4>
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
														<DialogContent className="max-w-2xl">
															<DialogHeader>
																<DialogTitle className="flex items-center gap-2">
																	<FileText className="h-5 w-5 text-sauti-orange" />
																	{doc.title}
																</DialogTitle>
																<DialogDescription>
																	Professional credential document details
																</DialogDescription>
															</DialogHeader>
															<div className="space-y-6">
																<div className="grid grid-cols-2 gap-4">
																	<div className="space-y-1">
																		<label className="text-sm font-medium text-gray-600">
																			File Type
																		</label>
																		<p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
																			{doc.fileType.toUpperCase()}
																		</p>
																	</div>
																	<div className="space-y-1">
																		<label className="text-sm font-medium text-gray-600">
																			File Size
																		</label>
																		<p className="text-sm">{formatFileSize(doc.fileSize)}</p>
																	</div>
																	<div className="space-y-1">
																		<label className="text-sm font-medium text-gray-600">
																			Uploaded
																		</label>
																		<p className="text-sm">{formatDate(doc.uploadedAt)}</p>
																	</div>
																	<div className="space-y-1">
																		<label className="text-sm font-medium text-gray-600">
																			Status
																		</label>
																		<Badge className={getStatusColor(doc.status)}>
																			{doc.status.replace("_", " ")}
																		</Badge>
																	</div>
																</div>
																{doc.notes && (
																	<div className="space-y-1">
																		<label className="text-sm font-medium text-gray-600">
																			Notes
																		</label>
																		<p className="text-sm bg-gray-50 p-3 rounded border">
																			{doc.notes}
																		</p>
																	</div>
																)}
																<div className="flex gap-3 pt-4 border-t">
																	<Button
																		variant="outline"
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
															className="flex items-center justify-between p-2 bg-gray-50 rounded"
														>
															<div className="flex items-center gap-2 min-w-0 flex-1">
																<FileText className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600 flex-shrink-0" />
																<span className="text-xs sm:text-sm truncate">{doc.title}</span>
															</div>
															<Badge
																className={`${getStatusColor(
																	doc.status
																)} text-xs flex-shrink-0`}
															>
																{doc.status.replace("_", " ")}
															</Badge>
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
		</div>
	);
}
