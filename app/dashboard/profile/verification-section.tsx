"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { VerificationDashboard } from "./verification-dashboard";

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

	useEffect(() => {
		loadVerificationData();
	}, [userId, userType]);

	const loadVerificationData = async () => {
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
	};

	const loadVerificationStatus = async () => {
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
	};

	const loadDocuments = async () => {
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
	};

	const loadServices = async () => {
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
	};

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
			{/* Header with Refresh */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">Verification Status</h2>
					<p className="text-gray-600 mt-1">
						Track your professional verification progress and document status
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => setViewMode("dashboard")}
						className="gap-2"
					>
						<TrendingUp className="h-4 w-4" />
						Dashboard
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

			{/* Overall Status Card */}
			<Card className="border-2">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-6 w-6 text-sauti-orange" />
						Overall Verification Status
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{getStatusIcon(verificationStatus.overall)}
							<div>
								<h3 className="text-lg font-semibold capitalize">
									{verificationStatus.overall.replace("_", " ")}
								</h3>
								<p className="text-sm text-gray-600">
									Last checked: {formatDate(verificationStatus.lastChecked)}
								</p>
							</div>
						</div>
						<Badge className={getStatusColor(verificationStatus.overall)}>
							{verificationStatus.overall.replace("_", " ")}
						</Badge>
					</div>

					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span>Verification Progress</span>
							<span>{getProgressPercentage()}%</span>
						</div>
						<Progress value={getProgressPercentage()} className="h-2" />
					</div>

					{verificationStatus.verificationNotes && (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertDescription>
								<strong>Admin Notes:</strong> {verificationStatus.verificationNotes}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			{/* Professional Verification Steps */}
			<div className="grid gap-6 md:grid-cols-2">
				{/* Professional Credentials Verification */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<FileText className="h-5 w-5 text-sauti-orange" />
							Professional Credentials
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-600">Status</span>
							<Badge className={getStatusColor(verificationStatus.documents)}>
								{verificationStatus.documents.replace("_", " ")}
							</Badge>
						</div>
						<div className="text-xs text-gray-500">
							{documents.length} credential document{documents.length !== 1 ? "s" : ""}{" "}
							uploaded
						</div>
						<div className="text-xs text-gray-400">
							Licenses, certifications, degrees, and professional qualifications
						</div>
					</CardContent>
				</Card>

				{/* Support Services Verification (NGO only) */}
				{userType === "ngo" && (
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-lg">
								<Building className="h-5 w-5 text-sauti-orange" />
								Support Services
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600">Status</span>
								<Badge className={getStatusColor(verificationStatus.services)}>
									{verificationStatus.services.replace("_", " ")}
								</Badge>
							</div>
							<div className="text-xs text-gray-500">
								{services.length} service{services.length !== 1 ? "s" : ""} registered
								with credentials
							</div>
							<div className="text-xs text-gray-400">
								Each service requires appropriate accreditation documents
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Professional Credentials Section */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-sauti-orange" />
						Professional Credentials & Accreditation
					</CardTitle>
					<p className="text-sm text-gray-600 mt-2">
						Upload your professional licenses, certifications, degrees, and other
						qualifying documents
					</p>
				</CardHeader>
				<CardContent>
					{documents.length === 0 ? (
						<div className="text-center py-8">
							<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
							<p className="text-gray-500">No professional credentials uploaded yet</p>
							<p className="text-sm text-gray-400 mt-1">
								Upload your professional licenses, certifications, and degrees to get
								verified
							</p>
							<div className="mt-4">
								<Button className="gap-2">
									<Upload className="h-4 w-4" />
									Upload Credentials
								</Button>
							</div>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Document</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Size</TableHead>
									<TableHead>Uploaded</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{documents.map((doc) => (
									<TableRow key={doc.id}>
										<TableCell className="font-medium">{doc.title}</TableCell>
										<TableCell className="text-sm text-gray-600">
											{doc.fileType.toUpperCase()}
										</TableCell>
										<TableCell className="text-sm text-gray-600">
											{formatFileSize(doc.fileSize)}
										</TableCell>
										<TableCell className="text-sm text-gray-600">
											{formatDate(doc.uploadedAt)}
										</TableCell>
										<TableCell>
											<Badge className={getStatusColor(doc.status)}>
												{doc.status.replace("_", " ")}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<Dialog>
													<DialogTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => setSelectedDocument(doc)}
														>
															<Eye className="h-4 w-4" />
														</Button>
													</DialogTrigger>
													<DialogContent className="max-w-2xl">
														<DialogHeader>
															<DialogTitle>{doc.title}</DialogTitle>
															<DialogDescription>
																Document details and preview
															</DialogDescription>
														</DialogHeader>
														<div className="space-y-4">
															<div className="grid grid-cols-2 gap-4">
																<div>
																	<label className="text-sm font-medium text-gray-600">
																		File Type
																	</label>
																	<p className="text-sm">{doc.fileType.toUpperCase()}</p>
																</div>
																<div>
																	<label className="text-sm font-medium text-gray-600">
																		File Size
																	</label>
																	<p className="text-sm">{formatFileSize(doc.fileSize)}</p>
																</div>
																<div>
																	<label className="text-sm font-medium text-gray-600">
																		Uploaded
																	</label>
																	<p className="text-sm">{formatDate(doc.uploadedAt)}</p>
																</div>
																<div>
																	<label className="text-sm font-medium text-gray-600">
																		Status
																	</label>
																	<Badge className={getStatusColor(doc.status)}>
																		{doc.status.replace("_", " ")}
																	</Badge>
																</div>
															</div>
															{doc.notes && (
																<div>
																	<label className="text-sm font-medium text-gray-600">
																		Notes
																	</label>
																	<p className="text-sm">{doc.notes}</p>
																</div>
															)}
															<div className="flex gap-2">
																<Button
																	variant="outline"
																	onClick={() => window.open(doc.url, "_blank")}
																	className="gap-2"
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
																	className="gap-2"
																>
																	<Download className="h-4 w-4" />
																	Download
																</Button>
															</div>
														</div>
													</DialogContent>
												</Dialog>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Support Services Accreditation (NGO only) */}
			{userType === "ngo" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Building className="h-5 w-5 text-sauti-orange" />
							Support Services Accreditation
						</CardTitle>
						<p className="text-sm text-gray-600 mt-2">
							Each support service requires appropriate accreditation documents for
							verification
						</p>
					</CardHeader>
					<CardContent>
						{services.length === 0 ? (
							<div className="text-center py-8">
								<Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<p className="text-gray-500">No support services registered yet</p>
								<p className="text-sm text-gray-400 mt-1">
									Register your support services and upload their accreditation documents
								</p>
								<div className="mt-4">
									<Button className="gap-2">
										<Plus className="h-4 w-4" />
										Add Support Service
									</Button>
								</div>
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

										{service.documents.length > 0 ? (
											<div className="mt-3">
												<p className="text-sm font-medium text-gray-600 mb-2">
													Service Accreditation Documents ({service.documents.length})
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
										) : (
											<div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
												<p className="text-sm text-yellow-800">
													<strong>Action Required:</strong> This service needs accreditation
													documents for verification
												</p>
												<Button size="sm" variant="outline" className="mt-2 gap-2">
													<Upload className="h-3 w-3" />
													Upload Documents
												</Button>
											</div>
										)}

										{service.notes && (
											<div className="mt-3 p-2 bg-blue-50 rounded">
												<p className="text-sm text-blue-800">
													<strong>Verification Notes:</strong> {service.notes}
												</p>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Verification Timeline */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-sauti-orange" />
						Verification Timeline
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center gap-3">
							<div className="w-3 h-3 bg-green-500 rounded-full"></div>
							<div>
								<p className="text-sm font-medium">Profile Created</p>
								<p className="text-xs text-gray-600">
									{formatDate(profile?.created_at || new Date().toISOString())}
								</p>
							</div>
						</div>

						{documents.length > 0 && (
							<div className="flex items-center gap-3">
								<div className="w-3 h-3 bg-blue-500 rounded-full"></div>
								<div>
									<p className="text-sm font-medium">Documents Uploaded</p>
									<p className="text-xs text-gray-600">
										{documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
										uploaded
									</p>
								</div>
							</div>
						)}

						{verificationStatus.lastChecked && (
							<div className="flex items-center gap-3">
								<div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
								<div>
									<p className="text-sm font-medium">Last Verification Check</p>
									<p className="text-xs text-gray-600">
										{formatDate(verificationStatus.lastChecked)}
									</p>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
