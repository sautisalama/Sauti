"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	X,
	FileText,
	Building,
	Shield,
	CheckCircle,
	AlertCircle,
	Clock,
	Plus,
	Upload,
	Trash2,
	Edit,
	Link as LinkIcon,
	ArrowRight,
	Loader2,
	Eye,
	Power,
	Play
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

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

// --- Helper Components ---

function FileUploadZone({ 
	onFileSelect, 
	isDragOver, 
	file, 
	onClearFile,
	handleDragOver,
	handleDragLeave,
	handleDrop
}: { 
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	isDragOver: boolean;
	file: File | null;
	onClearFile: () => void;
	handleDragOver: (e: React.DragEvent) => void;
	handleDragLeave: (e: React.DragEvent) => void;
	handleDrop: (e: React.DragEvent) => void;
}) {
	return (
		<div
			className={`relative mt-2 border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer group ${
				isDragOver
					? "border-sauti-teal bg-sauti-teal/5 scale-[1.01]"
					: file
					? "border-serene-green-300 bg-serene-green-50/30"
					: "border-serene-neutral-300 hover:border-sauti-teal/50 hover:bg-serene-neutral-50"
			}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onClick={() => document.getElementById("file-upload")?.click()}
		>
			<input
				type="file"
				onChange={onFileSelect}
				accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
				className="hidden"
				id="file-upload"
			/>
			
			{file ? (
				<div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
					<div className="h-16 w-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3">
						<FileText className="h-8 w-8 text-sauti-teal" />
					</div>
					<p className="text-sm font-semibold text-serene-neutral-900">{file.name}</p>
					<p className="text-xs text-serene-neutral-500 mb-4">
						{(file.size / 1024 / 1024).toFixed(2)} MB
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							onClearFile();
						}} 
						className="text-red-600 hover:text-red-700 hover:bg-red-50"
					>
						Replace File
					</Button>
				</div>
			) : (
				<div className="flex flex-col items-center space-y-3">
					<div className="h-12 w-12 rounded-full bg-serene-neutral-100 flex items-center justify-center group-hover:bg-sauti-teal/10 transition-colors">
						<Upload className="h-6 w-6 text-serene-neutral-400 group-hover:text-sauti-teal transition-colors" />
					</div>
					<div>
						<p className="text-sm font-medium text-serene-neutral-900">
							Click to upload or drag and drop
						</p>
						<p className="text-xs text-serene-neutral-500 mt-1">
							PDF, Images, or Docs (Max 10MB)
						</p>
					</div>
				</div>
			)}
		</div>
	);
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
	const [isModalOpen, setIsModalOpen] = useState(false); // Unified modal
	const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
	const [activeTab, setActiveTab] = useState("new");
	const [isSubmitting, setIsSubmitting] = useState(false); // For "Submit for Review"

	// Upload form state
	const [uploadTitle, setUploadTitle] = useState("");
	const [uploadDocNumber, setUploadDocNumber] = useState("");
	const [uploadIssuer, setUploadIssuer] = useState("");
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	// --- Effects ---

	useEffect(() => {
		if (service) {
			loadServiceDocuments();
			loadAvailableDocuments();
			setEditData({
				name: service.name || "",
				email: service.email || "",
				phone_number: service.phone_number || "",
				website: service.website || "",
				availability: service.availability || "",
			});
		}
	}, [service]);

	// --- Data Loading ---

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

	const loadAvailableDocuments = useCallback(async () => {
		if (!userId || !service) return;

		try {
			// Profile docs
			const { data: profile } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			const availableDocs: any[] = [];

			if (profile?.accreditation_files_metadata) {
				const profileDocs = Array.isArray(profile.accreditation_files_metadata)
					? profile.accreditation_files_metadata
					: JSON.parse(profile.accreditation_files_metadata);

				profileDocs.forEach((doc: any, index: number) => {
					availableDocs.push({
						id: `profile-${index}`,
						title: doc.title || doc.fileName || "Profile Document",
						url: doc.url,
						source: "Profile Profile",
						sourceId: "profile",
						uploadedAt: doc.uploadedAt,
						fileSize: doc.fileSize,
					});
				});
			}

			// Other Services docs
			const { data: otherServices } = await supabase
				.from("support_services")
				.select("id, name, accreditation_files_metadata")
				.eq("professional_id", userId) // Assuming professional_id is correct field
				.neq("id", service.id);

			if (otherServices) {
				for (const otherSvc of otherServices) {
					if (otherSvc.accreditation_files_metadata) {
						const svcDocs = Array.isArray(otherSvc.accreditation_files_metadata)
							? otherSvc.accreditation_files_metadata
							: JSON.parse(otherSvc.accreditation_files_metadata);

						svcDocs.forEach((doc: any, index: number) => {
							availableDocs.push({
								id: `${otherSvc.id}-${index}`,
								title: doc.title || doc.fileName || "Service Document",
								url: doc.url,
								source: otherSvc.name,
								sourceId: otherSvc.id,
								uploadedAt: doc.uploadedAt,
								fileSize: doc.fileSize,
							});
						});
					}
				}
			}

			setAvailableDocuments(availableDocs);
		} catch (error) {
			console.error("Error loading available documents:", error);
		}
	}, [userId, service, supabase]);

	// --- Actions ---

	const handleSubmitForReview = async () => {
		if (!service) return;
		if (documents.length === 0) {
			toast({
				title: "Action Required",
				description: "Please attach at least one document before submitting for review.",
				variant: "destructive",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const { error } = await supabase
				.from("support_services")
				.update({ 
					verification_status: "under_review",
					// potentially update a submitted_at timestamp if column exists
				})
				.eq("id", service.id);

			if (error) throw error;

			toast({
				title: "Submitted for Review",
				description: "Your service is now being reviewed by our team.",
			});
			onUpdate();
			onClose(); // Optional: close panel after submit
		} catch (error) {
			console.error("Error submitting for review:", error);
			toast({
				title: "Submission Failed",
				description: "Please try again later.",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleEdit = () => {
		if (isEditing) {
			// Cancelling edit
			setIsEditing(false);
			setEditData({
				name: service?.name || "",
				email: service?.email || "",
				phone_number: service?.phone_number || "",
				website: service?.website || "",
				availability: service?.availability || "",
			});
		} else {
			setIsEditing(true);
		}
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

			toast({ title: "Success", description: "Service details updated successfully" });
			setIsEditing(false);
			onUpdate();
		} catch (error) {
			console.error("Error updating service:", error);
			toast({ title: "Error", description: "Failed to update service details", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleToggleSuspend = async () => {
		if (!service) return;
		setIsSaving(true);
		try {
			const newStatus = service.verification_status === "suspended" ? "verified" : "suspended";
			const { error } = await supabase
				.from("support_services")
				.update({ verification_status: newStatus })
				.eq("id", service.id);

			if (error) throw error;

			toast({ 
				title: newStatus === "suspended" ? "Service Suspended" : "Service Activated", 
				description: newStatus === "suspended" 
					? "This service is now hidden from matching." 
					: "This service is now active and can be matched." 
			});
			onUpdate();
		} catch (error) {
			console.error("Error updating service status:", error);
			toast({ title: "Error", description: "Failed to update service status", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleUploadNew = async () => {
		if (!uploadFile || !uploadTitle || !service) return;

		setIsUploading(true);
		try {
			// 1. Upload file
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				serviceId: service.id,
				serviceType: service.service_types,
				fileType: "accreditation",
				fileName: uploadFile.name,
				file: uploadFile,
			});

			const newDoc = {
				title: uploadTitle,
				url: result.url,
				fileType: uploadFile.type,
				fileSize: uploadFile.size,
				uploadedAt: new Date().toISOString(),
				uploaded: true,
				docNumber: uploadDocNumber,
				issuer: uploadIssuer,
			};

			// 2. Save metadata
			const updatedDocs = [...documents, newDoc];
			await saveDocuments(updatedDocs);

			// Reset form
			setUploadFile(null);
			setUploadTitle("");
			setUploadDocNumber("");
			setUploadIssuer("");
			setIsModalOpen(false);
			toast({ title: "Document Uploaded", description: "Document has been uploaded successfully" });
		} catch (error) {
			toast({ title: "Upload Failed", description: "Failed to upload document", variant: "destructive" });
		} finally {
			setIsUploading(false);
		}
	};

	const linkExistingDocument = async (doc: any) => {
		const alreadyLinked = documents.some(d => d.url === doc.url);
		if (alreadyLinked) {
			toast({ title: "Already Linked", description: "This document is already attached.", variant: "destructive" });
			return;
		}

		const linkedDoc = {
			title: doc.title,
			url: doc.url,
			uploadedAt: doc.uploadedAt || new Date().toISOString(),
			linked: true, // Marker
			sourceId: doc.sourceId,
			sourceName: doc.source,
			fileSize: doc.fileSize,
		};

		const updatedDocs = [...documents, linkedDoc];
		try {
			await saveDocuments(updatedDocs);
			toast({ title: "Document Linked", description: "Document linked successfully." });
			setIsModalOpen(false); // Close modal on success
		} catch (error) {
			toast({ title: "Link Failed", description: "Failed to link document.", variant: "destructive" });
		}
	};

	const saveDocuments = async (newDocuments: any[]) => {
		if (!service) return;
		// Updates the local state immediately for UI snapiness if needed, 
		// but usually we wait for re-fetch or optimistic update.
		// For now we do database update then re-render via onUpdate or local state.
		
		const { error } = await supabase
			.from("support_services")
			.update({ accreditation_files_metadata: newDocuments })
			.eq("id", service.id);

		if (error) throw error;
		setDocuments(newDocuments);
		onUpdate();
	};

	const handleDeleteDoc = async (docUrl: string, index: number) => {
		try {
			// If it's a linked doc, just remove the reference. If uploaded, delete file + ref?
			// Ideally we shouldn't delete the file if it's potentially used elsewhere, 
			// but for simple "uploaded here, stays here" model:
			
			const doc = documents[index];
			if (!doc.linked) {
				await fileUploadService.deleteFile(docUrl, "accreditation");
			}

			const updatedDocs = documents.filter((_, i) => i !== index);
			await saveDocuments(updatedDocs);
			toast({ title: "Success", description: "Document removed." });
		} catch (error) {
			toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
		}
	};

	// --- Drag & Drop logic for Upload Form ---
	const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
	const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			const file = files[0];
			// Basic validation could go here
			setUploadFile(file);
			if (!uploadTitle) setUploadTitle(file.name.split('.')[0]);
		}
	};
	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setUploadFile(file);
			if (!uploadTitle) setUploadTitle(file.name.split('.')[0]);
		}
	};

	// --- Utilities ---
	const getStatusColor = (status?: string | null) => {
		switch (status) {
			case "verified": return "bg-serene-green-100 text-serene-green-800 border-serene-green-200";
			case "rejected": return "bg-red-100 text-red-800 border-red-200";
			case "under_review": return "bg-amber-100 text-amber-800 border-amber-200";
			case "suspended": return "bg-gray-100 text-gray-800 border-gray-200";
			default: return "bg-serene-neutral-100 text-serene-neutral-800 border-serene-neutral-200";
		}
	};

	const formatFileSize = (bytes?: number) => {
		if (!bytes) return "";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	const formatDate = (dateString?: string | null) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
	};

	if (!service) return null;

	const canSubmit = service.verification_status !== "verified" && service.verification_status !== "under_review";
	const isSubmitted = service.verification_status === "under_review";

	return (
		<>
			{/* Sidepanel Container */}
			<div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[600px] xl:w-[700px] bg-white shadow-2xl border-l z-[60] transform transition-transform duration-300 ease-out translate-y-0 sm:translate-x-0 flex flex-col h-full active-sidepanel">
				
				{/* Header */}
				<div className="flex-none p-5 border-b border-serene-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-4 flex-1 overflow-hidden">
							<div className="p-2.5 rounded-xl bg-sauti-teal/10 flex-shrink-0">
								<Building className="h-6 w-6 text-sauti-teal" />
							</div>
							<div className="flex-1 min-w-0">
								{isEditing ? (
									<Input
										value={editData.name}
										onChange={(e) => setEditData({ ...editData, name: e.target.value })}
										className="text-lg font-bold h-9 -ml-2"
										autoFocus
									/>
								) : (
									<h2 className="text-xl font-bold text-serene-neutral-900 truncate pr-2">
										{service.name}
									</h2>
								)}
								<div className="flex flex-wrap items-center gap-2 mt-1.5">
									<Badge variant="secondary" className={`${getStatusColor(service.verification_status)} capitalize`}>
										{service.verification_status?.replace('_', ' ') || 'Pending'}
									</Badge>
									<span className="text-sm text-serene-neutral-500 capitalize px-2 border-l border-serene-neutral-200">
										{service.service_types?.replace('_', ' ')}
									</span>
								</div>
							</div>
						</div>
						
						{/* Close & Edit Actions */}
						<div className="flex items-center gap-1 flex-shrink-0">
							{isEditing ? (
								<div className="flex items-center gap-1.5 bg-serene-neutral-50 p-1 rounded-lg border border-serene-neutral-200">
									<Button 
										variant="ghost" 
										size="sm" 
										onClick={handleEdit} 
										disabled={isSaving}
										className="h-8 px-3 text-serene-neutral-600 hover:text-red-600 hover:bg-red-50"
									>
										Cancel
									</Button>
									<Button 
										size="sm" 
										onClick={handleSaveEdit} 
										disabled={isSaving || !editData.name.trim()}
										className="h-8 px-3 bg-serene-green-600 hover:bg-serene-green-700 text-white shadow-sm"
									>
										{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
									</Button>
								</div>
							) : (
								<Button variant="ghost" size="icon" onClick={handleEdit} className="h-9 w-9 rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500">
									<Edit className="h-4 w-4" />
								</Button>
							)}
							
							{/* Suspend / Activate Button */}
							{/* Only show if not editing */}
							{!isEditing && (
								<Button 
									variant="ghost" 
									size="icon" 
									onClick={handleToggleSuspend} 
									className={`h-9 w-9 rounded-full ${
										service.verification_status === 'suspended' 
											? "text-serene-green-600 hover:bg-serene-green-50" 
											: "text-amber-500 hover:bg-amber-50"
									}`}
									title={service.verification_status === 'suspended' ? "Activate Service" : "Suspend Service"}
								>
									{service.verification_status === 'suspended' ? <Play className="h-4 w-4" /> : <Power className="h-4 w-4" />}
								</Button>
							)}

							<Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-red-50 hover:text-red-600">
								<X className="h-5 w-5" />
							</Button>
						</div>
					</div>
				</div>

				{/* Scrollable Content */}
				<ScrollArea className="flex-1">
					<div className="p-5 space-y-8 pb-32">
						{/* Status Alert */}
						{service.verification_notes && (
							<Alert variant={service.verification_status === 'rejected' ? 'destructive' : 'default'} className="bg-amber-50 border-amber-200">
								<AlertCircle className="h-4 w-4 text-amber-600" />
								<AlertTitle className="text-amber-800 font-semibold mb-1">Attention Needed</AlertTitle>
								<AlertDescription className="text-amber-700">
									{service.verification_notes}
								</AlertDescription>
							</Alert>
						)}

						{/* Details Section */}
						<section className="space-y-4">
							<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
								<Shield className="h-4 w-4 text-sauti-teal" />
								Service Details
							</h3>
							
							<Card className="shadow-none border border-serene-neutral-200">
								<CardContent className="p-0 divide-y divide-serene-neutral-100">
									{/* Email */}
									<div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
										<span className="text-sm font-medium text-serene-neutral-500">Email</span>
										<div className="sm:col-span-2">
											{isEditing ? (
												<Input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="h-8" placeholder="email@example.com" />
											) : (
												<span className="text-sm text-serene-neutral-900 break-all">{service.email || "Not provided"}</span>
											)}
										</div>
									</div>
									{/* Phone */}
									<div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
										<span className="text-sm font-medium text-serene-neutral-500">Phone</span>
										<div className="sm:col-span-2">
											{isEditing ? (
												<Input value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})} className="h-8" placeholder="+254..." />
											) : (
												<span className="text-sm text-serene-neutral-900">{service.phone_number || "Not provided"}</span>
											)}
										</div>
									</div>
									{/* Website */}
									<div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
										<span className="text-sm font-medium text-serene-neutral-500">Website</span>
										<div className="sm:col-span-2">
											{isEditing ? (
												<Input value={editData.website} onChange={e => setEditData({...editData, website: e.target.value})} className="h-8" placeholder="https://..." />
											) : (
												<a href={service.website || "#"} target="_blank" className="text-sm text-sauti-teal hover:underline break-all truncate block">
													{service.website || "Not provided"}
												</a>
											)}
										</div>
									</div>
									{/* Availability */}
									<div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
										<span className="text-sm font-medium text-serene-neutral-500">Availability</span>
										<div className="sm:col-span-2">
											{isEditing ? (
												<Textarea value={editData.availability} onChange={e => setEditData({...editData, availability: e.target.value})} className="min-h-[60px]" placeholder="e.g. Mon-Fri 8am-5pm" />
											) : (
												<p className="text-sm text-serene-neutral-900 whitespace-pre-wrap">{service.availability || "Not provided"}</p>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
						</section>

						{/* Documents Section */}
						<section className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
									<FileText className="h-4 w-4 text-sauti-teal" />
									Verification Documents
								</h3>
								<Button size="sm" onClick={() => setIsModalOpen(true)} className="h-8 bg-sauti-teal hover:bg-sauti-teal/90 text-white shadow-sm gap-2">
									<Plus className="h-3.5 w-3.5" />
									Add Document
								</Button>
							</div>

							{documents.length === 0 ? (
								<div className="text-center py-10 border-2 border-dashed border-serene-neutral-200 rounded-2xl bg-serene-neutral-50/50">
									<div className="mx-auto w-12 h-12 rounded-full bg-serene-neutral-100 flex items-center justify-center mb-3">
										<FileText className="h-6 w-6 text-serene-neutral-400" />
									</div>
									<h4 className="text-sm font-semibold text-serene-neutral-900">No documents yet</h4>
									<p className="text-xs text-serene-neutral-500 mt-1 mb-4">Upload credentials to verify this service</p>
									<Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
										Upload First Document
									</Button>
								</div>
							) : (
								<div className="grid grid-cols-1 gap-3">
									{documents.map((doc, idx) => (
										<div key={idx} className="group relative bg-white border border-serene-neutral-200 rounded-xl p-4 transition-all hover:shadow-md hover:border-sauti-teal/30">
											<div className="flex items-start gap-3">
												<div className="h-10 w-10 rounded-lg bg-sauti-teal/10 flex items-center justify-center flex-shrink-0">
													<FileText className="h-5 w-5 text-sauti-teal" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center justify-between mb-1">
														<h4 className="font-semibold text-serene-neutral-900 text-sm truncate pr-2">{doc.title}</h4>
														{doc.linked && (
															<Badge variant="outline" className="text-[10px] items-center gap-1 bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0 h-5">
																<LinkIcon className="h-3 w-3" /> Linked
															</Badge>
														)}
													</div>
													<div className="flex items-center gap-3 text-xs text-serene-neutral-500">
														<span>{formatFileSize(doc.fileSize)}</span>
														<span>•</span>
														<span>{formatDate(doc.uploadedAt)}</span>
													</div>
												</div>
												<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-500 hover:text-sauti-teal hover:bg-sauti-teal/10" onClick={() => window.open(doc.url, '_blank')}>
														<Eye className="h-4 w-4" />
													</Button>
													<Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteDoc(doc.url, idx)}>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</section>
					</div>
				</ScrollArea>

				{/* Footer Actions */}
				<div className="flex-none p-5 border-t border-serene-neutral-200 bg-white z-10 sticky bottom-0">
					{canSubmit ? (
						<div className="flex flex-col gap-3">
							<Button 
								className="w-full h-12 text-base font-medium shadow-md bg-gradient-to-r from-sauti-teal to-sauti-teal-dark hover:brightness-110 text-white rounded-xl transition-all"
								onClick={handleSubmitForReview}
								disabled={isSubmitting || documents.length === 0}
							>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...
									</>
								) : (
									<>
										Submit Service For Review <ArrowRight className="ml-2 h-5 w-5 opacity-80" />
									</>
								)}
							</Button>
							<p className="text-xs text-center text-serene-neutral-500">
								By submitting, you agree that all provided documents are accurate.
							</p>
						</div>
					) : isSubmitted ? (
						<div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
							<p className="text-sm font-semibold text-amber-800 flex items-center justify-center gap-2">
								<Clock className="h-4 w-4" /> Under Review
							</p>
							<p className="text-xs text-amber-600 mt-1">
								Changes to documents are restricted while under review.
							</p>
						</div>
					) : (
						<div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
							<p className="text-sm font-semibold text-green-800 flex items-center justify-center gap-2">
								<CheckCircle className="h-4 w-4" /> Service Verified
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Unified Document Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0 rounded-2xl z-[100]">
					<div className="p-6 pb-0 bg-white">
						<DialogHeader className="mb-4">
							<DialogTitle className="text-xl font-bold flex items-center gap-2 text-serene-neutral-900">
								<FileText className="h-5 w-5 text-sauti-teal" />
								Manage Documents
							</DialogTitle>
							<DialogDescription>
								Upload a new file or link an existing document from your profile.
							</DialogDescription>
						</DialogHeader>
						
						<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
							<TabsList className="w-full grid grid-cols-2 p-1 bg-serene-neutral-100 rounded-xl">
								<TabsTrigger value="new" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-sauti-teal data-[state=active]:shadow-sm font-medium">
									Upload New
								</TabsTrigger>
								<TabsTrigger value="existing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-sauti-teal data-[state=active]:shadow-sm font-medium">
									Link Existing 
									{availableDocuments.length > 0 && 
										<Badge className="ml-2 h-5 bg-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-300 border-none">
											{availableDocuments.length}
										</Badge>
									}
								</TabsTrigger>
							</TabsList>
							
							<div className="mt-6 mb-6">
								{/* Tab: Upload New */}
								<TabsContent value="new" className="mt-0 focus-visible:outline-none">
									<div className="space-y-4">
										<div className="space-y-1.5">
											<label className="text-sm font-semibold text-serene-neutral-700">Document Title</label>
											<Input 
												value={uploadTitle}
												onChange={(e) => setUploadTitle(e.target.value)}
												placeholder="e.g. Business License 2024"
												className="h-11 rounded-xl bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
											/>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-1.5">
												<label className="text-sm font-semibold text-serene-neutral-700">Document Number</label>
												<Input 
													value={uploadDocNumber}
													onChange={(e) => setUploadDocNumber(e.target.value)}
													placeholder="e.g. LIC-12345"
													className="h-11 rounded-xl bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
												/>
											</div>
											<div className="space-y-1.5">
												<label className="text-sm font-semibold text-serene-neutral-700">Issuing Organization</label>
												<Input 
													value={uploadIssuer}
													onChange={(e) => setUploadIssuer(e.target.value)}
													placeholder="e.g. Nursing Council"
													className="h-11 rounded-xl bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
												/>
											</div>
										</div>
										<FileUploadZone 
											onFileSelect={handleFileSelect}
											isDragOver={isDragOver}
											file={uploadFile}
											onClearFile={() => { setUploadFile(null); setUploadTitle(""); }}
											handleDragOver={handleDragOver}
											handleDragLeave={handleDragLeave}
											handleDrop={handleDrop}
										/>
									</div>
								</TabsContent>

								{/* Tab: Link Existing */}
								<TabsContent value="existing" className="mt-0 focus-visible:outline-none h-[280px]">
									{availableDocuments.length === 0 ? (
										<div className="flex flex-col items-center justify-center h-full text-center p-4">
											<FileText className="h-10 w-10 text-serene-neutral-300 mb-2" />
											<p className="text-sm font-medium text-serene-neutral-900">No documents found</p>
											<p className="text-xs text-serene-neutral-500 mt-1">Upload documents to your profile to see them here.</p>
										</div>
									) : (
										<ScrollArea className="h-full pr-3 mx-[-4px] px-[4px]">
											<div className="space-y-2">
												{availableDocuments.map((doc) => {
													const isLinked = documents.some(d => d.url === doc.url);
													return (
														<div 
															key={doc.id}
															className={`group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
																isLinked 
																? "bg-serene-neutral-50 border-serene-neutral-200 opacity-60" 
																: "bg-white border-serene-neutral-200 hover:border-sauti-teal/50 hover:shadow-sm cursor-pointer"
															}`}
															onClick={() => !isLinked && linkExistingDocument(doc)}
														>
															<div className="flex items-center gap-3 min-w-0">
																<div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isLinked ? "bg-serene-neutral-200" : "bg-serene-blue-50 text-serene-blue-600 group-hover:bg-sauti-teal/10 group-hover:text-sauti-teal"}`}>
																	<FileText className="h-4 w-4" />
																</div>
																<div className="min-w-0">
																	<p className="text-sm font-semibold text-serene-neutral-900 truncate">{doc.title}</p>
																	<div className="flex items-center gap-2 text-xs text-serene-neutral-500">
																		<Badge variant="secondary" className="h-5 px-1.5 font-normal bg-serene-neutral-100 text-serene-neutral-600">
																			{doc.source}
																		</Badge>
																		<span>{formatDate(doc.uploadedAt)}</span>
																	</div>
																</div>
															</div>
															{isLinked ? (
																<Badge variant="outline" className="bg-white">Linked</Badge>
															) : (
																<Button size="sm" variant="ghost" className="h-8 w-8 rounded-full p-0 text-sauti-teal hover:bg-sauti-teal/10">
																	<Plus className="h-5 w-5" />
																</Button>
															)}
														</div>
													);
												})}
											</div>
										</ScrollArea>
									)}
								</TabsContent>
							</div>
						</Tabs>
					</div>

					{/* Modal Footer */}
					<div className="p-4 bg-serene-neutral-50 border-t border-serene-neutral-200 flex justify-end gap-2">
						<Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
						{activeTab === "new" && (
							<Button 
								onClick={handleUploadNew} 
								disabled={!uploadFile || !uploadTitle || isUploading}
								className="bg-sauti-teal hover:bg-sauti-teal/90 text-white shadow-sm min-w-[100px]"
							>
								{isUploading ? (
									<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading</>
								) : "Upload & Save"}
							</Button>
						)}
					</div>
				</DialogContent>
			</Dialog>
			
			{/* Mobile Backdrop */}
			<div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 sm:hidden" onClick={onClose} />
		</>
	);
}
