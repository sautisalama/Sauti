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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
	ArrowLeft,
	ArrowRight,
	X,
	Building
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { fileUploadService } from "@/lib/file-upload";
import { Database } from "@/types/db-schema";
import { cn, safelyParseJsonArray } from "@/lib/utils";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

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
	const dash = useDashboardData();
	const supportServices = dash?.data?.supportServices || [];

	const [documents, setDocuments] = useState<VerificationDocument[]>([]);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState<string | null>(null);
	
	// Sheet State for Add Cert (Mobile optimized)
	const [showAddCert, setShowAddCert] = useState(false);
	const [certForm, setCertForm] = useState({ title: "", issuer: "", number: "" });
	const [certFile, setCertFile] = useState<File | null>(null);

	// ID Mobile State
	const [showIdSheet, setShowIdSheet] = useState(false);
	const [idSide, setIdSide] = useState<'front' | 'back'>('front');
	const [idFile, setIdFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const loadDocuments = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			if (error) throw error;

			if (data?.accreditation_files_metadata) {
				const docs = safelyParseJsonArray(data.accreditation_files_metadata);
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
				fileType: "accreditation", // or accreditation
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
		<div className="group relative bg-white border border-serene-neutral-200 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform">
			<div className="flex items-center gap-4">
				<div className="h-12 w-12 rounded-xl bg-sauti-teal/5 border border-sauti-teal/10 flex items-center justify-center shrink-0 text-sauti-teal">
					<FileText className="h-6 w-6" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-0.5">
						<h4 className="font-bold text-serene-neutral-900 text-sm truncate pr-2">{doc.title}</h4>
						<Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 h-5 border-serene-neutral-200 text-serene-neutral-500">
							{doc.type === 'identity' ? 'ID' : 'CERT'}
						</Badge>
					</div>
					<p className="text-xs text-serene-neutral-500">
						{new Date(doc.uploadedAt || "").toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' })}
					</p>
				</div>
				<div className="flex items-center gap-1">
					<a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-serene-neutral-400">
						<Eye className="h-5 w-5" />
					</a>
					<button onClick={onDelete} className="p-2 text-red-400">
						<Trash2 className="h-5 w-5" />
					</button>
				</div>
			</div>
		</div>
	);

	const MobileIDSlot = ({ title, existingDoc, side }: { title: string, existingDoc?: VerificationDocument, side: 'front' | 'back' }) => (
		<div 
			onClick={() => {
				if (!existingDoc) {
					setIdSide(side);
					setShowIdSheet(true);
				}
			}}
			className={cn(
				"relative rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center gap-3 h-40 transition-all overflow-hidden",
				existingDoc 
					? "border-sauti-teal/30 bg-sauti-teal/[0.02]" 
					: "border-serene-neutral-200 bg-serene-neutral-50 active:bg-serene-neutral-100"
			)}
		>
			{existingDoc ? (
				<>
					<div className="absolute top-2 right-2 flex gap-1">
						<button 
							onClick={(e) => {
								e.stopPropagation();
								window.open(existingDoc.url, '_blank');
							}} 
							className="p-2 rounded-full bg-white/80 active:bg-white text-sauti-teal shadow-sm border border-serene-neutral-200"
						>
							<Eye className="h-4 w-4" />
						</button>
						<button 
							onClick={(e) => {
								e.stopPropagation();
								handleDelete(existingDoc);
							}} 
							className="p-2 rounded-full bg-white/80 active:bg-white text-red-500 shadow-sm border border-serene-neutral-200"
						>
							<Trash2 className="h-4 w-4" />
						</button>
					</div>
					<div className="h-12 w-12 rounded-2xl bg-sauti-teal/10 flex items-center justify-center text-sauti-teal mb-1">
						<Shield className="h-7 w-7" />
					</div>
					<p className="font-bold text-serene-neutral-900 text-[13px]">{title}</p>
				</>
			) : (
				<>
					{uploading === `id_${side}` ? (
						<div className="flex flex-col items-center gap-2">
							<Loader2 className="h-6 w-6 text-sauti-teal animate-spin" />
							<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">Uploading</p>
						</div>
					) : (
						<>
							<div className="h-10 w-10 rounded-full bg-white border border-serene-neutral-200 flex items-center justify-center text-serene-neutral-400 shadow-sm">
								<Plus className="h-5 w-5" />
							</div>
							<div>
								<p className="font-bold text-serene-neutral-900 text-sm tracking-tight">{title}</p>
								<p className="text-[10px] text-serene-neutral-500 font-medium mt-0.5">Tap to Capture</p>
							</div>
						</>
					)}
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
					<h3 className="font-semibold text-serene-neutral-900">Identity Documents</h3>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<MobileIDSlot title="ID Front" existingDoc={idFront} side="front" />
					<MobileIDSlot title="ID Back" existingDoc={idBack} side="back" />
				</div>
			</div>

			{/* Qualifications Section */}
			<div className="space-y-3">
				<div className="flex items-center justify-between px-1">
					<div className="flex items-center gap-2">
						<div className="p-1.5 bg-sauti-teal/10 rounded-lg text-sauti-teal">
							<Briefcase className="h-4 w-4" />
						</div>
						<h3 className="font-semibold text-serene-neutral-900">Qualifications</h3>
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
							className="rounded-xl border border-dashed border-serene-neutral-200 bg-serene-neutral-50 p-6 flex flex-col items-center justify-center text-center gap-2 active:bg-serene-neutral-100"
						>
							<Shield className="h-8 w-8 text-serene-neutral-300" />
							<p className="text-sm text-serene-neutral-500">Tap to add your first certificate</p>
						</div>
					)}
				</div>
			</div>

			{/* ID Upload Sheet */}
			<Sheet open={showIdSheet} onOpenChange={setShowIdSheet}>
				<SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-fit max-h-[90vh] bg-white text-serene-neutral-900">
					<div className="p-6 pb-4 border-b border-serene-neutral-100">
						<div className="w-12 h-1.5 bg-serene-neutral-200 rounded-full mx-auto mb-6" />
						<SheetHeader className="text-left space-y-2">
							<div className="h-12 w-12 rounded-2xl bg-sauti-teal/10 flex items-center justify-center text-sauti-teal">
								<Shield className="h-6 w-6" />
							</div>
							<SheetTitle className="text-xl font-bold tracking-tight text-serene-neutral-900">Upload ID ({idSide})</SheetTitle>
							<SheetDescription className="text-sm text-serene-neutral-500">Provide a clear scan of the {idSide} of your identity card.</SheetDescription>
						</SheetHeader>
					</div>

					<div className="p-6 space-y-6 pb-10">
						<MobileFileUploadZone 
							file={idFile}
							onFileSelect={(e) => setIdFile(e.target.files?.[0] || null)}
							onClearFile={() => setIdFile(null)}
						/>
						
						<Button 
							className="w-full h-14 text-base font-bold bg-sauti-teal hover:bg-sauti-dark text-white rounded-2xl shadow-xl shadow-sauti-teal/20 active:scale-[0.98] transition-transform"
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
									setShowIdSheet(false);
									setIdFile(null);
								}
							}}
						>
							{loading ? (
								<Loader2 className="animate-spin h-5 w-5 mr-3" />
							) : (
								<Upload className="h-5 w-5 mr-3" />
							)}
							Confirm & Upload
						</Button>
					</div>
				</SheetContent>
			</Sheet>

			{/* Mobile Sheet for Adding Cert */}
			<Sheet open={showAddCert} onOpenChange={setShowAddCert}>
				<SheetContent side="bottom" className="rounded-t-[32px] p-0 border-none h-[92vh] bg-white text-serene-neutral-900">
					<div className="p-6 pb-4 border-b border-serene-neutral-100 shrink-0">
						<div className="w-12 h-1.5 bg-serene-neutral-200 rounded-full mx-auto mb-6" />
						<SheetHeader className="text-left space-y-2">
							<div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
								<Briefcase className="h-6 w-6" />
							</div>
							<SheetTitle className="text-2xl font-bold tracking-tight text-serene-neutral-900">Add Qualification</SheetTitle>
							<SheetDescription className="text-sm text-serene-neutral-500">Upload a certificate, license or degree.</SheetDescription>
						</SheetHeader>
					</div>
					
					<ScrollArea className="flex-1 px-6">
						<div className="py-6 space-y-8 pb-32">
							<div className="space-y-5">
								<h4 className="text-xs font-bold text-serene-neutral-500 uppercase tracking-widest flex items-center gap-2">
									<FileText className="h-3.5 w-3.5" />
									General Information
								</h4>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label className="text-sm font-bold text-serene-neutral-700 ml-1">Document Title *</Label>
										<Input 
											placeholder="e.g. Psychology License" 
											value={certForm.title}
											onChange={e => setCertForm({...certForm, title: e.target.value})}
											className="h-13 text-base rounded-[16px] border-serene-neutral-200 bg-serene-neutral-50 focus:bg-white transition-all shadow-sm text-serene-neutral-900 placeholder:text-serene-neutral-400"
										/>
									</div>
									<div className="space-y-2">
										<Label className="text-sm font-bold text-serene-neutral-700 ml-1">Issuing Body</Label>
										<Input 
											placeholder="e.g. Ministry of Health" 
											value={certForm.issuer}
											onChange={e => setCertForm({...certForm, issuer: e.target.value})}
											className="h-13 text-base rounded-[16px] border-serene-neutral-200 bg-serene-neutral-50 focus:bg-white transition-all shadow-sm text-serene-neutral-900 placeholder:text-serene-neutral-400"
										/>
									</div>
									<div className="space-y-2">
										<Label className="text-sm font-bold text-serene-neutral-700 ml-1">Certificate Number</Label>
										<Input 
											placeholder="e.g. LIC-123456" 
											value={certForm.number}
											onChange={e => setCertForm({...certForm, number: e.target.value})}
											className="h-13 text-base rounded-[16px] border-serene-neutral-200 bg-serene-neutral-50 focus:bg-white transition-all shadow-sm text-serene-neutral-900 placeholder:text-serene-neutral-400"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-5">
								<h4 className="text-xs font-bold text-serene-neutral-500 uppercase tracking-widest flex items-center gap-2">
									<Upload className="h-3.5 w-3.5" />
									File Capture
								</h4>
								<MobileFileUploadZone 
									file={certFile}
									onFileSelect={(e) => setCertFile(e.target.files?.[0] || null)}
									onClearFile={() => setCertFile(null)}
								/>
							</div>
						</div>
					</ScrollArea>

					<div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-serene-neutral-100 flex items-center gap-3">
						<Button 
							variant="ghost" 
							className="h-14 flex-1 font-bold text-serene-neutral-500 rounded-2xl"
							onClick={() => setShowAddCert(false)}
						>
							Cancel
						</Button>
						<Button 
							className="h-14 flex-[2] text-base font-bold bg-sauti-teal hover:bg-sauti-dark text-white rounded-2xl shadow-xl shadow-sauti-teal/20"
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
							{loading && <Loader2 className="animate-spin h-5 w-5 mr-3" />}
							Save Document
						</Button>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}

// --- Helper Components ---

function MobileFileUploadZone({ 
	onFileSelect, 
	file, 
	onClearFile,
}: { 
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	file: File | null;
	onClearFile: () => void;
}) {
	return (
		<div
			className={cn(
				"relative border-2 border-dashed rounded-[20px] p-8 text-center transition-all bg-serene-neutral-50/50",
				file ? "border-sauti-teal/30 bg-sauti-teal/[0.02]" : "border-serene-neutral-200"
			)}
			onClick={() => document.getElementById("mobile-file-upload-input")?.click()}
		>
			<input
				type="file"
				onChange={onFileSelect}
				accept=".pdf,.jpg,.jpeg,.png"
				className="hidden"
				id="mobile-file-upload-input"
			/>
			
			{file ? (
				<div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
					<div className="h-16 w-16 rounded-2xl bg-white shadow-md flex items-center justify-center mb-4 border border-serene-neutral-100">
						<FileText className="h-8 w-8 text-sauti-teal" />
					</div>
					<p className="text-sm font-bold text-serene-neutral-900 mb-0.5 truncate max-w-full italic px-4">"{file.name}"</p>
					<p className="text-xs text-serene-neutral-500 mb-5">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready</p>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							onClearFile();
						}} 
						className="h-9 px-6 text-xs font-bold text-red-500 bg-white border border-red-50 rounded-xl shadow-sm"
					>
						Replace File
					</Button>
				</div>
			) : (
				<div className="flex flex-col items-center space-y-4 py-2">
					<div className="h-14 w-14 rounded-2xl bg-white border border-serene-neutral-200 shadow-sm flex items-center justify-center text-serene-neutral-400 group-hover:text-sauti-teal/50 transition-all">
						<Upload className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<p className="text-sm font-extrabold text-serene-neutral-900">
							Select Document
						</p>
						<p className="text-[11px] text-serene-neutral-500 font-medium max-w-[180px] mx-auto leading-relaxed">
							Tap to take a photo or choose <br/> a file from your device
						</p>
					</div>
					<div className="flex items-center gap-2 pt-1 opacity-60">
						<Badge variant="outline" className="text-[9px] bg-white border-serene-neutral-200 text-serene-neutral-500 font-bold px-1.5 py-0">PDF</Badge>
						<Badge variant="outline" className="text-[9px] bg-white border-serene-neutral-200 text-serene-neutral-500 font-bold px-1.5 py-0">JPG</Badge>
						<Badge variant="outline" className="text-[9px] bg-white border-serene-neutral-200 text-serene-neutral-500 font-bold px-1.5 py-0">PNG</Badge>
					</div>
				</div>
			)}
		</div>
	);
}