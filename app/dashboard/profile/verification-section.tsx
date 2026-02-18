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
import { updateProfileStatus, VerificationDocument, VerificationStatus } from "@/lib/verification-utils";


interface VerificationSectionProps {
	userId: string;
	userType: Database["public"]["Enums"]["user_type"];
	profile: any;
	onUpdate: () => void;
	onNavigateToServices: () => void;
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
				const parsedMeta = safelyParseJsonArray(profile.accreditation_files_metadata);
				
				if (Array.isArray(parsedMeta)) {
					profileDocs = parsedMeta.map((d: any) => ({
						...d,
						title: d.title || d.name || 'Untitled Document', // Backward compat with admin changes
						status: d.status || 'pending',
						notes: d.notes || ''
					}));
				}
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
					
					const rawMeta = svc.accreditation_files_metadata;
					const docs = typeof rawMeta === 'string' ? safelyParseJsonArray(rawMeta) : rawMeta;

					if (docs && Array.isArray(docs)) {
						docs.forEach((d: any) => {
							// Avoid duplicates based on URL
							if (d && d.url && 
								!serviceDocs.some(existing => existing.url === d.url) && 
								!profileDocs.some(existing => existing.url === d.url)) {
								serviceDocs.push({
									...d,
									title: d.title || d.name || 'Untitled Document', // Backward compat with admin changes
									sourceName: svc.title, // Add source info
									status: d.status || 'pending',
									notes: d.notes || ''
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
	
    // Combine Profile Docs + Service Docs for the "Qualifications" list
    // Filter out IDs from both
    const allDocs = [...documents, ...availableDocs].filter((doc, index, self) => 
        index === self.findIndex((t) => (
            t.url === doc.url // Uniqueness by URL
        ))
    );

    const otherDocs = allDocs.filter(d => {
        if (!d || !d.title) return false;
        const title = d.title.toLowerCase();
        return !title.includes("national id (front)") && 
               !title.includes("national id (back)") && 
               !title.includes("id front") && 
               !title.includes("id back");
    });


	const handleFileUpload = async (file: File, title: string, type: 'identity' | 'qualification' = 'qualification', metadata: any = {}) => {
		try {
			// Upload to storage
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				fileType: "accreditation",
				fileName: file.name,
				file,
			});

			if (!result.url) throw new Error("Upload failed");

            // Create new doc object explicitly
            const docType = type === 'identity' ? 'Identity' : (metadata.number ? 'License' : 'Certificate');
            
			// Prepare new doc - status defaults to pending on upload
			const newDoc: VerificationDocument = {
				id: result.filePath, 
				title,
				url: result.url,
				uploadedAt: new Date().toISOString(),
				type,
                docType,
				status: 'pending',
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

			// Calculate and Update Global Status using Utility
			// This handles all logic: pending if missing reqs, rejected if any rejected, under_review if all good
			const newStatus = await updateProfileStatus(supabase, userId, updatedDocs, profile.verification_status);
            
            // Save Documents to Database
            const { error: saveError } = await supabase
                .from("profiles")
                .update({ 
                    accreditation_files_metadata: JSON.parse(JSON.stringify(updatedDocs)),
                    verification_updated_at: new Date().toISOString()
                })
                .eq("id", userId);

            if (saveError) throw new Error("Failed to save document metadata");

			setDocuments(updatedDocs);
			onUpdate();
			toast({ title: "Document Uploaded", description: `${title} has been uploaded. Status: ${newStatus.replace('_', ' ')}` });
			
			return true;
		} catch (error) {
			console.error("Upload error:", error);
            toast({
				title: "Upload Failed",
				description: "Please try again.",
				variant: "destructive",
			});
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
			
			// Update Status via Utility
			// If we deleted a rejected doc, status might go to 'pending' (if missing reqs) or 'under_review'
			const newStatus = await updateProfileStatus(supabase, userId, updatedDocs, profile.verification_status);
			
            // Save Updated Documents to Database
            const { error: saveError } = await supabase
                .from("profiles")
                .update({ 
                    accreditation_files_metadata: JSON.parse(JSON.stringify(updatedDocs)),
                    verification_updated_at: new Date().toISOString()
                })
                .eq("id", userId);

            if (saveError) throw new Error("Failed to save updated document list");

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

	// Handle delete request - opens confirmation
	const handleDelete = (doc: VerificationDocument) => {
		setDocToDelete(doc);
	};

	const DocumentCard = ({ doc, onDelete }: { doc: VerificationDocument, onDelete: () => void }) => {
		const isImage = doc.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
		const isVerified = doc.status === 'verified';
		const isRejected = doc.status === 'rejected';

		return (
			<div className="group relative bg-white border border-serene-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:border-sauti-teal/30 flex flex-col h-full">
				<div 
					className="aspect-[4/3] w-full relative overflow-hidden flex items-center justify-center bg-serene-neutral-50 border-b border-serene-neutral-100 cursor-pointer"
					onClick={() => window.open(doc.url, '_blank')}
				>
					{isImage ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={doc.url}
							alt={doc.title}
							className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
						/>
					) : (
						<div className="flex flex-col items-center justify-center p-3">
							<div className="h-12 w-12 rounded-xl bg-white border border-serene-neutral-200 flex items-center justify-center text-sauti-teal mb-2 shadow-sm group-hover:scale-110 transition-transform">
								<FileText className="h-6 w-6" />
							</div>
							<Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 h-5 border-serene-neutral-200 text-serene-neutral-500 bg-white">
								{doc.docType || (doc.type === 'identity' ? 'ID' : 'PDF')}
							</Badge>
						</div>
					)}
					
					{/* Status Overlay */}
					{isVerified && (
						<div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm flex items-center gap-1.5 border border-green-100">
							<CheckCircle className="h-3.5 w-3.5 text-green-600" />
							<span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Verified</span>
						</div>
					)}
					{isRejected && (
						<div className="absolute inset-0 bg-red-50/80 backdrop-blur-[1px] flex items-center justify-center flex-col p-4 text-center">
							<AlertCircle className="h-8 w-8 text-red-600 mb-2" />
							<span className="text-xs font-bold text-red-800 bg-white/80 px-2 py-1 rounded-lg">Rejected by Admin</span>
						</div>
					)}
				</div>
				
				<div className="p-4 flex flex-col flex-1">
					<div className="flex items-start justify-between gap-2 mb-1">
						<h4 className="font-bold text-serene-neutral-900 text-sm truncate leading-snug flex-1" title={doc.title}>
							{doc.title}
						</h4>
						{!isVerified && (
							<button 
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
								className="text-serene-neutral-400 hover:text-red-500 transition-colors p-0.5 -mr-1"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						)}
					</div>
					
					{doc.sourceName && (
						<div className="flex items-center gap-1.5 mb-2">
							<Briefcase className="h-3 w-3 text-serene-neutral-400" />
							<p className="text-xs text-serene-neutral-500 truncate max-w-[140px]">
								{doc.sourceName}
							</p>
						</div>
					)}

					<div className="mt-auto pt-3 border-t border-serene-neutral-50 flex items-center justify-between">
						<span className="text-[10px] text-serene-neutral-400 font-medium">
							{new Date(doc.uploadedAt || "").toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
						</span>
						
						{isRejected && doc.notes && (
							<div className="text-[10px] text-red-600 font-medium flex items-center gap-1">
								See Notes <ArrowRight className="h-3 w-3" />
							</div>
						)}
					</div>
				</div>
			</div>
		);
	};

    // ID Upload Slot Component - Enhanced for Rejection Logic
	const IDUploadSlot = ({ title, existingDoc, side }: { title: string, existingDoc?: VerificationDocument, side: 'front' | 'back' }) => {
		// A doc is "Verified" if it's explicitly marked OR if the whole profile is verified
        // But importantly, if a specific doc is REJECTED, it overrides profile status for that slot
		const isVerified = existingDoc?.status === 'verified'; 
		const isRejected = existingDoc?.status === 'rejected';
        
        // If profile is verified, we assume docs are verified unless explicitly rejected (edge case)
        const showVerified = isVerified || (profile.verification_status === 'verified' && !isRejected && existingDoc);

		return (
			<div 
				onClick={() => {
					// Allow re-upload if rejected or not existing
					if ((!existingDoc || isRejected) && !showVerified) {
						setIdSide(side);
						setShowIdModal(true);
					}
				}}
				className={cn(
					"group relative rounded-2xl border-2 border-dashed transition-all p-6 flex flex-col items-center justify-center text-center gap-3 h-48 overflow-hidden",
					showVerified
						? "border-sauti-teal bg-sauti-teal/5 cursor-default"
						: isRejected
							? "border-red-300 bg-red-50 cursor-pointer hover:border-red-400"
							: existingDoc 
								? "border-sauti-teal/30 bg-sauti-teal/[0.02] cursor-pointer" 
								: "border-neutral-200 bg-neutral-50/50 hover:border-sauti-teal/50 hover:bg-sauti-teal/[0.02] cursor-pointer"
				)}
			>
				{existingDoc ? (
					<>
						<div className={cn(
							"absolute top-3 right-3 flex gap-1.5 transition-opacity",
							showVerified ? "opacity-100" : "opacity-0 group-hover:opacity-100",
							isRejected && "opacity-100" // Always show actions if rejected
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
							{!showVerified && (
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

						<div className={cn(
							"h-14 w-14 rounded-2xl flex items-center justify-center mb-1",
							isRejected ? "bg-red-100 text-red-600" : "bg-sauti-teal/10 text-sauti-teal"
						)}>
							{isRejected ? <AlertCircle className="h-8 w-8" /> : (showVerified ? <Shield className="h-8 w-8" /> : <Clock className="h-8 w-8" />)}
						</div>
						
						<div className="w-full px-2">
							<p className={cn("font-bold text-sm tracking-tight truncate", isRejected ? "text-red-900" : "text-neutral-900")}>
								{title}
							</p>
							{isRejected ? (
								<div className="text-xs text-red-600 font-medium mt-1 bg-red-100/50 p-1.5 rounded-lg break-words">
									{existingDoc.notes || "Rejected. Click to re-upload."}
								</div>
							) : (
								<p className={cn(
                                    "text-[11px] font-semibold uppercase tracking-wider mt-0.5",
                                    showVerified ? "text-sauti-teal" : "text-amber-600"
                                )}>
									{showVerified ? "Verified & Secure" : "Pending Review"}
								</p>
							)}
						</div>
					</>
				) : (
                    // Empty State ...
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
    
    // Banner Logic to show specific rejection
    const rejectedDocs = documents.filter(d => d.status === 'rejected');
    const isProfileRejected = profile.verification_status === 'rejected';

	return (
		<div className="space-y-4">
			{/* Status Banner - Dynamic */}
			{profile.verification_status === "verified" && (
				<div className="bg-gradient-to-r from-green-50 via-white to-green-50 border border-green-200 rounded-2xl p-5 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-green-100">
							<Sparkles className="h-5 w-5 text-green-600" />
						</div>
						<div className="flex-1">
							<h3 className="text-base font-bold text-green-900">
								Fully Verified
							</h3>
							<p className="text-sm text-green-700">
								Your profile is verified.
							</p>
						</div>
					</div>
				</div>
			)}

            {/* Rejection Banner with Specifics */}
            {isProfileRejected && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-800">Action Required: Documents Rejected</h4>
                        <div className="text-sm text-red-700 mt-1 space-y-1">
                            <p>One or more documents were rejected. Please check the specific documents below:</p>
                            {rejectedDocs.length > 0 && (
                                <ul className="list-disc pl-4 mt-2">
                                    {rejectedDocs.map((d, i) => (
                                        <li key={i}>
                                            <span className="font-semibold">{d.title}:</span> {d.notes || "No reason provided."}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pending/Missing Docs Banner (Only if not rejected) */}
			{(profile.verification_status === "pending" || !profile.verification_status) && !isProfileRejected && (
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
            
            {/* Under Review Banner */}
			{profile.verification_status === "under_review" && (
				<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
					<Clock className="h-5 w-5 text-amber-600 mt-0.5" />
					<div>
						<h4 className="font-bold text-amber-800">Under Review</h4>
						<p className="text-sm text-amber-700">
							Your profile documents are being reviewed. We'll notify you soon.
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

			{/* Qualifications */}
			<Card className="border-neutral-200 shadow-sm overflow-hidden">
				<CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4 flex flex-row items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="p-2 bg-sauti-teal/10 rounded-lg text-sauti-teal">
							<Briefcase className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg">Qualifications</CardTitle>
							<CardDescription>Certificates, licenses, and accreditation</CardDescription>
						</div>
					</div>
					<Button size="sm" onClick={() => setShowAddCert(true)} className="bg-sauti-teal hover:bg-sauti-teal/90 text-white gap-2">
						<Plus className="h-4 w-4" /> Add Certificate
					</Button>
				</CardHeader>
				<CardContent className="p-5">
					{otherDocs.length > 0 ? (
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
							{otherDocs.map((doc, idx) => (
								<DocumentCard key={idx} doc={doc} onDelete={() => handleDelete(doc)} />
							))}
						</div>
					) : (
						<div className="text-center py-8 text-neutral-500 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
							<Shield className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
							<p>No certificates uploaded yet.</p>
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
															{doc.sourceName && (
																<Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-serene-neutral-500 bg-serene-neutral-50 border-serene-neutral-200">
																	{doc.sourceName}
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
