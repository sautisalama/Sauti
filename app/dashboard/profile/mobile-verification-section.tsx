"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileFileUpload } from "@/components/ui/mobile-file-upload";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fileUploadService } from "@/lib/file-upload";
import { CheckCircle, AlertCircle, FileText, Plus, Trash2, Eye, Download } from "lucide-react";

interface DocumentData {
	id: string;
	title: string;
	certificateNumber: string;
	fileUrl?: string;
	uploaded: boolean;
	uploading: boolean;
	file?: File;
	status?: string;
	uploadedAt?: string;
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
	const [isLoading, setIsLoading] = useState(true);
	const [savedDocuments, setSavedDocuments] = useState<Array<{ url: string; fileName: string; filePath: string; uploadedAt: string }>>([]);
	const [viewingDocument, setViewingDocument] = useState<{ url: string; fileName: string; filePath: string; uploadedAt: string } | null>(null);
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
					url: doc.url,
					fileName: doc.fileName || doc.title || `Document ${index + 1}`,
					filePath: doc.filePath || doc.url,
					uploadedAt: doc.uploadedAt || new Date().toISOString(),
				}));

				setSavedDocuments(docs);
			}
		} catch (error) {
			console.error("Error loading documents:", error);
		} finally {
			setIsLoading(false);
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
		updateDocument(id, "uploadedAt", new Date().toISOString());
		
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

	const handleFileDelete = async (fileData: { url: string; fileName: string; filePath: string }) => {
		try {
			await fileUploadService.deleteFile(fileData.url, "accreditation");
			// Remove from saved documents
			setSavedDocuments(prev => prev.filter(doc => doc.url !== fileData.url));
			toast({
				title: "File Deleted",
				description: "File has been removed from storage.",
			});
		} catch (error) {
			console.error("Error deleting file:", error);
			toast({
				title: "Delete Failed",
				description: "Failed to delete file from storage.",
				variant: "destructive",
			});
		}
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

			// Move uploaded documents to saved documents
			const uploadedDocs = documents
				.filter(doc => doc.uploaded && doc.fileUrl)
				.map(doc => ({
					url: doc.fileUrl!,
					fileName: doc.title,
					filePath: doc.fileUrl!,
					uploadedAt: doc.uploadedAt || new Date().toISOString(),
				}));

			setSavedDocuments(prev => [...prev, ...uploadedDocs]);
			setDocuments([]); // Clear current documents

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

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-center p-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sauti-orange mx-auto mb-4"></div>
						<p className="text-gray-600">Loading documents...</p>
					</div>
				</div>
			</div>
		);
	}

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
				{documents.length === 0 && (
					<Button onClick={addDocument} size="sm">
						<Plus className="h-4 w-4 mr-2" />
						Add Document
					</Button>
				)}
			</div>

			{/* Show uploaded files if any */}
			{savedDocuments.length > 0 && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className="text-lg font-semibold text-gray-900">
							Uploaded Documents ({savedDocuments.length})
						</h4>
					</div>
					<div className="space-y-3">
						{savedDocuments.map((doc, index) => (
							<Card key={`saved-${index}`} className="p-4 bg-green-50 border-green-200 hover:shadow-md transition-shadow">
								<div className="space-y-3">
									{/* Header with icon and status */}
									<div className="flex items-center space-x-3">
										<div className="flex-shrink-0">
											<div className="p-2 rounded-full bg-green-100">
												<CheckCircle className="h-5 w-5 text-green-600" />
											</div>
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center space-x-2">
												<p className="text-sm font-medium text-gray-900 truncate">
													{doc.fileName}
												</p>
												<Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
													Uploaded
												</Badge>
											</div>
										</div>

										<div className="flex-shrink-0 flex space-x-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setViewingDocument(doc)}
												className="text-sauti-orange hover:text-sauti-orange/80 border-sauti-orange/20 hover:border-sauti-orange/40"
											>
												<Eye className="h-4 w-4 mr-1" />
												View
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleFileDelete(doc)}
												className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>

									{/* File Details */}
									<div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
										<div>
											<span className="font-medium">File Type:</span>
											<p className="capitalize">{doc.fileName.split('.').pop()?.toUpperCase()}</p>
										</div>
										<div>
											<span className="font-medium">Upload Date:</span>
											<p>{new Date(doc.uploadedAt).toLocaleDateString()}</p>
										</div>
										<div>
											<span className="font-medium">Upload Time:</span>
											<p>{new Date(doc.uploadedAt).toLocaleTimeString()}</p>
										</div>
										<div>
											<span className="font-medium">Status:</span>
											<p className="text-green-600 font-medium">Ready for Review</p>
										</div>
									</div>

									{/* File Path (truncated) */}
									<div className="text-xs text-gray-500">
										<span className="font-medium">Path:</span>
										<p className="truncate font-mono">{doc.filePath}</p>
									</div>
								</div>
							</Card>
						))}
					</div>
				</div>
			)}

			{documents.length === 0 && savedDocuments.length === 0 ? (
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
			) : documents.length > 0 ? (
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
												onFileDelete={handleFileDelete}
												acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"]}
												maxSize={10}
												placeholder="Tap to upload document"
												autoUpload={true}
												singleMode={true}
												showUploadedFiles={savedDocuments.length > 0}
												uploadedFiles={savedDocuments}
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
			) : null}

			{/* Document Viewer Modal */}
			<Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center space-x-2">
							<Eye className="h-5 w-5 text-sauti-orange" />
							<span>Document Viewer</span>
						</DialogTitle>
					</DialogHeader>
					
					{viewingDocument && (
						<div className="space-y-4">
							{/* File Info Header */}
							<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
								<div className="flex items-center space-x-3">
									<div className="p-2 rounded-full bg-green-100">
										<CheckCircle className="h-5 w-5 text-green-600" />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">{viewingDocument.fileName}</h3>
										<p className="text-sm text-gray-500">
											Uploaded on {new Date(viewingDocument.uploadedAt).toLocaleDateString()} at {new Date(viewingDocument.uploadedAt).toLocaleTimeString()}
										</p>
									</div>
								</div>
								<div className="flex space-x-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => window.open(viewingDocument.url, '_blank')}
										className="text-sauti-orange hover:text-sauti-orange/80"
									>
										<Download className="h-4 w-4 mr-1" />
										Download
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setViewingDocument(null)}
									>
										Close
									</Button>
								</div>
							</div>

							{/* Document Viewer */}
							<div className="border rounded-lg overflow-hidden">
								{viewingDocument.fileName.toLowerCase().match(/\.(pdf)$/) ? (
									<iframe
										src={viewingDocument.url}
										className="w-full h-[600px] border-0"
										title={viewingDocument.fileName}
									/>
								) : viewingDocument.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
									<div className="flex items-center justify-center bg-gray-100 p-8">
										<img
											src={viewingDocument.url}
											alt={viewingDocument.fileName}
											className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
										/>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center p-8 bg-gray-100 h-[400px]">
										<FileText className="h-16 w-16 text-gray-400 mb-4" />
										<h3 className="text-lg font-medium text-gray-900 mb-2">
											Preview Not Available
										</h3>
										<p className="text-gray-500 text-center mb-4">
											This file type cannot be previewed in the browser.
										</p>
										<Button
											onClick={() => window.open(viewingDocument.url, '_blank')}
											className="bg-sauti-orange hover:bg-sauti-orange/90"
										>
											<Download className="h-4 w-4 mr-2" />
											Download to View
										</Button>
									</div>
								)}
							</div>

							{/* File Details */}
							<div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
								<div>
									<span className="font-medium text-gray-700">File Type:</span>
									<p className="text-gray-600">{viewingDocument.fileName.split('.').pop()?.toUpperCase()}</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">Status:</span>
									<p className="text-green-600 font-medium">Ready for Review</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">File Path:</span>
									<p className="text-gray-600 font-mono text-xs truncate">{viewingDocument.filePath}</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">Upload ID:</span>
									<p className="text-gray-600 font-mono text-xs">{viewingDocument.fileName.split('_').pop()?.split('.')[0]}</p>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}