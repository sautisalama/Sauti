"use client";

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Shield,
	FileText,
	Upload,
	Trash2,
	CheckCircle,
	AlertCircle,
	Loader2,
	User,
	Briefcase,
	Plus,
	Eye,
	Clock,
	ArrowRight,
	Sparkles
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fileUploadService } from "@/lib/file-upload";
import { Database } from "@/types/db-schema";
import { cn, safelyParseJsonArray } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";


interface VerificationSectionProps {
	userId: string;
	userType: Database["public"]["Enums"]["user_type"];
	profile: any;
	onUpdate: () => void;
	onNavigateToServices: () => void;
}

interface VerificationDocument {
	id: string; // url or unique id
	title: string;
	url: string;
	uploadedAt?: string;
	type?: 'identity' | 'qualification'; // Optional, can infer
	metadata?: any; 
}

export function VerificationSection({
	userId,
	userType,
	profile,
	onUpdate,
	onNavigateToServices,
}: VerificationSectionProps) {
	const { toast } = useToast();
	const supabase = createClient();
	const dash = useDashboardData();
	const supportServices = dash?.data?.supportServices || [];

	const [documents, setDocuments] = useState<VerificationDocument[]>([]);
	const [availableDocs, setAvailableDocs] = useState<VerificationDocument[]>([]);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState<string | null>(null); // 'id_front', 'id_back', or null
	
	const [showAddCert, setShowAddCert] = useState(false);
	const [certForm, setCertForm] = useState({ title: "", issuer: "", number: "" });
	const [certFile, setCertFile] = useState<File | null>(null);

	// ID Modal State
	const [showIdModal, setShowIdModal] = useState(false);
	const [idSide, setIdSide] = useState<'front' | 'back'>('front');
	const [idFile, setIdFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const loadDocuments = useCallback(async () => {
		try {
			// 1. Fetch Profile Docs
			const { data: profile, error: profileError } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			if (profileError) throw profileError;

			let profileDocs: VerificationDocument[] = [];
			if (profile?.accreditation_files_metadata) {
				profileDocs = safelyParseJsonArray(profile.accreditation_files_metadata) || [];
				setDocuments(profileDocs);
			}

			// 2. Fetch Support Services Docs for "Library"
			const { data: services, error: servicesError } = await supabase
				.from("support_services")
				.select("accreditation_files_metadata, title")
				.eq("provider_id", userId);

			if (servicesError) {
				console.warn("Error fetching support services docs:", servicesError);
			}

			const serviceDocs: VerificationDocument[] = [];
			if (services && Array.isArray(services)) {
				services.forEach((svc: any) => {
					if (!svc.accreditation_files_metadata) return;
					
					const docs = safelyParseJsonArray(svc.accreditation_files_metadata);
					if (docs && Array.isArray(docs)) {
						docs.forEach((d: any) => {
							// Avoid duplicates based on URL
							// Also check if d is valid object
							if (d && d.url && 
								!serviceDocs.some(existing => existing.url === d.url) && 
								!profileDocs.some(existing => existing.url === d.url)) {
								serviceDocs.push({
									...d,
									sourceName: svc.title // Add source info
								});
							}
						});
					}
				});
			}
			setAvailableDocs(serviceDocs);

		} catch (error) {
			console.error("Error loading documents:", error);
		}
	}, [userId, supabase]);

	useEffect(() => {
		loadDocuments();
	}, [loadDocuments]);

	// Helpers to find specific docs
	const idFront = documents.find(d => d.title === "National ID (Front)" || d.title?.includes("ID Front"));
	const idBack = documents.find(d => d.title === "National ID (Back)" || d.title?.includes("ID Back"));
	const otherDocs = documents.filter(d => d !== idFront && d !== idBack);

	const handleFileUpload = async (file: File, title: string, type: 'identity' | 'qualification' = 'qualification', metadata: any = {}) => {
		try {
			// Upload to storage
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				fileType: "accreditation", // or accreditation
				fileName: file.name,
				file,
			});

			if (!result.url) throw new Error("Upload failed");

			// Create new doc object
			const newDoc = {
				id: result.filePath, 
				title,
				url: result.url,
				uploadedAt: new Date().toISOString(),
				type,
				...metadata
			};

			// Update in DB (append or replace if exists)
			let updatedDocs = [...documents];
			
			// If replacing ID, remove old one
			if (title === "National ID (Front)") {
				updatedDocs = updatedDocs.filter(d => d.title !== "National ID (Front)");
			} else if (title === "National ID (Back)") {
				updatedDocs = updatedDocs.filter(d => d.title !== "National ID (Back)");
			}
			
			updatedDocs.push(newDoc);

			// Check if we have both IDs to trigger review
			const hasIdFront = updatedDocs.some(d => d.title === "National ID (Front)" || d.title?.includes("ID Front"));
			const hasIdBack = updatedDocs.some(d => d.title === "National ID (Back)" || d.title?.includes("ID Back"));
			const shouldReview = hasIdFront && hasIdBack;

			const updateData: any = {
				accreditation_files_metadata: updatedDocs,
				verification_updated_at: new Date().toISOString()
			};

			if (shouldReview) {
				updateData.verification_status = "under_review";
			}

			const { error } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (error) throw error;

			setDocuments(updatedDocs);
			onUpdate();
			toast({ title: "Document Uploaded", description: `${title} has been uploaded.` });
			
			return true;
		} catch (error) {
			console.error("Upload error:", error);
			toast({ title: "Upload Failed", description: "Please try again.", variant: "destructive" });
			return false;
		}
	};

	// Delete Confirmation State
	const [docToDelete, setDocToDelete] = useState<VerificationDocument | null>(null);

	const confirmDelete = async () => {
		if (!docToDelete) return;

		try {
			// Filter out the doc to delete
			const updatedDocs = documents.filter(d => d !== docToDelete);
			
			// Check if we still have both IDs
			const hasIdFront = updatedDocs.some(d => d.title === "National ID (Front)" || d.title?.includes("ID Front"));
			const hasIdBack = updatedDocs.some(d => d.title === "National ID (Back)" || d.title?.includes("ID Back"));
			const hasBothIds = hasIdFront && hasIdBack;

			const updateData: any = { 
				accreditation_files_metadata: updatedDocs,
				verification_updated_at: new Date().toISOString()
			};

			// If we lost an ID, revert to pending (unless unrelated doc)
			// Actually, if we are verified/under_review and lose an ID, we are no longer complete.
			if (!hasBothIds) {
				updateData.verification_status = "pending";
			}

			const { error } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (error) throw error;
			
			setDocuments(updatedDocs);
			onUpdate();
			toast({ title: "Document Deleted", description: "The document has been removed." });
		} catch (error) {
			console.error("Delete error:", error);
			toast({ title: "Delete Failed", description: "Could not remove document.", variant: "destructive" });
		} finally {
			setDocToDelete(null);
		}
	};

	const handleDelete = (doc: VerificationDocument) => {
		// Check if document is an ID and user has support services
		const isID = doc.title === "National ID (Front)" || doc.title === "National ID (Back)" || doc.title?.includes("ID Front") || doc.title?.includes("ID Back");
		
		if (isID && supportServices.length > 0) {
			toast({
				title: "Cannot Delete ID",
				description: "You have active support services relying on this verification. Please delete your services first.",
				variant: "destructive",
			});
			return;
		}

		setDocToDelete(doc);
	};

	const DocumentCard = ({ doc, onDelete }: { doc: VerificationDocument, onDelete: () => void }) => (
		<div className="group relative bg-white border border-neutral-200 rounded-2xl p-4 transition-all hover:shadow-md hover:border-sauti-teal/30">
			<div className="flex items-center gap-4">
				<div className="h-12 w-12 rounded-xl bg-sauti-teal/5 border border-sauti-teal/10 flex items-center justify-center shrink-0 text-sauti-teal">
					<FileText className="h-6 w-6" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-0.5">
						<h4 className="font-bold text-neutral-900 text-sm truncate pr-2" title={doc.title}>{doc.title}</h4>
						<Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 h-5 border-neutral-200 text-neutral-500">
							{doc.type === 'identity' ? 'Identity' : 'Qualification'}
						</Badge>
					</div>
					<div className="flex items-center gap-2 text-xs text-neutral-500">
						<span>{new Date(doc.uploadedAt || "").toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}</span>
						{doc.type === 'qualification' && doc.metadata?.issuer && (
							<>
								<span className="text-neutral-300">•</span>
								<span className="truncate">{doc.metadata.issuer}</span>
							</>
						)}
					</div>
				</div>
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-400 hover:text-sauti-teal hover:bg-sauti-teal/10 rounded-xl" asChild>
						<a href={doc.url} target="_blank" rel="noopener noreferrer">
							<Eye className="h-5 w-5" />
						</a>
					</Button>
					<Button variant="ghost" size="icon" className="h-9 w-9 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl" onClick={onDelete}>
						<Trash2 className="h-5 w-5" />
					</Button>
				</div>
			</div>
		</div>
	);

	const IDUploadSlot = ({ title, existingDoc, side }: { title: string, existingDoc?: VerificationDocument, side: 'front' | 'back' }) => {
		const isVerified = profile.verification_status === 'verified';
		
		return (
			<div 
				onClick={() => {
					if (!existingDoc && !isVerified) {
						setIdSide(side);
						setShowIdModal(true);
					}
				}}
				className={cn(
					"group relative rounded-2xl border-2 border-dashed transition-all p-6 flex flex-col items-center justify-center text-center gap-3 h-48 overflow-hidden",
					isVerified 
						? "border-sauti-teal bg-sauti-teal/5 cursor-default"
						: existingDoc 
							? "border-sauti-teal/30 bg-sauti-teal/[0.02] cursor-pointer" 
							: "border-neutral-200 bg-neutral-50/50 hover:border-sauti-teal/50 hover:bg-sauti-teal/[0.02] cursor-pointer"
				)}
			>
				{existingDoc ? (
					<>
						<div className={cn(
							"absolute top-3 right-3 flex gap-1.5 transition-opacity",
							isVerified ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						)}>
							<Button 
								variant="secondary" 
								size="icon" 
								className="h-8 w-8 rounded-lg bg-white shadow-sm border border-neutral-200 hover:text-sauti-teal" 
								onClick={(e) => {
									e.stopPropagation();
									window.open(existingDoc.url, '_blank');
								}}
							>
								<Eye className="h-4 w-4" />
							</Button>
							{!isVerified && (
								<Button 
									variant="secondary" 
									size="icon" 
									className="h-8 w-8 rounded-lg bg-white shadow-sm border border-neutral-200 hover:text-red-500" 
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(existingDoc);
									}}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							)}
						</div>
						<div className="h-14 w-14 rounded-2xl bg-sauti-teal/10 flex items-center justify-center text-sauti-teal mb-1">
							<Shield className="h-8 w-8" />
						</div>
						<div>
							<p className="font-bold text-neutral-900 text-sm tracking-tight">{title}</p>
							<p className="text-[11px] text-sauti-teal font-semibold uppercase tracking-wider mt-0.5">Verified & Secure</p>
						</div>
					</>
				) : (
					<>
						{uploading === `id_${side}` ? (
							<div className="flex flex-col items-center gap-3">
								<Loader2 className="h-8 w-8 text-sauti-teal animate-spin" />
								<p className="text-sm font-medium text-neutral-500">Uploading...</p>
							</div>
						) : (
							<>
								<div className="h-12 w-12 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:text-sauti-teal group-hover:border-sauti-teal/30 transition-colors shadow-sm">
									<Plus className="h-6 w-6" />
								</div>
								<div>
									<p className="font-bold text-neutral-900 text-sm">{title}</p>
									<p className="text-xs text-neutral-400 mt-1">Click to upload ID {side}</p>
								</div>
							</>
						)}
					</>
				)}
			</div>
		);
	};

	return (
		<div className="space-y-4">
			{/* Status Banner */}
			{/* Status Banner */}
			{profile.verification_status === "verified" && (
				<div className="bg-gradient-to-r from-green-50 via-white to-green-50 border border-green-200 rounded-2xl p-5 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-green-100">
							<Sparkles className="h-5 w-5 text-green-600" />
						</div>
						<div className="flex-1">
							<h3 className="text-base font-bold text-green-900">
								Fully Verified & Active
							</h3>
							<p className="text-sm text-green-700">
								You're helping survivors! Your profile is verified and visible.
							</p>
						</div>
						<Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
							<CheckCircle className="h-3 w-3 mr-1" />
							Complete
						</Badge>
					</div>
				</div>
			)}

			{(profile.verification_status === "pending" || !profile.verification_status) && (
				<div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
					<AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
					<div>
						<h4 className="font-bold text-blue-800">Verification Pending</h4>
						<p className="text-sm text-blue-700">
							Please complete your verification documents (ID Front & Back) to proceed.
						</p>
					</div>
				</div>
			)}

			{profile.verification_status === "under_review" && (
				<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
					<Clock className="h-5 w-5 text-amber-600 mt-0.5" />
					<div>
						<h4 className="font-bold text-amber-800">Your documents are under review</h4>
						<p className="text-sm text-amber-700">
							We'll notify you once verified. This usually takes 24-48 hours.
						</p>
					</div>
				</div>
			)}
			
			{profile.verification_status === "rejected" && (
				<div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
					<AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
					<div>
						<h4 className="font-bold text-red-800">Action Required</h4>
						<p className="text-sm text-red-700">
							Verification needs attention. Please check the admin notes and re-upload the necessary documents.
						</p>
					</div>
				</div>
			)}
			
			{/* Identity Verification */}
			<Card className="border-neutral-200 shadow-sm overflow-hidden">
				<CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4">
					<div className="flex items-center gap-2">
						<div className="p-2 bg-blue-100 rounded-lg text-blue-600">
							<User className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg">Identity Verification</CardTitle>
							<CardDescription>Upload your National ID to verify your identity</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<IDUploadSlot title="National ID (Front)" existingDoc={idFront} side="front" />
						<IDUploadSlot title="National ID (Back)" existingDoc={idBack} side="back" />
					</div>
				</CardContent>
			</Card>

			{/* Professional Qualifications */}
			<Card className="border-neutral-200 shadow-sm overflow-hidden">
				<CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4 flex flex-row items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="p-2 bg-sauti-teal/10 rounded-lg text-sauti-teal">
							<Briefcase className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg">Professional Qualifications</CardTitle>
							<CardDescription>Certificates, licenses, and accreditation</CardDescription>
						</div>
					</div>
					<Button size="sm" onClick={() => setShowAddCert(true)} className="bg-sauti-teal hover:bg-sauti-teal/90 text-white gap-2">
						<Plus className="h-4 w-4" /> Add Certificate
					</Button>
				</CardHeader>
				<CardContent className="p-5">
					{otherDocs.length > 0 ? (
						<div className="grid gap-3">
							{otherDocs.map((doc, idx) => (
								<DocumentCard key={idx} doc={doc} onDelete={() => handleDelete(doc)} />
							))}
						</div>
					) : (
						<div className="text-center py-8 text-neutral-500 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
							<Shield className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
							<p>No professional certificates uploaded yet.</p>
							<Button variant="link" onClick={() => setShowAddCert(true)} className="text-sauti-teal">
								Upload your first certificate
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* ID Upload Modal */}
			<Dialog open={showIdModal} onOpenChange={setShowIdModal}>
				<DialogContent className="max-w-md rounded-[24px] bg-white shadow-2xl border-none p-0 overflow-hidden">
					<div className="bg-gradient-to-br from-serene-neutral-50 to-white p-6 pb-0">
						<DialogHeader className="space-y-3">
							<div className="h-12 w-12 rounded-2xl bg-sauti-teal/10 flex items-center justify-center text-sauti-teal">
								<Shield className="h-6 w-6" />
							</div>
							<DialogTitle className="text-xl font-bold text-neutral-900 tracking-tight">
								Upload National ID ({idSide === 'front' ? 'Front' : 'Back'})
							</DialogTitle>
							<DialogDescription className="text-neutral-500 text-sm leading-relaxed">
								Please provide a clear photo or scan of the {idSide} of your National ID card. This is required for identity verification.
							</DialogDescription>
						</DialogHeader>
					</div>

					<div className="p-6 space-y-6">
						<FileUploadZone 
							file={idFile}
							isDragOver={isDragOver}
							onFileSelect={(e) => {
								const file = e.target.files?.[0];
								if (file) setIdFile(file);
							}}
							onClearFile={() => setIdFile(null)}
							handleDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
							handleDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
							handleDrop={(e) => {
								e.preventDefault();
								setIsDragOver(false);
								const file = e.dataTransfer.files?.[0];
								if (file) setIdFile(file);
							}}
						/>

						<div className="space-y-3">
							<Button 
								className="w-full h-12 text-base font-bold bg-sauti-teal hover:bg-sauti-dark text-white rounded-xl shadow-lg shadow-sauti-teal/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
								disabled={!idFile || loading}
								onClick={async () => {
									if (!idFile) return;
									setLoading(true);
									setUploading(`id_${idSide}`);
									const title = `National ID (${idSide === 'front' ? 'Front' : 'Back'})`;
									const success = await handleFileUpload(idFile, title, 'identity');
									setLoading(false);
									setUploading(null);
									if (success) {
										setShowIdModal(false);
										setIdFile(null);
									}
								}}
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Uploading...
									</>
								) : (
									<>
										Confirm & Upload <ArrowRight className="ml-2 h-5 w-5" />
									</>
								)}
							</Button>
							<Button 
								variant="ghost" 
								className="w-full h-11 text-neutral-500 font-medium hover:bg-neutral-50 rounded-xl"
								onClick={() => setShowIdModal(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Add Certificate Dialog */}
			<Dialog open={showAddCert} onOpenChange={setShowAddCert}>
				<DialogContent className="max-w-md rounded-2xl bg-white shadow-2xl border-none p-6">
					<DialogHeader className="space-y-3 pb-4">
						<DialogTitle className="text-xl font-bold text-serene-neutral-900 flex items-center gap-2">
							<FileText className="h-5 w-5 text-sauti-teal" />
							Add Qualification
						</DialogTitle>
						<DialogDescription className="text-serene-neutral-500 text-sm leading-relaxed">
							Attach a license, certificate, or degree to verify your expertise. You can upload a new file or reuse one from your library.
						</DialogDescription>
					</DialogHeader>

					<Tabs defaultValue="upload" className="w-full">
						<div className="bg-serene-neutral-50 p-1.5 rounded-xl border border-serene-neutral-200 mb-6">
							<TabsList className="grid w-full grid-cols-2 bg-transparent h-auto p-0 gap-2">
								<TabsTrigger 
									value="upload" 
									className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:text-sauti-teal data-[state=active]:shadow-sm data-[state=active]:font-semibold text-serene-neutral-500 transition-all duration-200"
								>
									Upload New
								</TabsTrigger>
								<TabsTrigger 
									value="existing" 
									className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:text-sauti-teal data-[state=active]:shadow-sm data-[state=active]:font-semibold text-serene-neutral-500 transition-all duration-200"
								>
									Select from Library
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent value="upload" className="space-y-5 focus-visible:outline-none mt-0">
							<div className="space-y-4">
								<div className="space-y-2">
									<label className="text-xs font-semibold text-serene-neutral-700 uppercase tracking-wide ml-1">Document Details</label>
									<Input 
										placeholder="Document Title (e.g. Clinical Psychology License)" 
										value={certForm.title} 
										onChange={e => setCertForm({...certForm, title: e.target.value})}
										className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors text-serene-neutral-900 placeholder:text-serene-neutral-400"
									/>
									<div className="grid grid-cols-2 gap-3">
										<Input 
											placeholder="License No." 
											value={certForm.number} 
											onChange={e => setCertForm({...certForm, number: e.target.value})}
											className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors text-serene-neutral-900 placeholder:text-serene-neutral-400"
										/>
										<Input 
											placeholder="Issuing Auth." 
											value={certForm.issuer} 
											onChange={e => setCertForm({...certForm, issuer: e.target.value})}
											className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors text-serene-neutral-900 placeholder:text-serene-neutral-400"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<label className="text-xs font-semibold text-serene-neutral-700 uppercase tracking-wide ml-1">File Attachment</label>
									<FileUploadZone 
										file={certFile}
										isDragOver={isDragOver}
										onFileSelect={(e) => {
											const file = e.target.files?.[0];
											if (file) setCertFile(file);
										}}
										onClearFile={() => setCertFile(null)}
										handleDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
										handleDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
										handleDrop={(e) => {
											e.preventDefault();
											setIsDragOver(false);
											const file = e.dataTransfer.files?.[0];
											if (file) setCertFile(file);
										}}
									/>
								</div>
							</div>

							<Button 
								className="w-full h-12 text-base font-medium shadow-lg shadow-sauti-teal/20 bg-sauti-teal hover:bg-sauti-teal/90 text-white rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
								disabled={!certForm.title || !certFile || loading}
								onClick={async () => {
									if (!certFile || !certForm.title) return;
									setLoading(true);
									const success = await handleFileUpload(certFile, certForm.title, 'qualification', {
										issuer: certForm.issuer,
										number: certForm.number
									});
									setLoading(false);
									if (success) {
										setShowAddCert(false);
										setCertForm({ title: "", issuer: "", number: "" });
										setCertFile(null);
									}
								}}
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Uploading...
									</>
								) : (
									<>
										<Upload className="mr-2 h-5 w-5" />
										Upload & Save
									</>
								)}
							</Button>
						</TabsContent>

						<TabsContent value="existing" className="focus-visible:outline-none mt-0">
							<ScrollArea className="h-[350px] -mr-4 pr-4">
								<div className="space-y-3 pb-2">
									{availableDocs.length > 0 ? (
										availableDocs.map((doc, idx) => (
											<div 
												key={idx} 
												className="relative flex items-center justify-between p-4 rounded-xl border border-serene-neutral-200 bg-white hover:border-sauti-teal hover:shadow-md hover:shadow-sauti-teal/5 cursor-pointer transition-all duration-200 group"
												onClick={async () => {
													setLoading(true);
													const newDoc = { ...doc, uploadedAt: new Date().toISOString() };
													const updatedDocs = [...documents, newDoc];
													
													const { error } = await supabase
														.from("profiles")
														.update({
															accreditation_files_metadata: updatedDocs,
															verification_status: "under_review",
															verification_updated_at: new Date().toISOString()
														})
														.eq("id", userId);

													if (!error) {
														setDocuments(updatedDocs);
														toast({ title: "Document Added" });
														setShowAddCert(false);
														onUpdate();
													} else {
														toast({ title: "Failed to add document", variant: "destructive" });
													}
													setLoading(false);
												}}
											>
												<div className="flex items-center gap-4">
													<div className="h-12 w-12 rounded-xl bg-sauti-teal/5 text-sauti-teal group-hover:bg-sauti-teal/10 flex items-center justify-center transition-colors">
														<FileText className="h-6 w-6" />
													</div>
													<div className="min-w-0">
														<p className="text-sm font-bold text-serene-neutral-900 group-hover:text-sauti-teal truncate pr-2">
															{doc.title}
														</p>
														<div className="flex items-center gap-2 mt-1">
															{doc.metadata?.sourceName && (
																<Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-serene-neutral-500 bg-serene-neutral-50 border-serene-neutral-200">
																	{doc.metadata.sourceName}
																</Badge>
															)}
															<span className="text-xs text-serene-neutral-400 max-w-[120px] truncate">
																{new Date(doc.uploadedAt || "").toLocaleDateString()}
															</span>
														</div>
													</div>
												</div>
												<div className="h-8 w-8 rounded-full bg-serene-neutral-50 border border-serene-neutral-100 flex items-center justify-center text-serene-neutral-300 group-hover:border-sauti-teal group-hover:text-sauti-teal transition-all">
													{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
												</div>
											</div>
										))
									) : (
										<div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
											<div className="h-16 w-16 rounded-full bg-serene-neutral-50 flex items-center justify-center">
												<FileText className="h-8 w-8 text-serene-neutral-200" />
											</div>
											<div className="max-w-[200px]">
												<p className="text-sm font-bold text-serene-neutral-900">No documents found</p>
												<p className="text-xs text-serene-neutral-500 mt-1">
													Documents uploaded to your services will appear here.
												</p>
											</div>
										</div>
									)}
								</div>
							</ScrollArea>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
				<DialogContent className="max-w-[400px] rounded-[24px] bg-white shadow-2xl border-none p-0 overflow-hidden">
					<div className="bg-red-50/50 p-6 pb-0">
						<DialogHeader className="space-y-3">
							<div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
								<Trash2 className="h-6 w-6" />
							</div>
							<DialogTitle className="text-xl font-bold text-neutral-900">
								Delete Document?
							</DialogTitle>
							<DialogDescription className="text-neutral-500 text-sm leading-relaxed">
								Are you sure you want to delete <span className="font-bold text-neutral-900">{docToDelete?.title}</span>? This action cannot be undone.
							</DialogDescription>
						</DialogHeader>
					</div>
					<div className="p-6 flex items-center gap-3">
						<Button
							variant="ghost"
							className="flex-1 h-11 text-neutral-600 font-medium hover:bg-neutral-50 rounded-xl"
							onClick={() => setDocToDelete(null)}
						>
							Cancel
						</Button>
						<Button
							className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20"
							onClick={confirmDelete}
						>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
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
			className={cn(
				"relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group mb-1",
				isDragOver
					? "border-sauti-teal bg-sauti-teal/[0.03] scale-[1.02] shadow-inner"
					: file
					? "border-sauti-teal/40 bg-sauti-teal/[0.02]"
					: "border-neutral-200 bg-neutral-50/50 hover:border-sauti-teal/40 hover:bg-white hover:shadow-sm"
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onClick={() => document.getElementById("file-upload-dialog")?.click()}
		>
			<input
				type="file"
				onChange={onFileSelect}
				accept=".pdf,.jpg,.jpeg,.png"
				className="hidden"
				id="file-upload-dialog"
			/>
			
			{file ? (
				<div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
					<div className="h-16 w-16 rounded-[20px] bg-white shadow-md border border-neutral-100 flex items-center justify-center mb-4 relative">
						<FileText className="h-8 w-8 text-sauti-teal" />
						<div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-sauti-teal text-white flex items-center justify-center">
							<CheckCircle className="h-3 w-3" />
						</div>
					</div>
					<p className="text-sm font-bold text-neutral-900 mb-0.5 max-w-[200px] truncate">{file.name}</p>
					<p className="text-xs text-neutral-500 mb-4">
						{(file.size / 1024 / 1024).toFixed(2)} MB
					</p>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							onClearFile();
						}} 
						className="h-8 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
					>
						Replace File
					</Button>
				</div>
			) : (
				<div className="flex flex-col items-center space-y-4">
					<div className="h-14 w-14 rounded-2xl bg-white border border-neutral-100 shadow-sm flex items-center justify-center text-neutral-400 group-hover:text-sauti-teal group-hover:bg-sauti-teal/5 transition-all group-hover:scale-110">
						<Upload className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-bold text-neutral-900 group-hover:text-sauti-teal transition-colors">
							Drop your document here
						</p>
						<p className="text-xs text-neutral-500 font-medium tracking-wide">
							Or click to browse from your device
						</p>
					</div>
					<div className="flex items-center gap-3 pt-1">
						<Badge variant="outline" className="text-[10px] bg-white text-neutral-400 font-medium">PDF</Badge>
						<Badge variant="outline" className="text-[10px] bg-white text-neutral-400 font-medium">JPG</Badge>
						<Badge variant="outline" className="text-[10px] bg-white text-neutral-400 font-medium">PNG</Badge>
					</div>
				</div>
			)}
		</div>
	);
}
