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
	Clock
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fileUploadService } from "@/lib/file-upload";
import { Database } from "@/types/db-schema";
import { cn } from "@/lib/utils";

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
	const [documents, setDocuments] = useState<VerificationDocument[]>([]);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState<string | null>(null); // 'id_front', 'id_back', or null
	
	// Dialog State
	const [showAddCert, setShowAddCert] = useState(false);
	const [certForm, setCertForm] = useState({ title: "", issuer: "", number: "" });
	const [certFile, setCertFile] = useState<File | null>(null);

	const loadDocuments = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			if (error) throw error;

			if (data?.accreditation_files_metadata) {
				const docs = Array.isArray(data.accreditation_files_metadata) 
					? data.accreditation_files_metadata 
					: JSON.parse(data.accreditation_files_metadata);
				setDocuments(docs || []);
			}
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

			const { error } = await supabase
				.from("profiles")
				.update({
					accreditation_files_metadata: updatedDocs,
					verification_status: "under_review", // Reset status on new upload
					verification_updated_at: new Date().toISOString()
				})
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

	const handleDelete = async (doc: VerificationDocument) => {
		if (!confirm("Are you sure you want to delete this document?")) return;
		
		try {
			// In a real app we might delete from storage too, but for now just metadata
			const updatedDocs = documents.filter(d => d !== doc);
			
			const { error } = await supabase
				.from("profiles")
				.update({ accreditation_files_metadata: updatedDocs })
				.eq("id", userId);

			if (error) throw error;
			
			setDocuments(updatedDocs);
			onUpdate();
			toast({ title: "Document Deleted" });
		} catch (error) {
			console.error("Delete error:", error);
			toast({ title: "Delete Failed", variant: "destructive" });
		}
	};

	const DocumentCard = ({ doc, onDelete }: { doc: VerificationDocument, onDelete: () => void }) => (
		<div className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-white hover:border-neutral-200 transition-colors group">
			<div className="flex items-center gap-3 overflow-hidden">
				<div className="h-10 w-10 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0 text-neutral-400">
					<FileText className="h-5 w-5" />
				</div>
				<div className="min-w-0">
					<p className="font-medium text-sm text-neutral-900 truncate">{doc.title}</p>
					<div className="flex items-center gap-2 text-xs text-neutral-500">
						<span>{new Date(doc.uploadedAt || "").toLocaleDateString()}</span>
						{doc.type === 'qualification' && doc.metadata?.issuer && (
							<>
								<span>•</span>
								<span className="truncate max-w-[100px]">{doc.metadata.issuer}</span>
							</>
						)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-1">
				<Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-sauti-teal" asChild>
					<a href={doc.url} target="_blank" rel="noopener noreferrer">
						<Eye className="h-4 w-4" />
					</a>
				</Button>
				<Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-red-500" onClick={onDelete}>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);

	const IDUploadSlot = ({ title, existingDoc, slotId }: { title: string, existingDoc?: VerificationDocument, slotId: string }) => (
		<div className={cn(
			"relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center text-center gap-2 h-40",
			existingDoc 
				? "border-sauti-teal/20 bg-sauti-teal/5" 
				: "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100"
		)}>
			{existingDoc ? (
				<>
					<div className="absolute top-2 right-2 flex gap-1">
						<Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-white/50 hover:bg-white text-sauti-teal" asChild>
							<a href={existingDoc.url} target="_blank" rel="noopener noreferrer"><Eye className="h-3 w-3" /></a>
						</Button>
						<Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-white/50 hover:bg-white text-red-500" onClick={() => handleDelete(existingDoc)}>
							<Trash2 className="h-3 w-3" />
						</Button>
					</div>
					<CheckCircle className="h-8 w-8 text-sauti-teal" />
					<p className="font-medium text-sauti-teal text-sm">{title} Uploaded</p>
					<p className="text-xs text-neutral-500">Click eye icon to view</p>
				</>
			) : (
				<>
					{uploading === slotId ? (
						<Loader2 className="h-8 w-8 text-sauti-teal animate-spin" />
					) : (
						<Upload className="h-8 w-8 text-neutral-400" />
					)}
					<div>
						<p className="font-medium text-neutral-600 text-sm">{title}</p>
						<p className="text-xs text-neutral-400">PNG, JPG or PDF</p>
					</div>
					<Input
						type="file"
						accept=".jpg,.jpeg,.png,.pdf"
						className="absolute inset-0 opacity-0 cursor-pointer"
						disabled={!!uploading}
						onChange={async (e) => {
							const file = e.target.files?.[0];
							if (file) {
								setUploading(slotId);
								await handleFileUpload(file, title, 'identity');
								setUploading(null);
							}
						}}
					/>
				</>
			)}
		</div>
	);

	return (
		<div className="space-y-4">
			{/* Status Banner */}
			{profile.verification_status === "under_review" && (
				<div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
					<Clock className="h-5 w-5 text-amber-600 mt-0.5" />
					<div>
						<h4 className="font-bold text-amber-800">Verification Pending</h4>
						<p className="text-sm text-amber-700">
							Your documents are under review. We'll notify you once verified.
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
						<IDUploadSlot title="National ID (Front)" existingDoc={idFront} slotId="id_front" />
						<IDUploadSlot title="National ID (Back)" existingDoc={idBack} slotId="id_back" />
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

			{/* Add Certificate Dialog */}
			<Dialog open={showAddCert} onOpenChange={setShowAddCert}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Professional Qualification</DialogTitle>
						<DialogDescription>Upload your degree, license, or certification.</DialogDescription>
					</DialogHeader>
					
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Document Title</Label>
							<Input 
								placeholder="e.g. Clinical Psychology License" 
								value={certForm.title}
								onChange={e => setCertForm({...certForm, title: e.target.value})}
							/>
						</div>
						<div className="space-y-2">
							<Label>Issuing Organization</Label>
							<Input 
								placeholder="e.g. Board of Psychology" 
								value={certForm.issuer}
								onChange={e => setCertForm({...certForm, issuer: e.target.value})}
							/>
						</div>
						<div className="space-y-2">
							<Label>Certificate / License Number</Label>
							<Input 
								placeholder="Optional" 
								value={certForm.number}
								onChange={e => setCertForm({...certForm, number: e.target.value})}
							/>
						</div>
						<div className="space-y-2">
							<Label>Document File</Label>
							<Input 
								type="file" 
								accept=".pdf,.jpg,.png"
								onChange={e => setCertFile(e.target.files?.[0] || null)}
							/>
						</div>
						
						<div className="pt-2 flex justify-end gap-2">
							<Button variant="outline" onClick={() => setShowAddCert(false)}>Cancel</Button>
							<Button 
								className="bg-sauti-teal hover:bg-sauti-teal/90 text-white"
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
								{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload Document"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
