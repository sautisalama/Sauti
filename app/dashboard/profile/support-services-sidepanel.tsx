"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
	Play,
	Share2,
	Users,
	MoreVertical,
	Calendar as CalendarIcon,
	ChevronLeft,
	MapPin,
	Globe
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database, Tables } from "@/types/db-schema";
import { fileUploadService } from "@/lib/file-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn, safelyParseJsonArray } from "@/lib/utils";
import { EnhancedSelect } from "@/components/ui/enhanced-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LocationPicker } from "@/components/ui/location-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateServiceStatus, VerificationDocument } from "@/lib/verification-utils";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];
type VerificationStatusType = Database["public"]["Enums"]["verification_status_type"];

type SupportService = Tables<"support_services">;

interface SupportServiceSidepanelProps {
	service: SupportService | null;
	userId: string;
	userType: UserType;
	profileVerificationStatus?: string;
	onClose: () => void;
	onUpdate: () => void;
}

const AVAILABILITY_OPTIONS = [
	{ value: "24/7", label: "24/7 Emergency Support" },
	{ value: "weekdays_9_5", label: "Weekdays (9 AM - 5 PM)" },
	{ value: "weekdays_extended", label: "Weekdays (8 AM - 8 PM)" },
	{ value: "weekends", label: "Weekends Only" },
	{ value: "by_appointment", label: "By Appointment" },
	{ value: "flexible", label: "Flexible Hours" },
];

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
	profileVerificationStatus,
	onClose,
	onUpdate,
}: SupportServiceSidepanelProps) {
	const [documents, setDocuments] = useState<any[]>([]);
	const [sharedUsers, setSharedUsers] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editData, setEditData] = useState({
		name: "",
		email: "",
		phone_number: "",
		website: "",
		availability: "",
		coverage_area_radius: "5000",
		latitude: null as number | null,
		longitude: null as number | null,
		address: "",
		is_remote: false,
		is_in_person: false,
	});
	const [isSaving, setIsSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false); // Document Upload modal
	const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
	const [isShareModalOpen, setIsShareModalOpen] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

	const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false); // For "Submit for Review"

	// Upload form state
	const [uploadTitle, setUploadTitle] = useState("");
	const [uploadDocNumber, setUploadDocNumber] = useState("");
	const [uploadIssuer, setUploadIssuer] = useState("");
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	// Suspend form state
	const [suspendType, setSuspendType] = useState<"temporary" | "permanent">("temporary");
	const [suspensionDate, setSuspensionDate] = useState<Date | undefined>(undefined);
	const [suspensionReason, setSuspensionReason] = useState("");

	// Share form state
	const [shareEmail, setShareEmail] = useState("");
	
	// Tab State
	const [activeTab, setActiveTab] = useState("new");
	const tabOrder = ["new", "documents", "sharing"] as const;
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const swipeScrollRef = useRef<HTMLDivElement>(null);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
	}, []);

	const handleTouchEnd = useCallback((e: React.TouchEvent) => {
		if (!touchStartRef.current) return;
		const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
		const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
		touchStartRef.current = null;

		// Only trigger if horizontal swipe is dominant and > 50px
		if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

		const currentIndex = tabOrder.indexOf(activeTab as typeof tabOrder[number]);
		if (deltaX < 0 && currentIndex < tabOrder.length - 1) {
			// Swipe left → next tab
			setActiveTab(tabOrder[currentIndex + 1]);
			swipeScrollRef.current?.scrollTo(0, 0);
		} else if (deltaX > 0 && currentIndex > 0) {
			// Swipe right → previous tab
			setActiveTab(tabOrder[currentIndex - 1]);
			swipeScrollRef.current?.scrollTo(0, 0);
		}
	}, [activeTab]);

	// Location State
	const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [shouldUpdateLocation, setShouldUpdateLocation] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	// --- Effects ---

	useEffect(() => {
		if (isEditing && "geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setCurrentLocation({
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					});
				},
				(error) => console.error("Error getting location:", error)
			);
		}
	}, [isEditing]);

	useEffect(() => {
		if (service) {
			loadServiceDocuments();
			loadSharedUsers();
			loadAvailableDocuments();
			setEditData({
				name: service.name || "",
				email: service.email || "",
				phone_number: service.phone_number || "",
				website: service.website || "",
				availability: service.availability || "",
				coverage_area_radius: service.coverage_area_radius ? String(service.coverage_area_radius) : "5000",
				latitude: service.latitude ?? null,
				longitude: service.longitude ?? null,
				address: "", // Address not stored in DB yet, but used for UI
				is_remote: !service.coverage_area_radius, // heuristic
				is_in_person: !!service.coverage_area_radius,
			});
		}
	}, [service]);

	// --- Data Loading ---

	const loadSharedUsers = useCallback(async () => {
		if (!service) return;
		try {
			const { data, error } = await supabase
				.from("service_shares")
				.select(`
					id,
					status,
					created_at,
					to_user:profiles!service_shares_to_user_id_fkey (
						id, first_name, last_name, email, avatar_url
					)
				`)
				.eq("service_id", service.id);

			if (error) throw error;
			setSharedUsers(data || []);
		} catch (error) {
			console.error("Error loading shared users:", error);
		}
	}, [service, supabase]);

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

			let docs: any[] = [];
			if (data?.accreditation_files_metadata) {
				const rawDocs = safelyParseJsonArray(data.accreditation_files_metadata);
				docs = rawDocs.map((d: any) => ({
					...d,
					title: d.title || d.name || 'Untitled Document'
				}));
			}

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
				const profileDocs = safelyParseJsonArray(profile.accreditation_files_metadata);

				profileDocs.forEach((doc: any, index: number) => {
					availableDocs.push({
						id: `profile-${index}`,
						title: doc.title || doc.name || doc.fileName || "Profile Document",
						url: doc.url,
						source: "Profile",
						sourceId: "profile",
						uploadedAt: doc.uploadedAt,
						fileSize: doc.fileSize,
                        docType: doc.docType,
					});
				});
			}

			// Other Services docs
			const { data: otherServices } = await supabase
				.from("support_services")
				.select("id, name, accreditation_files_metadata")
				.eq("user_id", userId) 
				.neq("id", service.id);

			if (otherServices) {
				for (const otherSvc of otherServices) {
					if (otherSvc.accreditation_files_metadata) {
						const svcDocs = safelyParseJsonArray(otherSvc.accreditation_files_metadata);

						svcDocs.forEach((doc: any, index: number) => {
							availableDocs.push({
								id: `${otherSvc.id}-${index}`,
								title: doc.title || doc.name || doc.fileName || "Service Document",
								url: doc.url,
								source: otherSvc.name,
								sourceId: otherSvc.id,
								uploadedAt: doc.uploadedAt,
								fileSize: doc.fileSize,
                                docType: doc.docType,
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

	/**
	 * Helper to update verification_status on support_services.
	 * Updates ONLY the verification_status column in an isolated call so
	 * PostgREST sends it as the sole column value, allowing PostgreSQL to
	 * resolve the text → verification_status_type enum cast correctly.
	 */
	const updateVerificationStatus = async (
		serviceId: string,
		status: VerificationStatusType
	) => {
		const { error } = await supabase
			.from("support_services")
			.update({ verification_status: status } as any)
			.eq("id", serviceId);
		if (error) throw error;
	};

	const handleSubmitForReview = async () => {
		if (!service) return;

		// Check if profile is verified first
		if (profileVerificationStatus !== "verified" && profileVerificationStatus !== "under_review") {
			toast({
				title: "Identity Verification Required",
				description: "Please complete your Identity Verification (ID Front & Back) in the Profile section before submitting your service.",
				variant: "destructive",
			});
			return;
		}

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
			await updateVerificationStatus(service.id, "under_review");

			toast({
				title: "Submitted for Review",
				description: "Your service is now being reviewed by our team.",
			});
			onUpdate();
			onClose(); 
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
			setIsEditing(false);
			setEditData({
				name: service?.name || "",
				email: service?.email || "",
				phone_number: service?.phone_number || "",
				website: service?.website || "",
				availability: service?.availability || "",
				coverage_area_radius: service?.coverage_area_radius ? String(service.coverage_area_radius) : "5000",
				latitude: service?.latitude ?? null,
				longitude: service?.longitude ?? null,
				address: "",
				is_remote: !service?.coverage_area_radius,
				is_in_person: !!service?.coverage_area_radius,
			});
		} else {
			setIsEditing(true);
			setShouldUpdateLocation(false);
		}
	};

	const handleSaveEdit = async () => {
		if (!service) return;
		setIsSaving(true);
		try {
			// When details are edited:
			// 1. Update the non-enum fields + clear documents
			// 2. Separately reset verification_status to 'pending' (enum-safe)
			const { error: fieldsError } = await supabase
				.from("support_services")
				.update({
					name: editData.name,
					email: editData.email || null,
					phone_number: editData.phone_number || null,
					website: editData.website || null,
					availability: editData.availability || null,
					coverage_area_radius: (editData.is_in_person && editData.coverage_area_radius) ? Number(editData.coverage_area_radius) : null,
					latitude: (editData.is_in_person && editData.latitude) ? editData.latitude : null,
					longitude: (editData.is_in_person && editData.longitude) ? editData.longitude : null,
					accreditation_files_metadata: [], // Clear documents
				})
				.eq("id", service.id);

			if (fieldsError) throw fieldsError;

			// Reset verification status separately (enum-safe update)
			await updateVerificationStatus(service.id, "pending");

			setDocuments([]); // Clear local state
			toast({ 
				title: "Details Updated", 
				description: "Verification reset. Please re-upload documents to verify." 
			});
			setIsEditing(false);
			
			// Trigger parent update immediately
			onUpdate();
			
		} catch (error) {
			console.error("Error updating service:", error);
			toast({ title: "Error", description: "Failed to update service details", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleConfirmSuspend = async () => {
		if (!service) return;
		setIsSaving(true);
		try {
			// Update suspension fields (non-enum)
			const suspensionFields: Record<string, any> = {
				suspension_reason: suspensionReason,
			};

			if (suspendType === 'permanent') {
				suspensionFields.is_permanently_suspended = true;
				suspensionFields.suspension_end_date = null;
			} else {
				if (!suspensionDate) {
					toast({ title: "Date Required", description: "Please select an end date for temporary suspension.", variant: "destructive" });
					setIsSaving(false);
					return;
				}
				suspensionFields.is_permanently_suspended = false;
				suspensionFields.suspension_end_date = suspensionDate.toISOString();
			}

			const { error: fieldsError } = await supabase
				.from("support_services")
				.update(suspensionFields)
				.eq("id", service.id);

			if (fieldsError) throw fieldsError;

			// Update verification_status separately (enum-safe)
			await updateVerificationStatus(service.id, "suspended");

			toast({ 
				title: "Service Suspended", 
				description: "Service has been suspended successfully." 
			});
			setIsSuspendModalOpen(false);
			onUpdate();
		} catch (error) {
			console.error("Error suspending service:", error);
			toast({ title: "Error", description: "Failed to suspend service", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleActivate = async () => {
		if (!service) return;
		setIsSaving(true);
		try {
			// Clear suspension fields (non-enum)
			const { error: fieldsError } = await supabase
				.from("support_services")
				.update({ 
					suspension_reason: null,
					suspension_end_date: null,
					is_permanently_suspended: false
				})
				.eq("id", service.id);

			if (fieldsError) throw fieldsError;

			// Set verification_status separately (enum-safe)
			await updateVerificationStatus(service.id, "verified");

			toast({ title: "Service Activated", description: "Service is now active." });
			onUpdate();
		} catch (error) {
			console.error("Error activating service:", error);
			toast({ title: "Error", description: "Failed to activate service", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleConfirmShare = async () => {
		if (!service || !shareEmail) return;
		setIsSaving(true);
		
		try {
			// 1. Find user by email
			const { data: user, error: userError } = await supabase
				.from("profiles")
				.select("id")
				.eq("email", shareEmail)
				.single();

			if (userError || !user) {
				toast({ title: "User Not Found", description: "No professional found with this email.", variant: "destructive" });
				return;
			}

			if (user.id === userId) {
				toast({ title: "Invalid Action", description: "You cannot share a service with yourself.", variant: "destructive" });
				return;
			}

			// 2. Create Share Request logic (via API or direct insert if policy allows)
			// Using API route better for notification logic trigger
			const response = await fetch('/api/services/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					serviceId: service.id, 
					toUserId: user.id 
				})
			});

			if (!response.ok) throw new Error("Failed to share service");

			toast({ title: "Share Request Sent", description: `Invitation sent to ${shareEmail}` });
			setIsShareModalOpen(false);
			setShareEmail("");
			// loadSharedUsers(); // Reload list (pending)
		} catch (error) {
			console.error("Error sharing service:", error);
			toast({ title: "Error", description: "Failed to share service", variant: "destructive" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!service) return;
		// Implement delete logic
		// Check for active matches first?
		toast({ title: "Coming Soon", description: "Delete functionality will be implemented with safety checks." });
		setIsDeleteModalOpen(false);
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

			const newDoc: VerificationDocument = {
				title: uploadTitle,
				url: result.url,
				// fileType: uploadFile.type, // Not in interface, but okay if extra
				// fileSize: uploadFile.size,
				uploadedAt: new Date().toISOString(),
				// uploaded: true,
				// docNumber: uploadDocNumber,
				status: 'pending', // Default
				// issuer: uploadIssuer,
                docType: uploadDocNumber ? 'License' : 'Certificate',
                ...{
                    fileType: uploadFile.type,
                    fileSize: uploadFile.size,
                    uploaded: true,
                    docNumber: uploadDocNumber,
                    issuer: uploadIssuer
                }
			};

			// 2. Save metadata & Update Status
			const updatedDocs = [...documents, newDoc];
            
            // This handles updating the metadata column AND the verification_status column
            // We do NOT need to call saveDocuments separately if we do it here, 
            // BUT updateServiceStatus only updates the status column, not the docs column.
            // So we need to update docs first, then status, OR do both.
            // The utility `updateServiceStatus` calculates status but assumes we pass it the *future* state of docs.
            // It currently only updates `verification_status`.
            
            // Let's reuse saveDocuments to save the docs, then call the utility for the status.
			await saveDocuments(updatedDocs); // Saves docs to DB
            // Disable auto-update. User must submit manually.
			// const newStatus = await updateServiceStatus(supabase, service.id, updatedDocs, service.verification_status as any);

			// Reset form
			setUploadFile(null);
			setUploadTitle("");
			setUploadDocNumber("");
			setUploadIssuer("");
			setIsModalOpen(false);
			toast({ title: "Document Uploaded", description: `Document uploaded.` });
            
            // Trigger update to refresh parent view
            onUpdate();

		} catch (error) {
            console.error(error);
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

		if (!service) return;

		// Ensure no undefined values are passed
		const linkedDoc = {
			title: doc.title || "Untitled Document",
			url: doc.url || "",
			uploadedAt: doc.uploadedAt || new Date().toISOString(),
			status: 'pending', // Linking triggers re-review usually? Or if it's already verified? 
            // If it's a profile doc that is verified, maybe we trust it? 
            // Safest to set to 'pending' for this specific service context, or inherit.
            // Let's default to pending for the service's context unless we want to propagate.
            
			linked: true,
			sourceId: doc.sourceId || null,
			sourceName: doc.source || doc.sourceName || "Unknown Source",
			fileSize: doc.fileSize || 0,
            docType: doc.docType,
		};

		const updatedDocs = [...documents, linkedDoc];
		try {
			await saveDocuments(updatedDocs);
            
            // Update status - DISABLED for manual submission
            // await updateServiceStatus(supabase, service.id, updatedDocs, service.verification_status as any);
            
			toast({ title: "Document Linked", description: "Document linked successfully." });
			setIsModalOpen(false);
            onUpdate();
		} catch (error) {
			console.error("Link existing document error:", error);
			toast({ title: "Link Failed", description: "Failed to link document.", variant: "destructive" });
		}
	};

	const saveDocuments = async (newDocuments: any[]) => {
		if (!service) return;
		
		// Sanitize payload: JSON does not support 'undefined'
		const payload = JSON.parse(JSON.stringify(newDocuments));

		const { error } = await supabase
			.from("support_services")
			.update({ 
                accreditation_files_metadata: payload,
                verification_updated_at: new Date().toISOString()
            })
			.eq("id", service.id);

		if (error) throw error;
		setDocuments(newDocuments);
		onUpdate();
	};

	const handleDeleteDoc = async (docUrl: string, index: number) => {
        if (!service) return;
		try {
			const doc = documents[index];
			if (!doc.linked) {
				await fileUploadService.deleteFile(docUrl, "accreditation");
			}

			const updatedDocs = documents.filter((_, i) => i !== index);
			await saveDocuments(updatedDocs);
            
            // Update status - DISABLED for manual submission
            // await updateServiceStatus(supabase, service.id, updatedDocs, service.verification_status as any);
            
			toast({ title: "Success", description: "Document removed." });
            onUpdate();
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

	const canSubmit = service.verification_status !== "verified" && service.verification_status !== "under_review" && service.verification_status !== "suspended";
	const isVerified = service.verification_status === "verified";
	const isSuspended = service.verification_status === "suspended";
	const isSubmitted = service.verification_status === "under_review";

	return (
		<>
			{/* Mobile Backdrop Overlay */}
			<div className="fixed inset-0 bg-black/50 z-[59] sm:hidden" onClick={onClose} />

			<div className="fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[600px] xl:w-[700px] bg-white shadow-2xl border-l z-[60] isolate transform transition-transform duration-300 ease-out translate-y-0 sm:translate-x-0 flex flex-col h-full active-sidepanel">
				
				{/* Header */}
				<div className="flex-none p-5 border-b border-serene-neutral-200 bg-white backdrop-blur-md z-20">
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
										className="h-8 px-3 text-serene-neutral-600 hover:text-serene-neutral-900 hover:bg-serene-neutral-200/50"
									>
										Cancel
									</Button>
									<Button 
										size="sm" 
										onClick={handleSaveEdit} 
										disabled={isSaving || !editData.name.trim()}
										className="h-8 px-3 bg-sauti-teal hover:bg-sauti-teal/90 text-white shadow-sm"
									>
										{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
									</Button>
								</div>
							) : (
								<>
									<Button variant="ghost" size="icon" onClick={handleEdit} className="h-9 w-9 rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500">
										<Edit className="h-4 w-4" />
									</Button>
									
									<ContextMenu>
										<ContextMenuTrigger>
											<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500">
												<MoreVertical className="h-5 w-5" />
											</Button>
										</ContextMenuTrigger>
										<ContextMenuContent className="w-56">
											{isSuspended ? (
												<ContextMenuItem onClick={handleActivate} className="text-green-600 focus:text-green-600 focus:bg-green-50 cursor-pointer">
													<Play className="h-4 w-4 mr-2" /> Reactivate Service
												</ContextMenuItem>
											) : (
												<ContextMenuItem onClick={() => setIsSuspendModalOpen(true)} className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 cursor-pointer">
													<Power className="h-4 w-4 mr-2" /> Suspend Service
												</ContextMenuItem>
											)}
											<ContextMenuItem onClick={() => setIsShareModalOpen(true)} className="cursor-pointer">
												<Share2 className="h-4 w-4 mr-2" /> Share Service
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem onClick={() => setIsDeleteModalOpen(true)} className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
												<Trash2 className="h-4 w-4 mr-2" /> Delete Service
											</ContextMenuItem>
										</ContextMenuContent>
									</ContextMenu>
								</>
							)}

							<Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-red-50 hover:text-red-600">
								<X className="h-5 w-5" />
							</Button>
						</div>
					</div>
				</div>

				<Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); swipeScrollRef.current?.scrollTo(0, 0); }} className="flex-1 min-h-0 flex flex-col">
					<div className="px-5 border-b border-serene-neutral-200">
						<TabsList className="bg-transparent p-0 w-full flex justify-start gap-8 h-auto">
							<TabsTrigger 
								value="new" 
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-sauti-teal data-[state=active]:text-sauti-teal data-[state=active]:shadow-none py-3 px-1 text-sm font-medium text-serene-neutral-500 transition-all hover:text-serene-neutral-700"
							>
								Overview
							</TabsTrigger>
							<TabsTrigger 
								value="documents" 
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-sauti-teal data-[state=active]:text-sauti-teal data-[state=active]:shadow-none py-3 px-1 text-sm font-medium text-serene-neutral-500 transition-all hover:text-serene-neutral-700"
							>
								Documents
								{documents.length > 0 && (
									<span className="ml-2 bg-serene-neutral-100 text-serene-neutral-600 py-0.5 px-1.5 rounded-full text-[10px] font-bold">
										{documents.length}
									</span>
								)}
							</TabsTrigger>
							<TabsTrigger 
								value="sharing" 
								className="rounded-none border-b-2 border-transparent data-[state=active]:border-sauti-teal data-[state=active]:text-sauti-teal data-[state=active]:shadow-none py-3 px-1 text-sm font-medium text-serene-neutral-500 transition-all hover:text-serene-neutral-700"
							>
								Sharing
								{sharedUsers.length > 0 && (
									<span className="ml-2 bg-serene-neutral-100 text-serene-neutral-600 py-0.5 px-1.5 rounded-full text-[10px] font-bold">
										{sharedUsers.length}
									</span>
								)}
							</TabsTrigger>
						</TabsList>
					</div>

					<div
						ref={swipeScrollRef}
						className="flex-1 overflow-y-auto overscroll-contain"
						style={{ WebkitOverflowScrolling: 'touch' }}
						onTouchStart={handleTouchStart}
						onTouchEnd={handleTouchEnd}
					>
						<div className="p-5 pb-32 sm:pb-8">
							<TabsContent value="new" className="space-y-8 mt-0 focus-visible:outline-none">
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

								{isSuspended && (
									<Alert className="bg-gray-100 border-gray-300">
										<Power className="h-4 w-4 text-gray-600" />
										<AlertTitle className="text-gray-800 font-semibold mb-1">Service Suspended</AlertTitle>
										<AlertDescription className="text-gray-700">
											<p>Reason: {service.suspension_reason}</p>
											{service.is_permanently_suspended ? (
												<p className="mt-1 font-semibold text-red-600">Permanently Suspended</p>
											) : (
												<p className="mt-1">Suspended until: {formatDate(service.suspension_end_date)}</p>
											)}
										</AlertDescription>
									</Alert>
								)}

									<div className="mt-6">
										{isEditing ? (
											<Accordion type="single" collapsible className="w-full space-y-4" defaultValue="details">
												{/* Service Details Accordion Item (Edit Mode) */}
												<AccordionItem value="details" className="border-none">
													<AccordionTrigger className="group py-3 hover:no-underline px-1">
														<div className="flex items-center gap-2">
															<Shield className="h-4 w-4 text-sauti-teal" />
															<span className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider">
																Service Details
															</span>
														</div>
													</AccordionTrigger>
													<AccordionContent className="pb-3 pt-1 px-1">
														<Card className="shadow-none border border-serene-neutral-200 rounded-xl">
															<CardContent className="p-4 space-y-4">
																<div className="flex flex-col gap-4">
																	{/* Email */}
																	<div className="space-y-1.5 w-full">
																		<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Email</span>
																		<Input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="h-9 text-sm rounded-xl border-serene-neutral-200 bg-serene-neutral-50/30 focus:bg-white transition-all shadow-sm w-full" placeholder="email@example.com" />
																	</div>
																	{/* Phone */}
																	<div className="space-y-1.5 w-full">
																		<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Phone</span>
																		<Input value={editData.phone_number} onChange={e => setEditData({...editData, phone_number: e.target.value})} className="h-9 text-sm rounded-xl border-serene-neutral-200 bg-serene-neutral-50/30 focus:bg-white transition-all shadow-sm w-full" placeholder="+254..." />
																	</div>
																	{/* Website */}
																	<div className="space-y-1.5 w-full">
																		<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Website</span>
																		<Input value={editData.website} onChange={e => setEditData({...editData, website: e.target.value})} className="h-9 text-sm rounded-xl border-serene-neutral-200 bg-serene-neutral-50/30 focus:bg-white transition-all shadow-sm w-full" placeholder="https://..." />
																	</div>
																	{/* Availability */}
																	<div className="space-y-1.5 w-full">
																		<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Availability</span>
																		<Select
																			value={editData.availability || ""}
																			onValueChange={(val) => setEditData({...editData, availability: val})}
																		>
																			<SelectTrigger className="w-full h-9 text-sm rounded-xl border-serene-neutral-200 bg-serene-neutral-50/30 focus:bg-white transition-all shadow-sm">
																				<SelectValue placeholder="Select availability..." />
																			</SelectTrigger>
																			<SelectContent>
																				{AVAILABILITY_OPTIONS.map((option) => (
																					<SelectItem key={option.value} value={option.value}>
																						{option.label}
																					</SelectItem>
																				))}
																			</SelectContent>
																		</Select>
																	</div>
																</div>
															</CardContent>
														</Card>
													</AccordionContent>
												</AccordionItem>

												{/* Location & Coverage Accordion Item (Edit Mode) */}
												<AccordionItem value="location" className="border-none">
													<AccordionTrigger className="group py-3 hover:no-underline px-1">
														<div className="flex items-center justify-between w-full pr-4">
															<span className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
																<MapPin className="h-4 w-4 text-sauti-teal" />
																Location & Coverage
															</span>
														</div>
													</AccordionTrigger>
													<AccordionContent className="pb-3 pt-1 px-1">
														<div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
															{/* Service Mode Selection */}
															<div className="grid grid-cols-2 gap-3">
																<div 
																	onClick={() => setEditData(prev => ({ ...prev, is_remote: true, is_in_person: false }))}
																	className={cn(
																		"cursor-pointer rounded-xl border p-3 flex items-center justify-center gap-2 transition-all duration-200",
																		editData.is_remote 
																			? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal shadow-inner" 
																			: "border-serene-neutral-200 bg-white text-serene-neutral-500 hover:border-serene-neutral-300 hover:bg-serene-neutral-50 shadow-sm"
																	)}
																>
																	<Globe className="h-4 w-4" />
																	<span className="text-sm font-semibold">Remote</span>
																</div>
																<div 
																	onClick={() => setEditData(prev => ({ ...prev, is_in_person: true, is_remote: false }))}
																	className={cn(
																		"cursor-pointer rounded-xl border p-3 flex items-center justify-center gap-2 transition-all duration-200",
																		editData.is_in_person 
																			? "border-sauti-teal bg-sauti-teal/5 text-sauti-teal shadow-inner" 
																			: "border-serene-neutral-200 bg-white text-serene-neutral-500 hover:border-serene-neutral-300 hover:bg-serene-neutral-50 shadow-sm"
																	)}
																>
																	<MapPin className="h-4 w-4" />
																	<span className="text-sm font-semibold">In-Person</span>
																</div>
															</div>

															{editData.is_in_person && (
																<div className="space-y-2">
																	<div className="flex items-center justify-between">
																		{editData.address && (
																			<span className="text-xs text-sauti-teal font-medium truncate max-w-[200px]">
																				{editData.address}
																			</span>
																		)}
																	</div>
																	<div className="rounded-xl overflow-hidden shadow-none border border-serene-neutral-200">
																		<LocationPicker
																			initialLat={editData.latitude || -1.2921}
																			initialLng={editData.longitude || 36.8219}
																			initialRadius={Number(editData.coverage_area_radius) || 5000}
																			initialAddress={editData.address}
																			onLocationChange={(lat, lng, address) => {
																				setEditData(prev => ({ ...prev, latitude: lat, longitude: lng, address }));
																			}}
																			onRadiusChange={(radius) => {
																				setEditData(prev => ({ ...prev, coverage_area_radius: String(radius) }));
																			}}
																			className="w-full"
																		/>
																	</div>
																</div>
															)}
														</div>
													</AccordionContent>
												</AccordionItem>
											</Accordion>
										) : (
											/* View Mode: Vertical Stack (No Accordion) */
											<div className="space-y-8">
												{/* Service Details (View Mode) */}
												<section className="space-y-4">
													<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
														<Shield className="h-4 w-4 text-sauti-teal" />
														Service Details
													</h3>
													<Card className="shadow-none border border-serene-neutral-200 rounded-xl">
														<CardContent className="p-4 space-y-4">
															<div className="grid grid-cols-2 gap-4">
																<div className="space-y-1.5 overflow-hidden">
																	<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Email</span>
																	<span className="text-sm text-serene-neutral-900 break-all font-medium block truncate" title={service.email || ""}>{service.email || "Not provided"}</span>
																</div>
																<div className="space-y-1.5 overflow-hidden">
																	<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Phone</span>
																	<span className="text-sm text-serene-neutral-900 font-medium block truncate" title={service.phone_number || ""}>{service.phone_number || "Not provided"}</span>
																</div>
																<div className="space-y-1.5 overflow-hidden">
																	<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Website</span>
																	{service.website ? (
																		<a href={service.website} target="_blank" rel="noopener noreferrer" className="text-sm text-sauti-teal hover:underline break-all truncate block font-medium" title={service.website}>
																			{service.website}
																		</a>
																	) : (
																		<span className="text-sm text-serene-neutral-400 italic block">Not provided</span>
																	)}
																</div>
																<div className="space-y-1.5 overflow-hidden">
																	<span className="text-xs font-semibold text-serene-neutral-500 uppercase tracking-wide">Availability</span>
																	<p className="text-sm text-serene-neutral-900 leading-relaxed truncate" title={AVAILABILITY_OPTIONS.find(opt => opt.value === service.availability)?.label || service.availability || ""}>
																		{AVAILABILITY_OPTIONS.find(opt => opt.value === service.availability)?.label || service.availability || "Not provided"}
																	</p>
																</div>
															</div>
														</CardContent>
													</Card>
												</section>

												{/* Location & Coverage (View Mode) */}
												<section className="space-y-4">
													<div className="flex items-center justify-between pr-4">
														<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
															<MapPin className="h-4 w-4 text-sauti-teal" />
															Location & Coverage
														</h3>
													</div>
													
													<div className="space-y-4">
														<div className="flex gap-2 flex-wrap">
															{(!service.coverage_area_radius || service.coverage_area_radius === 0) && (
																<div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-serene-neutral-100 text-serene-neutral-700 border border-serene-neutral-200">
																	<Globe className="h-3.5 w-3.5" />
																	Remote Service
																</div>
															)}
															{service.coverage_area_radius && service.coverage_area_radius > 0 && (
																<div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-sauti-teal/5 text-sauti-teal border border-sauti-teal/10">
																	<MapPin className="h-3.5 w-3.5" />
																	In-Person Service
																</div>
															)}
														</div>

														{service.coverage_area_radius && service.coverage_area_radius > 0 && service.latitude && service.longitude && (
															<div className="relative h-[400px] w-full rounded-xl overflow-hidden shadow-sm border border-serene-neutral-200 mt-4 group">
																<LocationPicker
																	initialLat={service.latitude}
																	initialLng={service.longitude}
																	initialRadius={Number(service.coverage_area_radius)}
																	disabled={true}
																	onLocationChange={() => {}}
																	onRadiusChange={() => {}}
																	className="w-full h-full"
																/>
																{/* Map Overlay for Coverage Info */}
																<div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-sm border border-serene-neutral-200/50">
																	<div className="flex items-center gap-2">
																		<div className="h-2 w-2 rounded-full bg-sauti-teal animate-pulse" />
																		<span className="text-xs font-semibold text-serene-neutral-900">
																			Coverage Area: {(service.coverage_area_radius / 1000).toFixed(1)} km radius
																		</span>
																	</div>
																</div>
															</div>
														)}
													</div>
												</section>
											</div>
										)}
									</div>

							</TabsContent>

							<TabsContent value="documents" className="space-y-6 mt-0 focus-visible:outline-none">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
										<FileText className="h-4 w-4 text-sauti-teal" />
										Verification Documents
									</h3>
									<Button size="sm" onClick={() => setIsModalOpen(true)} className="h-9 bg-serene-neutral-900 hover:bg-serene-neutral-800 text-white shadow-sm gap-2 rounded-lg">
										<Plus className="h-3.5 w-3.5" />
										Add Document
									</Button>
								</div>

								{documents.length === 0 ? (
									<div className="text-center py-12 border-2 border-dashed border-serene-neutral-200 rounded-2xl bg-serene-neutral-50/50">
										<div className="mx-auto w-14 h-14 rounded-full bg-white shadow-sm border border-serene-neutral-100 flex items-center justify-center mb-4">
											<FileText className="h-6 w-6 text-serene-neutral-400" />
										</div>
										<h4 className="text-base font-semibold text-serene-neutral-900">No documents yet</h4>
										<p className="text-sm text-serene-neutral-500 mt-1 mb-6 max-w-xs mx-auto">Upload licenses, certificates, or other proof of operation.</p>
										<Button variant="outline" onClick={() => setIsModalOpen(true)} className="bg-white">
											Upload First Document
										</Button>
									</div>
								) : (
									<div className="grid grid-cols-1 gap-3">
										{documents.map((doc, idx) => (
											<div key={idx} className="group relative bg-white border border-serene-neutral-200 rounded-xl p-4 transition-all hover:shadow-md hover:border-sauti-teal/30">
												<div className="flex items-start gap-4">
													<div className="h-10 w-10 rounded-lg bg-sauti-teal/5 border border-sauti-teal/10 flex items-center justify-center flex-shrink-0 text-sauti-teal">
														<FileText className="h-5 w-5" />
													</div>
													<div className="flex-1 min-w-0 pt-0.5">
														<div className="flex items-center justify-between mb-1">
															<h4 className="font-semibold text-serene-neutral-900 text-sm truncate pr-2" title={doc.title}>{doc.title}</h4>
															{doc.linked && (
																<Badge variant="secondary" className="text-[10px] items-center gap-1 bg-serene-blue-50 text-serene-blue-700 border-serene-blue-200 px-1.5 py-0 h-5 whitespace-nowrap">
																	<LinkIcon className="h-3 w-3" /> Linked
																</Badge>
															)}
                                                            {doc.docType && (
                                                                <Badge variant="outline" className="text-[10px] h-5 border-serene-neutral-200 text-serene-neutral-500 bg-white">
                                                                    {doc.docType}
                                                                </Badge>
                                                            )}
														</div>
														<div className="flex items-center gap-3 text-xs text-serene-neutral-500">
															<span>{formatFileSize(doc.fileSize)}</span>
															<span className="text-serene-neutral-300">•</span>
															<span>{formatDate(doc.uploadedAt)}</span>
															{doc.sourceName && (
																<>
																	<span className="text-serene-neutral-300">•</span>
																	<span>From: {doc.sourceName}</span>
																</>
															)}
														</div>
													</div>
													<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
														<Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-500 hover:text-sauti-teal hover:bg-sauti-teal/10 rounded-lg" onClick={() => window.open(doc.url, '_blank')}>
															<Eye className="h-4 w-4" />
														</Button>
														<Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDeleteDoc(doc.url, idx)}>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</TabsContent>

							<TabsContent value="sharing" className="space-y-6 mt-0 focus-visible:outline-none">
								<div className="bg-gradient-to-br from-serene-blue-50 to-white rounded-xl p-5 border border-serene-blue-100/50 flex gap-4 shadow-sm">
									<div className="bg-white p-2.5 rounded-lg shadow-sm h-fit">
										<Users className="h-5 w-5 text-serene-blue-600" />
									</div>
									<div className="space-y-1">
										<h4 className="text-sm font-bold text-serene-blue-900">Collaborative Management</h4>
										<p className="text-xs text-serene-blue-700/80 leading-relaxed max-w-sm">
											Invite other professionals to help manage this service. They will be able to view details and use this service for client matches.
										</p>
									</div>
								</div>

								<div className="flex items-center justify-between">
									<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
										<Share2 className="h-4 w-4 text-sauti-teal" />
										Shared With
									</h3>
									<Button size="sm" onClick={() => setIsShareModalOpen(true)} variant="outline" className="h-9 gap-2 shadow-sm bg-white hover:bg-serene-neutral-50">
										<Plus className="h-3.5 w-3.5" />
										Invite Professional
									</Button>
								</div>

								{sharedUsers.length === 0 ? (
									<div className="text-center py-12 rounded-2xl border border-dashed border-serene-neutral-200">
										<p className="text-serene-neutral-400 text-sm font-medium">No one has access to this service yet.</p>
									</div>
								) : (
									<div className="space-y-3">
										{sharedUsers.map((share) => (
											<div key={share.id} className="flex items-center justify-between p-3 bg-white border border-serene-neutral-200 rounded-xl hover:shadow-sm transition-all">
												<div className="flex items-center gap-3">
													{/* Avatar placeholder */}
													<div className="h-9 w-9 rounded-full bg-gradient-to-br from-serene-neutral-100 to-serene-neutral-200 border border-white shadow-sm flex items-center justify-center text-xs font-bold text-serene-neutral-600">
														{share.to_user.first_name?.[0] || 'U'}
													</div>
													<div>
														<p className="text-sm font-semibold text-serene-neutral-900">{share.to_user.first_name} {share.to_user.last_name}</p>
														<p className="text-xs text-serene-neutral-500">{share.to_user.email}</p>
													</div>
												</div>
												<Badge variant="secondary" className={`capitalize font-medium ${
													share.status === 'accepted' ? 'bg-serene-green-50 text-serene-green-700 border-serene-green-200' : 
													share.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
													'bg-serene-neutral-100 text-serene-neutral-600'
												}`}>
													{share.status}
												</Badge>
											</div>
										))}
									</div>
								)}
							</TabsContent>
						</div>
					</div>
				</Tabs>

				{/* Footer Actions */}
				<div className="flex-none p-4 sm:p-5 pt-3 sm:pt-3 border-t border-serene-neutral-200 bg-white z-20">
					<div className="flex items-center justify-between gap-4">
						{/* Back Button */}
						{activeTab !== 'new' ? (
							<Button 
								variant="ghost" 
								onClick={() => setActiveTab(activeTab === 'sharing' ? 'documents' : 'new')} 
								className="gap-2 text-serene-neutral-600 hover:text-serene-neutral-900 pl-0 hover:bg-transparent hover:underline transition-all"
							>
								<ChevronLeft className="h-4 w-4" /> Back
							</Button>
						) : (
							<div /> 
						)}

						{/* Forward Actions */}
						<div className="flex items-center gap-2">
							{activeTab === 'new' && (
								<Button onClick={() => setActiveTab('documents')} className="bg-serene-neutral-900 hover:bg-serene-neutral-800 text-white gap-2 shadow-sm rounded-xl px-5 transition-all">
									Next: Documents <ArrowRight className="h-4 w-4" />
								</Button>
							)}
							
							{activeTab === 'documents' && (
								<Button onClick={() => setActiveTab('sharing')} className="bg-serene-neutral-900 hover:bg-serene-neutral-800 text-white gap-2 shadow-sm rounded-xl px-5 transition-all">
									Next: Sharing <ArrowRight className="h-4 w-4" />
								</Button>
							)}

							{activeTab === 'sharing' && canSubmit && (
								<Button 
									className="bg-sauti-teal hover:bg-sauti-teal/90 text-white shadow-md gap-2 rounded-xl px-6 transition-all"
									onClick={handleSubmitForReview}
									disabled={isSubmitting || documents.length === 0}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="animate-spin h-4 w-4" />
											Submitting...
										</>
									) : (
										<>
											Submit for Verification 
											<CheckCircle className="h-4 w-4" />
										</>
									)}
								</Button>
							)}
							{activeTab === 'sharing' && !canSubmit && isSubmitted && (
								<div className="bg-amber-50 text-amber-800 px-4 py-2 rounded-xl border border-amber-200 font-medium text-sm flex items-center gap-2">
									<Clock className="h-4 w-4" />
									Under Review
								</div>
							)}
						</div>
					</div>
				</div>
			</div>


			{/* --- Modals --- */}
			
			{/* Document Upload Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-md rounded-2xl bg-white shadow-2xl border-none p-6 z-[70]">
					<DialogHeader className="space-y-3 pb-4">
						<DialogTitle className="text-xl font-bold text-serene-neutral-900 flex items-center gap-2">
							<FileText className="h-5 w-5 text-sauti-teal" />
							Add Verification Document
						</DialogTitle>
						<DialogDescription className="text-serene-neutral-500 text-sm leading-relaxed">
							Attach a license, certificate, or proof of registration to verify this service. You can upload a new file or reuse one from your library.
						</DialogDescription>
					</DialogHeader>
					
					{/* Tabs for Upload vs Link */}
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
										placeholder="Document Title (e.g. Medical License)" 
										value={uploadTitle} 
										onChange={e => setUploadTitle(e.target.value)}
										className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors"
									/>
									<div className="grid grid-cols-2 gap-3">
										<Input 
											placeholder="License No." 
											value={uploadDocNumber} 
											onChange={e => setUploadDocNumber(e.target.value)}
											className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors"
										/>
										<Input 
											placeholder="Issuing Auth. (Optional)" 
											value={uploadIssuer} 
											onChange={e => setUploadIssuer(e.target.value)}
											className="h-12 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal bg-serene-neutral-50/50 focus:bg-white transition-colors"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<label className="text-xs font-semibold text-serene-neutral-700 uppercase tracking-wide ml-1">File Attachment</label>
								<FileUploadZone 
									onFileSelect={handleFileSelect}
									isDragOver={isDragOver}
									file={uploadFile}
									onClearFile={() => setUploadFile(null)}
									handleDragOver={handleDragOver}
									handleDragLeave={handleDragLeave}
									handleDrop={handleDrop}
								/>
							</div>

							<Button 
								className="w-full h-12 text-base font-medium shadow-lg shadow-sauti-teal/20 bg-sauti-teal hover:bg-sauti-teal/90 text-white rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] mt-2" 
								onClick={handleUploadNew} 
								disabled={isUploading || !uploadFile || !uploadTitle}
							>
								{isUploading ? (
									<>
										<Loader2 className="animate-spin h-5 w-5 mr-2" />
										Uploading...
									</>
								) : (
									<>
										<Upload className="h-5 w-5 mr-2" />
										Upload & Attach Document
									</>
								)}
							</Button>
						</TabsContent>

						<TabsContent value="existing" className="focus-visible:outline-none mt-0">
							<ScrollArea className="h-[350px] -mr-4 pr-4">
								<div className="space-y-3 pb-2">
									{availableDocuments.map((doc) => {
										const isAttached = documents.some(d => d.url === doc.url);
										return (
											<div 
												key={doc.id} 
												className={`
													relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group
													${isAttached 
														? "bg-serene-neutral-50 border-serene-neutral-200 cursor-default opacity-70" 
														: "bg-white border-serene-neutral-200 hover:border-sauti-teal hover:shadow-md hover:shadow-sauti-teal/5 cursor-pointer"
													}
												`}
												onClick={() => !isAttached && linkExistingDocument(doc)}
											>
												<div className="flex items-center gap-4">
													<div className={`
														h-12 w-12 rounded-xl flex items-center justify-center transition-colors
														${isAttached ? "bg-serene-neutral-100 text-serene-neutral-400" : "bg-sauti-teal/5 text-sauti-teal group-hover:bg-sauti-teal/10"}
													`}>
														<FileText className="h-6 w-6" />
													</div>
													<div>
														<p className={`text-sm font-bold ${isAttached ? "text-serene-neutral-600" : "text-serene-neutral-900 group-hover:text-sauti-teal"}`}>
															{doc.title}
														</p>
														<div className="flex items-center gap-2 mt-1">
															<Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-serene-neutral-500 bg-white border-serene-neutral-200">
																{doc.sourceName}
															</Badge>
															<span className="text-xs text-serene-neutral-400">• {formatDate(doc.uploadedAt)}</span>
														</div>
													</div>
												</div>
												
												{isAttached ? (
													<Badge variant="secondary" className="bg-serene-neutral-200/50 text-serene-neutral-500 border-transparent px-2.5 py-1">
														Attached
													</Badge>
												) : (
													<Button 
														size="sm" 
														className="bg-white text-sauti-teal border-2 border-sauti-teal/10 hover:border-sauti-teal hover:bg-sauti-teal hover:text-white transition-all shadow-sm rounded-lg"
													>
														<Plus className="h-4 w-4 mr-1.5" />
														Link
													</Button>
												)}
											</div>
										);
									})}
									{availableDocuments.length === 0 && (
										<div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-serene-neutral-100 rounded-2xl bg-serene-neutral-50/30">
											<div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
												<FileText className="h-8 w-8 text-serene-neutral-300" />
											</div>
											<p className="text-base font-semibold text-serene-neutral-900">No documents found</p>
											<p className="text-sm text-serene-neutral-500 max-w-[200px] mt-1 leading-relaxed">
												You haven't uploaded documents to other services yet.
											</p>
											<Button variant="link" onClick={() => (document.querySelector('[value="upload"]') as HTMLElement)?.click()} className="mt-2 text-sauti-teal">
												Upload a new document
											</Button>
										</div>
									)}
								</div>
							</ScrollArea>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			{/* Suspend Modal */}
			<Dialog open={isSuspendModalOpen} onOpenChange={setIsSuspendModalOpen}>
				<DialogContent className="max-w-md rounded-2xl z-[70]">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-serene-neutral-900">Suspend Service</DialogTitle>
						<DialogDescription className="text-serene-neutral-500">
							Temporarily or permanently remove this service from active matching.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-5 py-3">
						<div className="space-y-2">
							<label className="text-sm font-semibold text-serene-neutral-700">Suspension Type</label>
							<Select value={suspendType} onValueChange={(val: any) => setSuspendType(val)}>
								<SelectTrigger className="w-full h-11 rounded-xl border-serene-neutral-200">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="rounded-xl">
									<SelectItem value="temporary">Temporary (Set End Date)</SelectItem>
									<SelectItem value="permanent">Permanent</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{suspendType === 'temporary' && (
							<div className="space-y-2 flex flex-col">
								<label className="text-sm font-semibold text-serene-neutral-700">Reactivate On</label>
								<Popover>
									<PopoverTrigger asChild>
										<Button variant={"outline"} className={cn("w-full h-11 justify-start text-left font-normal rounded-xl border-serene-neutral-200", !suspensionDate && "text-muted-foreground")}>
											<CalendarIcon className="mr-2 h-4 w-4 text-serene-neutral-400" />
											{suspensionDate ? format(suspensionDate, "PPP") : <span>Pick a date</span>}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0 rounded-xl" align="start">
										<Calendar
											mode="single"
											selected={suspensionDate}
											onSelect={setSuspensionDate}
											disabled={(date) => date < new Date()}
											initialFocus
											className="rounded-xl border border-serene-neutral-200"
										/>
									</PopoverContent>
								</Popover>
							</div>
						)}

						<div className="space-y-2">
							<label className="text-sm font-semibold text-serene-neutral-700">Reason for Suspension</label>
							<Textarea 
								placeholder="E.g., Staff shortage, Renovation, Holiday..." 
								value={suspensionReason}
								onChange={e => setSuspensionReason(e.target.value)}
								className="min-h-[100px] rounded-xl border-serene-neutral-200 resize-none focus-visible:ring-sauti-teal"
							/>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="ghost" onClick={() => setIsSuspendModalOpen(false)} className="rounded-xl hover:bg-serene-neutral-100 text-serene-neutral-600">Cancel</Button>
						<Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm" onClick={handleConfirmSuspend} disabled={isSaving}>
							{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirm Suspension"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Share Modal */}
			<Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
				<DialogContent className="max-w-md rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-serene-neutral-900">Share Service</DialogTitle>
						<DialogDescription className="text-serene-neutral-500">
							Invite professionals to view and match with this service.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-5 py-3">
						<div className="space-y-2">
							<label className="text-sm font-semibold text-serene-neutral-700">Professional's Email</label>
							<Input 
								placeholder="colleague@example.com" 
								value={shareEmail}
								onChange={e => setShareEmail(e.target.value)}
								className="h-11 rounded-xl border-serene-neutral-200 focus-visible:ring-sauti-teal"
							/>
							<p className="text-xs text-serene-neutral-400">They must have a Sauti Salama professional account.</p>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="ghost" onClick={() => setIsShareModalOpen(false)} className="rounded-xl hover:bg-serene-neutral-100 text-serene-neutral-600">Cancel</Button>
						<Button className="bg-sauti-teal hover:bg-sauti-teal/90 text-white rounded-xl shadow-sm" onClick={handleConfirmShare} disabled={isSaving || !shareEmail}>
							{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : "Send Invitation"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

		</>
	);
}
