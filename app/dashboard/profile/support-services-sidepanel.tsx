"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

interface SupportService {
	id: string;
	name: string;
	service_types: SupportServiceType;
	email?: string;
	phone_number?: string;
	website?: string;
	availability?: string;
	verification_status?: string;
	verification_notes?: string;
	last_verification_check?: string;
	accreditation_files_metadata?: any;
	created_at?: string;
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
	const [showAddDocument, setShowAddDocument] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		if (service) {
			loadServiceDocuments();
		}
	}, [service]);

	const loadServiceDocuments = async () => {
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
	};

	const uploadDocument = async (file: File, title: string, note?: string) => {
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
				note: note || "",
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
					updated_at: new Date().toISOString(),
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

	const getStatusIcon = (status?: string) => {
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

	const getStatusColor = (status?: string) => {
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

	const formatDate = (dateString: string) => {
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
		<div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[720px] bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 ease-out translate-y-0 sm:translate-x-0">
			<div className="h-full flex flex-col bg-gray-50">
				{/* Header */}
				<div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
					<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-12 h-1.5 rounded-full bg-gray-300" />

					{/* Top row with close button */}
					<div className="flex items-start justify-between gap-3 mb-4">
						<div className="flex items-start gap-3 min-w-0 flex-1">
							<button
								onClick={onClose}
								className="sm:hidden -ml-1 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
							>
								<X className="h-4 w-4 text-gray-600" />
							</button>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 mb-1">
									<Building className="h-5 w-5 text-sauti-orange" />
									<h2 className="text-lg font-semibold text-gray-900 truncate">
										{service.name}
									</h2>
									<Badge className={getStatusColor(service.verification_status)}>
										{service.verification_status || "pending"}
									</Badge>
								</div>
								<div className="flex items-center gap-3 text-xs text-gray-500">
									<span className="capitalize">
										{service.service_types.replace("_", " ")} Service
									</span>
									{service.created_at && (
										<span>Created {formatDate(service.created_at)}</span>
									)}
								</div>
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="rounded-lg hover:bg-gray-100 transition-colors h-8 w-8"
							onClick={onClose}
						>
							<X className="h-4 w-4 text-gray-600" />
						</Button>
					</div>

					{/* Service Details */}
					<div className="grid grid-cols-2 gap-4 text-sm">
						{service.email && (
							<div>
								<span className="text-gray-600">Email:</span>
								<p className="font-medium">{service.email}</p>
							</div>
						)}
						{service.phone_number && (
							<div>
								<span className="text-gray-600">Phone:</span>
								<p className="font-medium">{service.phone_number}</p>
							</div>
						)}
						{service.website && (
							<div className="col-span-2">
								<span className="text-gray-600">Website:</span>
								<a
									href={service.website}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-blue-600 hover:underline flex items-center gap-1"
								>
									{service.website}
									<ExternalLink className="h-3 w-3" />
								</a>
							</div>
						)}
						{service.availability && (
							<div className="col-span-2">
								<span className="text-gray-600">Availability:</span>
								<p className="font-medium">{service.availability}</p>
							</div>
						)}
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
						{/* Documents Section */}
						<Card>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2 text-base">
										<FileText className="h-4 w-4 text-sauti-orange" />
										Accreditation Documents ({documents.length})
									</CardTitle>
									<Dialog open={showAddDocument} onOpenChange={setShowAddDocument}>
										<DialogTrigger asChild>
											<Button size="sm" className="gap-2">
												<Plus className="h-4 w-4" />
												Add Document
											</Button>
										</DialogTrigger>
										<DialogContent className="max-w-md">
											<DialogHeader>
												<DialogTitle>Add Document</DialogTitle>
												<DialogDescription>
													Upload accreditation documents for this service
												</DialogDescription>
											</DialogHeader>
											<AddDocumentForm
												onSave={async (title, file, note) => {
													try {
														const newDoc = await uploadDocument(file, title, note);
														const updatedDocs = [...documents, newDoc];
														await saveDocuments(updatedDocs);
														setShowAddDocument(false);
													} catch (error) {
														toast({
															title: "Error",
															description: "Failed to upload document",
															variant: "destructive",
														});
													}
												}}
												isUploading={isUploading}
											/>
										</DialogContent>
									</Dialog>
								</div>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="space-y-3">
										{Array.from({ length: 2 }).map((_, i) => (
											<div key={i} className="animate-pulse">
												<div className="h-16 bg-gray-200 rounded" />
											</div>
										))}
									</div>
								) : documents.length === 0 ? (
									<div className="text-center py-8">
										<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
										<h3 className="text-lg font-semibold text-gray-700 mb-2">
											No documents uploaded
										</h3>
										<p className="text-gray-500 text-sm">
											Upload accreditation documents for this service
										</p>
									</div>
								) : (
									<div className="space-y-3">
										{documents.map((doc, index) => (
											<div
												key={index}
												className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
											>
												<div className="flex items-center gap-3 min-w-0 flex-1">
													<div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
														<FileText className="h-5 w-5 text-blue-600" />
													</div>
													<div className="min-w-0 flex-1">
														<h4 className="font-medium text-gray-900 truncate">
															{doc.title}
														</h4>
														<div className="flex items-center gap-2 text-xs text-gray-500">
															<span>{formatFileSize(doc.fileSize || 0)}</span>
															<span>•</span>
															<span>{formatDate(doc.uploadedAt)}</span>
														</div>
														{doc.note && (
															<p className="text-xs text-gray-600 mt-1 line-clamp-1">
																{doc.note}
															</p>
														)}
													</div>
												</div>
												<div className="flex items-center gap-2 flex-shrink-0">
													<Button
														variant="outline"
														size="sm"
														onClick={() => window.open(doc.url, "_blank")}
														className="gap-1"
													>
														<Eye className="h-3 w-3" />
														View
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => {
															const link = document.createElement("a");
															link.href = doc.url;
															link.download = doc.title;
															link.click();
														}}
														className="gap-1"
													>
														<Download className="h-3 w-3" />
													</Button>
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}

// Add Document Form Component
function AddDocumentForm({
	onSave,
	isUploading,
}: {
	onSave: (title: string, file: File, note?: string) => void;
	isUploading: boolean;
}) {
	const [title, setTitle] = useState("");
	const [note, setNote] = useState("");
	const [file, setFile] = useState<File | null>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (title && file) {
			onSave(title, file, note);
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
				<input
					type="file"
					onChange={(e) => setFile(e.target.files?.[0] || null)}
					accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
					className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
					required
				/>
				<p className="text-xs text-gray-500 mt-1">
					Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
				</p>
			</div>

			<div>
				<label className="text-sm font-medium text-gray-700">
					Notes (Optional)
				</label>
				<textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
					placeholder="Additional notes about this document"
					rows={3}
				/>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setTitle("");
						setNote("");
						setFile(null);
					}}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={!title || !file || isUploading}
					className="gap-2"
				>
					{isUploading ? (
						<>
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
							Uploading...
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
