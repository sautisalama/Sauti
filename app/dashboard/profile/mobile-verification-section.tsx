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
import { CheckCircle, AlertCircle, FileText, Plus, Trash2 } from "lucide-react";

interface DocumentData {
	id: string;
	title: string;
	certificateNumber: string;
	fileUrl?: string;
	uploaded: boolean;
	uploading: boolean;
	file?: File;
	status?: string;
}

interface MobileVerificationSectionProps {
	userId: string;
	userType: "professional" | "ngo" | "survivor";
	onUploadSuccess?: () => void;
}

export function MobileVerificationSection({
	userId,
	userType,
	onUploadSuccess,
}: MobileVerificationSectionProps) {
	const [documents, setDocuments] = useState<DocumentData[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	// Load existing documents
	useEffect(() => {
		loadDocuments();
	}, [userId]);

	const loadDocuments = async () => {
		try {
			const { data: profile } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			if (profile?.accreditation_files_metadata) {
				const metadata = Array.isArray(profile.accreditation_files_metadata)
					? profile.accreditation_files_metadata
					: JSON.parse(profile.accreditation_files_metadata);

				const docs = metadata.map((doc: any, index: number) => ({
					id: `doc-${index}`,
					title: doc.title || `Document ${index + 1}`,
					certificateNumber: doc.certificateNumber || "",
					fileUrl: doc.url,
					uploaded: !!doc.url,
					status: doc.status || "under_review",
				}));

				setDocuments(docs);
			}
		} catch (error) {
			console.error("Error loading documents:", error);
		}
	};

	const addDocument = () => {
		const newDoc: DocumentData = {
			id: `doc-${Date.now()}`,
			title: "",
			certificateNumber: "",
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
				certificateNumber: doc.certificateNumber,
				url: doc.fileUrl,
				uploadedAt: new Date().toISOString(),
				status: "under_review",
			}));

			const { error } = await supabase
				.from("profiles")
				.update({
					accreditation_files_metadata: metadata,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) {
				throw error;
			}

			toast({
				title: "Documents Saved",
				description: "Your verification documents have been submitted for review.",
			});

			onUploadSuccess?.();
		} catch (error) {
			console.error("Error saving documents:", error);
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
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold text-gray-900">
						Verification Documents
					</h3>
					<p className="text-sm text-gray-600">
						Upload your professional credentials for verification
					</p>
				</div>
				<Button onClick={addDocument} size="sm">
					<Plus className="h-4 w-4 mr-2" />
					Add Document
				</Button>
			</div>

			{documents.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="p-8 text-center">
						<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
						<h4 className="text-lg font-medium text-gray-900 mb-2">
							No Documents Added
						</h4>
						<p className="text-gray-600 mb-4">
							Add your professional credentials to get verified
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
									<CardTitle className="text-base">
										Document {index + 1}
									</CardTitle>
									<div className="flex items-center space-x-2">
										{doc.uploading && (
											<div className="flex items-center space-x-1">
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sauti-orange"></div>
												<span className="text-xs text-sauti-orange">Uploading...</span>
											</div>
										)}
										{doc.uploaded && !doc.uploading && (
											<CheckCircle className="h-5 w-5 text-green-500" />
										)}
										{doc.status && getStatusBadge(doc.status)}
										<Button
											variant="ghost"
											size="sm"
											onClick={() => removeDocument(doc.id)}
											className="text-red-600 hover:text-red-700"
											disabled={doc.uploading}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 gap-4">
									<div>
										<label className="text-sm font-medium text-gray-700">
											Document Title *
										</label>
										<Input
											value={doc.title}
											onChange={(e) => updateDocument(doc.id, "title", e.target.value)}
											placeholder="e.g., Professional License, Certificate"
											className="mt-1"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-gray-700">
											Certificate/License Number
										</label>
										<Input
											value={doc.certificateNumber}
											onChange={(e) => updateDocument(doc.id, "certificateNumber", e.target.value)}
											placeholder="Enter certificate or license number"
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
								</div>
							</CardContent>
						</Card>
					))}

					<div className="flex justify-end space-x-3">
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
	);
}
