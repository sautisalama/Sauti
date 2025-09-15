"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, Upload, FileText, CheckCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fileUploadService, FileUploadError } from "@/lib/file-upload";

interface Document {
	title: string;
	note?: string;
	file?: File | null;
	url?: string;
	uploaded?: boolean;
}

export function ProfessionalDocumentsForm({
	onSave,
	initialData,
	onSaveDocuments,
}: {
	onSave?: () => void;
	initialData?: {
		accreditation_files?: any;
		accreditation_member_number?: any;
	};
	onSaveDocuments?: (documents: any[]) => void;
}) {
	const [docs, setDocs] = useState<Document[]>([
		{ title: "", note: "", file: undefined, uploaded: false },
	]);
	const [isUploading, setIsUploading] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	// Load existing documents from initialData
	useEffect(() => {
		if (initialData?.accreditation_files) {
			try {
				const existingDocs = Array.isArray(initialData.accreditation_files)
					? initialData.accreditation_files
					: JSON.parse(initialData.accreditation_files);

				if (existingDocs.length > 0) {
					setDocs(
						existingDocs.map((doc: any) => ({
							title: doc.title || "",
							note: doc.note || "",
							file: null,
							url: doc.url || "",
							uploaded: true,
						}))
					);
				}
			} catch (error) {
				console.error("Error parsing existing documents:", error);
			}
		}
	}, [initialData]);

	const addDoc = () =>
		setDocs((d) => [
			...d,
			{ title: "", note: "", file: undefined, uploaded: false },
		]);
	const removeDoc = (idx: number) =>
		setDocs((d) => d.filter((_, i) => i !== idx));

	const updateDoc = (idx: number, patch: Partial<Document>) => {
		setDocs((d) => d.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
	};

	const uploadFile = async (
		file: File,
		title: string
	): Promise<string | null> => {
		try {
			// Get current user ID
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				throw new Error("User not authenticated");
			}

			// Get user profile to determine user type
			const { data: profile } = await supabase
				.from("profiles")
				.select("user_type")
				.eq("id", user.id)
				.single();

			const result = await fileUploadService.uploadFile({
				userId: user.id,
				userType: profile?.user_type || "professional",
				fileType: "accreditation",
				fileName: file.name,
				file,
			});

			return result.url;
		} catch (error) {
			console.error("Error uploading file:", error);
			if (error instanceof FileUploadError) {
				toast({
					title: "Upload Error",
					description: error.message,
					variant: "destructive",
				});
			} else {
				toast({
					title: "Upload Error",
					description: "Failed to upload file. Please try again.",
					variant: "destructive",
				});
			}
			return null;
		}
	};

	const handleSave = async () => {
		setIsUploading(true);
		try {
			const documentsToSave: Array<{
				title: string;
				note?: string;
				url?: string;
				uploaded?: boolean;
			}> = [];

			for (let i = 0; i < docs.length; i++) {
				const doc = docs[i];

				if (!doc.title.trim()) continue; // Skip empty documents

				const documentData: any = {
					title: doc.title,
					note: doc.note || "",
				};

				// If there's a new file to upload
				if (doc.file && !doc.uploaded) {
					const url = await uploadFile(doc.file, doc.title);
					if (url) {
						documentData.url = url;
						documentData.uploaded = true;
					} else {
						continue; // Skip this document if upload failed
					}
				} else if (doc.url) {
					// Use existing URL
					documentData.url = doc.url;
					documentData.uploaded = true;
				}

				documentsToSave.push(documentData);
			}

			// Update the document state with uploaded URLs
			setDocs((prevDocs) =>
				prevDocs.map((doc, idx) => {
					const savedDoc = documentsToSave[idx] as
						| { title: string; note?: string; url?: string; uploaded?: boolean }
						| undefined;
					return savedDoc ? { ...doc, ...savedDoc } : doc;
				})
			);

			// Call the parent component's save function
			if (onSaveDocuments) {
				onSaveDocuments(documentsToSave);
			}

			if (onSave) {
				onSave();
			}
		} catch (error) {
			console.error("Error saving documents:", error);
			toast({
				title: "Error",
				description: "Failed to save documents. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="space-y-3 sm:space-y-4">
			<div className="grid gap-3">
				{docs.map((doc, idx) => (
					<Card key={idx} className="border rounded-lg">
						<CardContent className="p-3 sm:p-4 space-y-3">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Input
									placeholder="Document title (e.g., License, Certificate)"
									value={doc.title}
									onChange={(e) => updateDoc(idx, { title: e.target.value })}
									className="text-sm sm:text-base"
								/>
								<div className="flex items-center gap-2">
									<Input
										type="file"
										onChange={(e) =>
											updateDoc(idx, { file: e.target.files?.[0] || null })
										}
										className="flex-1 text-sm sm:text-base file:rounded-md sm:file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-sauti-orange file:text-white hover:file:bg-sauti-orange/90"
									/>
									{doc.uploaded && (
										<div className="flex items-center gap-1 text-green-600">
											<CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
											<span className="text-xs">Uploaded</span>
										</div>
									)}
								</div>
							</div>

							<div className="flex items-start gap-2">
								<Textarea
									placeholder="Notes (optional)"
									value={doc.note || ""}
									onChange={(e) => updateDoc(idx, { note: e.target.value })}
									className="flex-1 min-h-[50px] sm:min-h-[60px] text-sm sm:text-base resize-none"
								/>
								<Button
									type="button"
									variant="ghost"
									className="shrink-0 text-destructive p-1 sm:p-2"
									onClick={() => removeDoc(idx)}
								>
									<Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
								</Button>
							</div>

							{doc.url && (
								<div className="flex items-center gap-2 p-2 bg-green-50 rounded border">
									<FileText className="h-4 w-4 text-green-600" />
									<a
										href={doc.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-green-700 hover:underline flex-1 truncate"
									>
										{doc.title || "Document"}
									</a>
								</div>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<Button
					type="button"
					variant="secondary"
					onClick={addDoc}
					className="gap-1 sm:gap-2 text-xs sm:text-sm"
					size="sm"
				>
					<Plus className="h-3 w-3 sm:h-4 sm:w-4" /> Add Document
				</Button>

				<div className="flex items-center gap-2">
					{isUploading && (
						<div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
							<div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-sauti-orange"></div>
							<span className="hidden sm:inline">Uploading...</span>
							<span className="sm:hidden">Uploading...</span>
						</div>
					)}
					<Button
						type="button"
						onClick={handleSave}
						disabled={isUploading}
						className="gap-1 sm:gap-2 text-xs sm:text-sm"
						size="sm"
					>
						<Upload className="h-3 w-3 sm:h-4 sm:w-4" />
						<span className="hidden sm:inline">
							{isUploading ? "Saving..." : "Save Documents"}
						</span>
						<span className="sm:hidden">{isUploading ? "Saving..." : "Save"}</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
