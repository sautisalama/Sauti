"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileFileUpload } from "@/components/ui/mobile-file-upload";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fileUploadService } from "@/lib/file-upload";
import { CheckCircle, AlertCircle, FileText, Plus, Trash2, X } from "lucide-react";

interface DocumentData {
	id: string;
	title: string;
	fileUrl?: string;
	uploaded: boolean;
	uploading: boolean;
	file?: File;
	status?: string;
}

interface MobileSupportServicesSidepanelProps {
	userId: string;
	userType: "professional" | "ngo" | "survivor";
	serviceId: string;
	serviceType: string;
	onUploadSuccess?: () => void;
	onClose?: () => void;
}

export function MobileSupportServicesSidepanel({
	userId,
	userType,
	serviceId,
	serviceType,
	onUploadSuccess,
	onClose,
}: MobileSupportServicesSidepanelProps) {
	const [documents, setDocuments] = useState<DocumentData[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	// Load existing documents
	useEffect(() => {
		loadDocuments();
	}, [serviceId]);

	const loadDocuments = async () => {
		try {
			const { data: serviceData } = await supabase
				.from("support_services")
				.select("accreditation_files_metadata")
				.eq("id", serviceId)
				.eq("user_id", userId)
				.single();

			if (serviceData?.accreditation_files_metadata) {
				const metadata = Array.isArray(serviceData.accreditation_files_metadata)
					? serviceData.accreditation_files_metadata
					: JSON.parse(serviceData.accreditation_files_metadata);

				const docs = metadata.map((doc: any, index: number) => ({
					id: `doc-${index}`,
					title: doc.title || `Document ${index + 1}`,
					fileUrl: doc.url,
					uploaded: !!doc.url,
					status: doc.status || "under_review",
				}));

				setDocuments(docs);
			}
		} catch (error) {
			console.error("Error loading service documents:", error);
		}
	};

	const addDocument = () => {
		const newDoc: DocumentData = {
			id: `doc-${Date.now()}`,
			title: "",
			uploaded: false,
			uploading: false,
		};
		setDocuments(prev => [...prev, newDoc]);
	};

	const removeDocument = (id: string) => {
		setDocuments(prev => prev.filter(doc => doc.id !== id));
	};

	const updateDocument = (id: string, field: keyof DocumentData, value: any) => {
		setDocuments(prev =>
			prev.map(doc => (doc.id === id ? { ...doc, [field]: value } : doc))
		);
	};

	const handleFileUpload = async (id: string, fileData: { url: string; fileName: string; filePath: string }) => {
		updateDocument(id, "fileUrl", fileData.url);
		updateDocument(id, "uploaded", true);
		updateDocument(id, "uploading", false);
		
		// Auto-fill title if empty
		const doc = documents.find(d => d.id === id);
		if (doc && !doc.title) {
			updateDocument(id, "title", fileData.fileName.replace(/\.[^/.]+$/, ""));
		}
	};

	const handleFileUploadStart = (id: string, file: File) => {
		updateDocument(id, "file", file);
		updateDocument(id, "uploading", true);
		updateDocument(id, "uploaded", false);
	};

	const handleFileUploadError = (id: string, error: string) => {
		updateDocument(id, "uploading", false);
		updateDocument(id, "uploaded", false);
		// Keep the file for retry
	};

	const saveDocuments = async () => {
		if (documents.length === 0) {
			toast({
				title: "No Documents",
				description: "Please add at least one document to upload.",
				variant: "destructive",
			});
			return;
		}

		// Check for documents that are still uploading
		const uploadingDocs = documents.filter(doc => doc.uploading);
		if (uploadingDocs.length > 0) {
			toast({
				title: "Uploads in Progress",
				description: "Please wait for all files to finish uploading before saving.",
				variant: "destructive",
			});
			return;
		}

		// Check for incomplete documents (missing title or file)
		const incompleteDocs = documents.filter(doc => !doc.title || (!doc.fileUrl && !doc.file));
		if (incompleteDocs.length > 0) {
			toast({
				title: "Incomplete Documents",
				description: "Please fill in all required fields and upload files for all documents.",
				variant: "destructive",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const metadata = documents.map(doc => ({
				title: doc.title,
				url: doc.fileUrl,
				uploadedAt: new Date().toISOString(),
				status: "under_review",
			}));

			const { error } = await supabase
				.from("support_services")
				.update({
					accreditation_files_metadata: metadata,
					updated_at: new Date().toISOString(),
				})
				.eq("id", serviceId)
				.eq("user_id", userId);

			if (error) {
				throw error;
			}

			toast({
				title: "Documents Saved",
				description: "Your service documents have been submitted for review.",
			});

			onUploadSuccess?.();
		} catch (error) {
			console.error("Error saving service documents:", error);
			toast({
				title: "Save Failed",
				description: "Failed to save documents. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const getStatusBadge = (status?: string) => {
		switch (status) {
			case "approved":
				return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
			case "rejected":
				return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
			case "under_review":
				return <Badge className="bg-yellow-100 text-yellow-800">Under Review</Badge>;
			default:
				return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
		}
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
			<div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg">
				{/* Header */}
				<div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-gray-900">
							Service Documents
						</h2>
						<p className="text-sm text-gray-600 capitalize">
							{serviceType.replace("_", " ")} Service
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700"
					>
						<X className="h-5 w-5" />
					</Button>
				</div>

				{/* Content */}
				<div className="p-4 space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-base font-medium text-gray-900">
								Accreditation Documents
							</h3>
							<p className="text-sm text-gray-600">
								Upload documents for this service
							</p>
						</div>
						<Button onClick={addDocument} size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Document
						</Button>
					</div>

					{documents.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="p-6 text-center">
								<FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
								<h4 className="text-base font-medium text-gray-900 mb-2">
									No Documents Added
								</h4>
								<p className="text-gray-600 mb-4">
									Add documents to support this service
								</p>
								<Button onClick={addDocument}>
									<Plus className="h-4 w-4 mr-2" />
									Add Your First Document
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-4">
							{documents.map((doc, index) => (
								<Card key={doc.id} className="overflow-hidden">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<CardTitle className="text-sm">
												Document {index + 1}
											</CardTitle>
											<div className="flex items-center space-x-2">
												{doc.uploading && (
													<div className="flex items-center space-x-1">
														<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-sauti-orange"></div>
														<span className="text-xs text-sauti-orange">Uploading...</span>
													</div>
												)}
												{doc.uploaded && !doc.uploading && (
													<CheckCircle className="h-4 w-4 text-green-500" />
												)}
												{doc.status && getStatusBadge(doc.status)}
												<Button
													variant="ghost"
													size="sm"
													onClick={() => removeDocument(doc.id)}
													className="text-red-600 hover:text-red-700 p-1"
													disabled={doc.uploading}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent className="space-y-3">
										<div>
											<label className="text-sm font-medium text-gray-700">
												Document Title *
											</label>
											<Input
												value={doc.title}
												onChange={(e) => updateDocument(doc.id, "title", e.target.value)}
												placeholder="e.g., Service License, Certificate"
												className="mt-1"
											/>
										</div>

										<div>
											<label className="text-sm font-medium text-gray-700">
												Upload File *
											</label>
											<div className="mt-1">
												<MobileFileUpload
													userId={userId}
													userType={userType}
													fileType="accreditation"
													serviceId={serviceId}
													serviceType={serviceType}
													onUploadSuccess={(fileData) => handleFileUpload(doc.id, fileData)}
													onUploadError={(error) => handleFileUploadError(doc.id, error)}
													onUploadStart={(file) => handleFileUploadStart(doc.id, file)}
													acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"]}
													maxSize={10}
													placeholder="Tap to upload document"
													autoUpload={true}
													className="mt-2"
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							))}

							<div className="flex justify-end space-x-3 pt-4 border-t">
								<Button
									variant="outline"
									onClick={() => setDocuments([])}
									disabled={isSubmitting || documents.some(doc => doc.uploading)}
								>
									Clear All
								</Button>
								<Button
									onClick={saveDocuments}
									disabled={isSubmitting || documents.some(doc => doc.uploading)}
									className="bg-sauti-orange hover:bg-sauti-orange/90"
								>
									{isSubmitting 
										? "Saving..." 
										: documents.some(doc => doc.uploading)
											? "Uploading..."
											: "Save Documents"
									}
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
