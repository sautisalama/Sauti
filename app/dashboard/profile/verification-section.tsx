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
		<div className="space-y-4">
			{/* Add Document Button */}
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Add Professional Documents</h3>
				<Button onClick={addDocument} className="gap-2">
					<Plus className="h-4 w-4" />
					Add Document
				</Button>
			</div>

			{/* Document Forms */}
			<div className="space-y-4">
				{documents.map((doc) => (
					<Card key={doc.id} className="border-2 border-dashed border-gray-200">
						<CardContent className="p-4">
							<div className="flex items-center justify-between mb-4">
								<h4 className="font-medium">Document {documents.indexOf(doc) + 1}</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => removeDocument(doc.id)}
									className="text-red-600 hover:text-red-700"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-700">
										Document Title *
									</label>
									<Input
										placeholder="e.g., Medical License, PhD Certificate"
										value={doc.title}
										onChange={(e) => updateDocument(doc.id, "title", e.target.value)}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-700">
										Certificate/License Number *
									</label>
									<Input
										placeholder="e.g., MD-12345, PhD-2023-001"
										value={doc.certificateNumber}
										onChange={(e) =>
											updateDocument(doc.id, "certificateNumber", e.target.value)
										}
									/>
								</div>
							</div>

							<div className="space-y-2 mt-4">
								<label className="text-sm font-medium text-gray-700">
									Upload File *
								</label>
								<Input
									type="file"
									accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
									onChange={(e) =>
										updateDocument(doc.id, "file", e.target.files?.[0] || null)
									}
									className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sauti-orange file:text-white hover:file:bg-sauti-orange/90"
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
						className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90"
					>
						{isUploading ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
								Uploading...
							</>
						) : (
							<>
								<Upload className="h-4 w-4" />
								Upload {documents.length} Document{documents.length !== 1 ? "s" : ""}
							</>
						)}
					</Button>
				</div>
			)}

			{documents.length === 0 && (
				<div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
					<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-700 mb-2">
						No Documents Added
					</h3>
					<p className="text-gray-500 mb-4">
						Click "Add Document" to start uploading your professional credentials
					</p>
					<Button
						onClick={addDocument}
						className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90"
					>
						<Plus className="h-4 w-4" />
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
			// Load documents from profile accreditation_files_metadata
			const { data: profileData } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			if (profileData?.accreditation_files_metadata) {
				const docs = Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata);

				setDocuments(
					docs.map((doc: any, index: number) => ({
						id: `doc-${index}`,
						title: doc.title || "Untitled Document",
						url: doc.url || "",
						fileType: doc.fileType || "unknown",
						fileSize: doc.fileSize || 0,
						uploadedAt: doc.uploadedAt || new Date().toISOString(),
						serviceId: doc.serviceId,
						serviceType: doc.serviceType,
						status: "under_review" as const,
						notes: doc.notes,
					}))
				);
			}
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

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
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
			<div className="grid gap-6 xl:grid-cols-6">
				{/* Document Upload Form - Left Side (3/5 width) */}
				<div className="xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-sauti-orange" />
								Professional Credentials
							</CardTitle>
							<p className="text-sm text-gray-600">
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

				{/* Uploaded Documents List - Right Side (2/5 width) */}
				<div className="xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<CheckSquare className="h-5 w-5 text-sauti-orange" />
								Uploaded Documents ({documents.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							{documents.length === 0 ? (
								<div className="text-center py-12">
									<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center">
										<FileText className="h-8 w-8 text-sky-600" />
									</div>
									<h3 className="text-lg font-semibold text-gray-900 mb-2">
										No documents uploaded yet
									</h3>
									<p className="text-gray-500 text-sm">
										Your uploaded documents will appear here
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{documents.map((doc) => (
										<div
											key={doc.id}
											className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md group"
										>
											<div className="p-4">
												{/* Header */}
												<div className="flex items-start justify-between mb-3">
													<div className="flex items-center gap-3 flex-1 min-w-0">
														<div
															className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
																getStatusColor(doc.status).includes("green")
																	? "bg-gradient-to-br from-green-100 to-green-200 text-green-700"
																	: getStatusColor(doc.status).includes("yellow")
																	? "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700"
																	: getStatusColor(doc.status).includes("red")
																	? "bg-gradient-to-br from-red-100 to-red-200 text-red-700"
																	: "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
															}`}
														>
															<FileText className="h-5 w-5" />
														</div>
														<div className="min-w-0 flex-1">
															<h4 className="font-semibold text-gray-900 truncate">
																{doc.title}
															</h4>
															<div className="flex items-center gap-2 text-sm text-gray-500">
																<span className="font-mono text-xs">
																	{doc.fileType.toUpperCase()}
																</span>
																<span>•</span>
																<span>{formatFileSize(doc.fileSize)}</span>
																<span>•</span>
																<span>{formatDate(doc.uploadedAt)}</span>
															</div>
														</div>
													</div>
													<div className="flex items-center gap-2 flex-shrink-0">
														<Badge className={`${getStatusColor(doc.status)} border`}>
															{doc.status.replace("_", " ")}
														</Badge>
													</div>
												</div>

												{/* Actions */}
												<div className="flex gap-2">
													<Dialog>
														<DialogTrigger asChild>
															<Button variant="outline" size="sm" className="flex-1 gap-2">
																<Eye className="h-4 w-4" />
																View Details
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
														className="gap-2"
													>
														<Download className="h-4 w-4" />
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
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building className="h-5 w-5 text-sauti-orange" />
							Support Services ({services.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{services.length === 0 ? (
							<div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
								<Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-gray-700 mb-2">
									No Services Registered
								</h3>
								<p className="text-gray-500 mb-4">
									Register your support services to get verified
								</p>
								<Button className="gap-2 bg-sauti-orange hover:bg-sauti-orange/90">
									<Plus className="h-4 w-4" />
									Add Support Service
								</Button>
							</div>
						) : (
							<div className="space-y-4">
								{services.map((service) => (
									<div key={service.id} className="border rounded-lg p-4">
										<div className="flex items-center justify-between mb-3">
											<div>
												<h4 className="font-semibold">{service.name}</h4>
												<p className="text-sm text-gray-600 capitalize">
													{service.serviceType.replace("_", " ")} Service
												</p>
											</div>
											<Badge className={getStatusColor(service.status)}>
												{service.status.replace("_", " ")}
											</Badge>
										</div>
										{service.documents.length > 0 && (
											<div className="mt-3">
												<p className="text-sm font-medium text-gray-600 mb-2">
													Documents ({service.documents.length})
												</p>
												<div className="space-y-2">
													{service.documents.map((doc) => (
														<div
															key={doc.id}
															className="flex items-center justify-between p-2 bg-gray-50 rounded"
														>
															<div className="flex items-center gap-2">
																<FileText className="h-4 w-4 text-gray-600" />
																<span className="text-sm">{doc.title}</span>
															</div>
															<Badge className={getStatusColor(doc.status)}>
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
