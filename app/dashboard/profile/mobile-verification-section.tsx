"use client";

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import {
	FileText,
	Upload,
	Trash2,
	CheckCircle,
	Loader2,
	User,
	Briefcase,
	Plus,
	Eye,
	Shield,
	ArrowLeft
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fileUploadService } from "@/lib/file-upload";
import { Database } from "@/types/db-schema";
import { cn } from "@/lib/utils";

interface MobileVerificationSectionProps {
	userId: string;
	userType: Database["public"]["Enums"]["user_type"];
	profile: any;
	onUpdate: () => void;
	onNavigateToServices: () => void;
	onUploadSuccess?: () => void;
}

interface VerificationDocument {
	id: string;
	title: string;
	url: string;
	uploadedAt?: string;
	type?: 'identity' | 'qualification';
	metadata?: any; 
}

export function MobileVerificationSection({
	userId,
	userType,
	profile,
	onUpdate,
	onNavigateToServices,
	onUploadSuccess,
}: MobileVerificationSectionProps) {
	const { toast } = useToast();
	const supabase = createClient();
	const [documents, setDocuments] = useState<VerificationDocument[]>([]);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState<string | null>(null);
	
	// Sheet State for Add Cert (Mobile optimized)
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

	const idFront = documents.find(d => d.title === "National ID (Front)" || d.title?.includes("ID Front"));
	const idBack = documents.find(d => d.title === "National ID (Back)" || d.title?.includes("ID Back"));
	const otherDocs = documents.filter(d => d !== idFront && d !== idBack);

	const handleFileUpload = async (file: File, title: string, type: 'identity' | 'qualification' = 'qualification', metadata: any = {}) => {
		try {
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				fileType: "accreditation",
				fileName: file.name,
				file,
			});

			if (!result.url) throw new Error("Upload failed");

			const newDoc = {
				id: result.filePath, 
				title,
				url: result.url,
				uploadedAt: new Date().toISOString(),
				type,
				...metadata
			};

			let updatedDocs = [...documents];
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
					verification_status: "under_review",
					verification_updated_at: new Date().toISOString()
				})
				.eq("id", userId);

			if (error) throw error;

			setDocuments(updatedDocs);
			onUpdate();
			onUploadSuccess?.();
			toast({ title: "Document Uploaded" });
			return true;
		} catch (error) {
			console.error("Upload error:", error);
			toast({ title: "Upload Failed", variant: "destructive" });
			return false;
		}
	};

	const handleDelete = async (doc: VerificationDocument) => {
		if (!confirm("Delete this document?")) return;
		try {
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
			toast({ title: "Delete Failed", variant: "destructive" });
		}
	};

	const MobileDocCard = ({ doc, onDelete }: { doc: VerificationDocument, onDelete: () => void }) => (
		<div className="flex items-center justify-between p-3 rounded-xl bg-white border border-neutral-100 shadow-sm">
			<div className="flex items-center gap-3 overflow-hidden">
				<div className="h-10 w-10 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0 text-neutral-400">
					<FileText className="h-5 w-5" />
				</div>
				<div className="min-w-0">
					<p className="font-medium text-sm text-neutral-900 truncate">{doc.title}</p>
					<p className="text-xs text-neutral-500 truncate">{new Date(doc.uploadedAt || "").toLocaleDateString()}</p>
				</div>
			</div>
			<div className="flex gap-1">
				<a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-neutral-400 hover:text-sauti-teal">
					<Eye className="h-5 w-5" />
				</a>
				<button onClick={onDelete} className="p-2 text-neutral-400 hover:text-red-500">
					<Trash2 className="h-5 w-5" />
				</button>
			</div>
		</div>
	);

	const MobileIDSlot = ({ title, existingDoc, slotId }: { title: string, existingDoc?: VerificationDocument, slotId: string }) => (
		<div className={cn(
			"relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center gap-2 h-32 transition-colors",
			existingDoc ? "border-sauti-teal/30 bg-sauti-teal/5" : "border-neutral-200 bg-neutral-50"
		)}>
			{existingDoc ? (
				<>
					<div className="absolute top-2 right-2">
						<button onClick={() => handleDelete(existingDoc)} className="p-1.5 rounded-full bg-white text-red-500 shadow-sm">
							<Trash2 className="h-4 w-4" />
						</button>
					</div>
					<CheckCircle className="h-8 w-8 text-sauti-teal" />
					<p className="font-medium text-sauti-teal text-xs">{title} Added</p>
				</>
			) : (
				<>
					{uploading === slotId ? (
						<Loader2 className="h-6 w-6 text-sauti-teal animate-spin" />
					) : (
						<Upload className="h-6 w-6 text-neutral-400" />
					)}
					<p className="font-medium text-neutral-600 text-xs">{title}</p>
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
		<div className="pb-20 space-y-6">
			{/* Identity Section */}
			<div className="space-y-3">
				<div className="flex items-center gap-2 px-1">
					<div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
						<User className="h-4 w-4" />
					</div>
					<h3 className="font-semibold text-neutral-900">Identity Documents</h3>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<MobileIDSlot title="ID Front" existingDoc={idFront} slotId="id_front" />
					<MobileIDSlot title="ID Back" existingDoc={idBack} slotId="id_back" />
				</div>
			</div>

			{/* Qualifications Section */}
			<div className="space-y-3">
				<div className="flex items-center justify-between px-1">
					<div className="flex items-center gap-2">
						<div className="p-1.5 bg-sauti-teal/10 rounded-lg text-sauti-teal">
							<Briefcase className="h-4 w-4" />
						</div>
						<h3 className="font-semibold text-neutral-900">Qualifications</h3>
					</div>
					<Button 
						size="sm" 
						variant="ghost" 
						onClick={() => setShowAddCert(true)} 
						className="text-sauti-teal text-xs font-medium hover:bg-sauti-teal/5 h-8 px-2"
					>
						<Plus className="h-3.5 w-3.5 mr-1" /> Add
					</Button>
				</div>

				<div className="space-y-3">
					{otherDocs.length > 0 ? (
						otherDocs.map((doc, idx) => (
							<MobileDocCard key={idx} doc={doc} onDelete={() => handleDelete(doc)} />
						))
					) : (
						<div 
							onClick={() => setShowAddCert(true)}
							className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 flex flex-col items-center justify-center text-center gap-2 active:bg-neutral-100"
						>
							<Shield className="h-8 w-8 text-neutral-300" />
							<p className="text-sm text-neutral-500">Tap to add your first certificate</p>
						</div>
					)}
				</div>
			</div>

			{/* Mobile Sheet for Adding Cert */}
			<Sheet open={showAddCert} onOpenChange={setShowAddCert}>
				<SheetContent side="bottom" className="rounded-t-3xl pt-6 pb-8 h-[85vh]">
					<SheetHeader className="mb-6 text-left">
						<SheetTitle className="text-xl font-bold">Add Qualification</SheetTitle>
						<SheetDescription>Upload a certificate, license or degree.</SheetDescription>
					</SheetHeader>
					
					<div className="space-y-5 overflow-y-auto pb-20">
						<div className="space-y-2">
							<Label className="text-base">Document Title</Label>
							<Input 
								placeholder="e.g. Psychology License" 
								value={certForm.title}
								onChange={e => setCertForm({...certForm, title: e.target.value})}
								className="h-12 text-base rounded-xl"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-base">Issuing Organization</Label>
							<Input 
								placeholder="e.g. Ministry of Health" 
								value={certForm.issuer}
								onChange={e => setCertForm({...certForm, issuer: e.target.value})}
								className="h-12 text-base rounded-xl"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-base">License Number (Optional)</Label>
							<Input 
								placeholder="e.g. 12345678" 
								value={certForm.number}
								onChange={e => setCertForm({...certForm, number: e.target.value})}
								className="h-12 text-base rounded-xl"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-base">Upload Photo/PDF</Label>
							<div className="rounded-xl border-2 border-dashed border-neutral-200 p-4 bg-neutral-50 flex items-center gap-3">
								<Input 
									type="file" 
									accept=".pdf,.jpg,.png"
									className="hidden"
									id="mobile-cert-upload"
									onChange={e => setCertFile(e.target.files?.[0] || null)}
								/>
								<Label htmlFor="mobile-cert-upload" className="flex-1 flex items-center gap-3 cursor-pointer">
									<div className="h-10 w-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center shrink-0">
										{certFile ? <CheckCircle className="h-5 w-5 text-sauti-teal" /> : <Upload className="h-5 w-5 text-neutral-400" />}
									</div>
									<div className="flex-1">
										<p className="font-medium text-sm text-neutral-900 truncate">
											{certFile ? certFile.name : "Choose File..."}
										</p>
										<p className="text-xs text-neutral-500">Max 5MB</p>
									</div>
								</Label>
							</div>
						</div>
					</div>

					<SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-neutral-100">
						<Button 
							className="w-full h-12 text-base font-bold bg-sauti-teal hover:bg-sauti-dark rounded-xl"
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
							{loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
							Save Document
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}