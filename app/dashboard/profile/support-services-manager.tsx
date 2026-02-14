"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Building,
	Plus,
	Eye,
	Edit,
	Trash2,
	Shield,
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
	Briefcase,
	Mail,
	Phone,
	FileText,
	Share2,
	Play
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database, Tables } from "@/types/db-schema";
import { SupportServiceSidepanel } from "./support-services-sidepanel";
import { cn, safelyParseJsonArray } from "@/lib/utils";

import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

type SupportService = Tables<"support_services">;

interface ServiceShare {
	id: string;
	status: string;
	service: SupportService;
	from_user: {
		first_name: string | null;
		last_name: string | null;
		email: string | null;
	} | null;
}

interface SupportServicesManagerProps {
	userId: string;
	userType: UserType;
	verificationStatus?: string;
	hasAccreditation?: boolean;
	hasMatches?: boolean;
	verificationNotes?: string;
	documentsCount?: number;
	onDataUpdate: () => void;
}

export function SupportServicesManager({
	userId,
	userType,
	verificationStatus = "pending",
	hasAccreditation = false,
	hasMatches = false,
	verificationNotes,
	documentsCount = 0,
	onDataUpdate,
}: SupportServicesManagerProps) {
	const dash = useDashboardData();
	const [selectedService, setSelectedService] = useState<SupportService | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [isDeleting, setIsDeleting] = useState<string | null>(null);
	
	// Sharing State
	const [sharedServices, setSharedServices] = useState<ServiceShare[]>([]);
	const [isLoadingShared, setIsLoadingShared] = useState(true);

	const supabase = createClient();
	const { toast } = useToast();

	// Use data from dashboard provider
	const services = dash?.data?.supportServices || [];
	const isLoading = !dash?.data?.preloaded;

	// --- Effects ---
	useEffect(() => {
		loadSharedServices();
	}, [userId]);

	const loadSharedServices = useCallback(async () => {
		try {
			setIsLoadingShared(true);
			const { data, error } = await supabase
				.from("service_shares")
				.select(`
					id,
					status,
					service:support_services (*), 
					from_user:profiles!service_shares_from_user_id_fkey (
						first_name, last_name, email
					)
				`)
				.eq("to_user_id", userId);

			if (error) throw error;
			
			// Transform data to match types if needed, supabase types are complex
			setSharedServices(data as any || []);
		} catch (error) {
			console.error("Error loading shared services:", error);
		} finally {
			setIsLoadingShared(false);
		}
	}, [userId, supabase]);


	// --- Logic ---

	const getActiveServiceCount = () => {
		const ownActive = services.filter(s => s.verification_status !== 'suspended').length;
		const sharedActive = sharedServices.filter(s => s.status === 'accepted' && s.service.verification_status !== 'suspended').length;
		return ownActive + sharedActive;
	};

	const canAddService = () => {
		if (userType === "professional") {
			return getActiveServiceCount() < 2;
		}
		if (userType === "ngo") {
			return true; 
		}
		return false;
	};

	const deleteService = async (serviceId: string) => {
		setIsDeleting(serviceId);
		try {
			const { error } = await supabase
				.from("support_services")
				.delete()
				.eq("id", serviceId);

			if (error) throw error;

			// Update provider data
			const updatedServices = services.filter((s) => s.id !== serviceId);
			dash?.updatePartial({
				supportServices: updatedServices,
			});

			onDataUpdate?.();
			toast({
				title: "Success",
				description: "Support service deleted successfully",
			});
		} catch (error) {
			console.error("Error deleting service:", error);
			toast({
				title: "Error",
				description: "Failed to delete support service",
				variant: "destructive",
			});
		} finally {
			setIsDeleting(null);
		}
	};

	const handleAcceptShare = async (share: ServiceShare) => {
		// Check limit
		if (getActiveServiceCount() >= 2) {
			toast({
				title: "Limit Reached",
				description: "You can only have 2 active services. Please suspend a service to accept this invitation.",
				variant: "destructive"
			});
			return;
		}

		try {
			const { error } = await supabase
				.from("service_shares")
				.update({ status: "accepted" })
				.eq("id", share.id);

			if (error) throw error;

			toast({ title: "Invitation Accepted", description: "You now have access to this service." });
			loadSharedServices();
		} catch (error) {
			toast({ title: "Error", description: "Failed to accept invitation.", variant: "destructive" });
		}
	};

	const handleDeclineShare = async (shareId: string) => {
		try {
			const { error } = await supabase
				.from("service_shares")
				.update({ status: "declined" }) // or delete?
				.eq("id", shareId);

			if (error) throw error;
			toast({ title: "Invitation Declined", description: "You have declined the invitation." });
			loadSharedServices();
		} catch (error) {
			toast({ title: "Error", description: "Failed to decline invitation.", variant: "destructive" });
		}
	};

	// --- Render Helpers ---

	const getStatusColor = (status?: string | null) => {
		if (status?.includes("&") || status?.includes(",")) return "bg-amber-50 text-amber-700 border-amber-200";
		switch (status) {
			case "verified":
				return "bg-serene-green-100 text-serene-green-700 border-serene-green-200";
			case "rejected":
				return "bg-red-100 text-red-700 border-red-200";
			case "under_review":
				return "bg-amber-50 text-amber-700 border-amber-200";
			case "suspended":
				return "bg-gray-100 text-gray-700 border-gray-200";
			default:
				return "bg-serene-neutral-100 text-serene-neutral-600 border-serene-neutral-200";
		}
	};

	const formatDate = (dateString?: string | null) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getDocumentCount = (service: SupportService) => {
		return safelyParseJsonArray(service.accreditation_files_metadata).length;
	};

	// Partition shared services
	const pendingInvites = sharedServices.filter(s => s.status === 'pending');
	const acceptedShares = sharedServices.filter(s => s.status === 'accepted');

	// Consolidated Status Logic
	const getConsolidatedStatus = () => {
		if (services.length === 0) return { label: "Pending", color: getStatusColor("pending"), icon: <Briefcase className="h-6 w-6" /> };
		
		const verifiedCount = services.filter(s => s.verification_status === 'verified').length;
		const reviewCount = services.filter(s => s.verification_status === 'under_review').length;
		const rejectedCount = services.filter(s => s.verification_status === 'rejected').length;
		const total = services.length;

		if (rejectedCount > 0) return { label: "Action Required", color: getStatusColor("rejected"), icon: <AlertCircle className="h-6 w-6" /> };
		if (verifiedCount > 0 && reviewCount > 0) return { label: `${verifiedCount} Verified, ${reviewCount} In Review`, color: getStatusColor("under_review"), icon: <Clock className="h-6 w-6" /> };
		if (verifiedCount === total) return { label: "All Verified", color: getStatusColor("verified"), icon: <CheckCircle className="h-6 w-6" /> };
		if (reviewCount === total) return { label: "Under Review", color: getStatusColor("under_review"), icon: <Clock className="h-6 w-6" /> };
		
		return { label: "Pending", color: getStatusColor("pending"), icon: <Briefcase className="h-6 w-6" /> };
	};

	const consolidated = getConsolidatedStatus();

	return (
		<div className="space-y-8">
			{/* Header Card */}
			<div className="bg-white rounded-3xl border border-serene-neutral-200 p-5 sm:p-6 shadow-sm overflow-hidden relative">
				<div className="absolute top-0 right-0 w-32 h-32 bg-serene-blue-50/50 rounded-full -mr-16 -mt-16 blur-2xl" />
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
					<div className="flex items-start sm:items-center gap-4">
						<div className={cn("p-3 sm:p-4 rounded-2xl flex-shrink-0 shadow-sm", consolidated.color)}>
							{consolidated.icon}
						</div>
						<div>
							<div className="flex flex-wrap items-center gap-2 mb-1.5">
								<h3 className="font-bold text-lg sm:text-xl text-serene-neutral-900">
									Support Services
								</h3>
								<Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider border-0", consolidated.color)}>
									{consolidated.label}
								</Badge>
							</div>
							<p className="text-sm text-serene-neutral-500 max-w-md leading-relaxed">
								{services.length === 0 
									? "Add your first service to start helping survivors." 
									: `Managing ${services.length} ${services.length === 1 ? 'service' : 'services'}. professionals are limited to 2 active services.`}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{canAddService() && (
							<Button 
								onClick={() => setShowAddForm(true)} 
								className="bg-sauti-teal hover:bg-sauti-dark text-white rounded-xl h-11 px-5 shadow-md shadow-sauti-teal/10 w-full sm:w-auto"
							>
								<Plus className="h-4 w-4 mr-2" /> Add Service
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Pending Invitations */}
			{pendingInvites.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-sm font-bold text-serene-neutral-900 uppercase tracking-wider flex items-center gap-2">
						<Mail className="h-4 w-4 text-sauti-teal" />
						Pending Invitations
					</h3>
					<div className="grid gap-4 md:grid-cols-2">
						{pendingInvites.map(share => (
							<div key={share.id} className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex items-center justify-between">
								<div>
									<h4 className="font-semibold text-serene-neutral-900">{share.service.name}</h4>
									<p className="text-sm text-serene-neutral-500">
										Invited by {share.from_user?.first_name} {share.from_user?.last_name}
									</p>
								</div>
								<div className="flex gap-2">
									<Button size="sm" variant="outline" onClick={() => handleDeclineShare(share.id)}>Decline</Button>
									<Button size="sm" className="bg-sauti-teal text-white" onClick={() => handleAcceptShare(share)}>Accept</Button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Service Lists */}
			<div className="space-y-6">
				{isLoading ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<Card key={i} className="animate-pulse shadow-sm border-serene-neutral-200">
								<CardContent className="p-5">
									<div className="h-4 bg-serene-neutral-100 rounded mb-2" />
									<div className="h-3 bg-serene-neutral-100 rounded mb-4" />
									<div className="h-6 bg-serene-neutral-100 rounded w-20" />
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						
						{/* Owned Services */}
						{services.map((service) => (
							<ServiceCard 
								key={service.id}
								service={service}
								isShared={false}
								onClick={() => setSelectedService(service)}
								onDelete={() => deleteService(service.id)}
								isDeleting={isDeleting === service.id}
							/>
						))}

						{/* Shared Services */}
						{acceptedShares.map((share) => (
							<ServiceCard 
								key={share.id}
								service={share.service}
								isShared={true}
								sharedBy={`${share.from_user?.first_name} ${share.from_user?.last_name}`}
								onClick={() => setSelectedService(share.service)}
								onDelete={() => {}} // Can't delete shared? Maybe "Leave"?
							/>
						))}

						{/* Add Service Card - Only if limit not reached */}
						{canAddService() && (
							<div
								className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-serene-neutral-300 hover:border-sauti-teal/50 hover:bg-sauti-teal/5 transition-all cursor-pointer min-h-[200px]"
								onClick={() => setShowAddForm(true)}
							>
								<div className="h-12 w-12 rounded-full bg-serene-neutral-100 flex items-center justify-center mb-4 group-hover:bg-sauti-teal/20 transition-colors">
									<Plus className="h-6 w-6 text-serene-neutral-400 group-hover:text-sauti-teal" />
								</div>
								<h3 className="text-lg font-semibold text-serene-neutral-900 mb-1 group-hover:text-sauti-teal">
									Add Service
								</h3>
								<p className="text-sm text-serene-neutral-500 text-center">
									{services.length === 0 ? "Create your first service" : "Add another service"}
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Add Service Dialog */}
			<Dialog open={showAddForm} onOpenChange={setShowAddForm}>
				<DialogContent className="w-full h-[100dvh] sm:h-[90vh] sm:max-w-3xl p-0 gap-0 flex flex-col max-sm:rounded-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-0 max-sm:left-0">
					<DialogTitle className="sr-only">Register Support Service</DialogTitle>
					<AddSupportServiceForm
						onSuccess={async (newServiceId) => {
							setShowAddForm(false);
							// Refresh data from server and update provider
							try {
								const { data, error } = await supabase
									.from("support_services")
									.select("*")
									.eq("user_id", userId)
									.order("created_at", { ascending: false });

								if (!error && data) {
									dash?.updatePartial({
										supportServices: data,
									});
									
									if (newServiceId) {
										const newService = data.find(s => s.id === newServiceId);
										if (newService) {
											setSelectedService(newService);
											toast({
												title: "Service Created",
												description: "Please upload your verification documents now.",
											});
										}
									}
								}
							} catch (error) {
								console.error("Error refreshing services:", error);
							}
							onDataUpdate?.();
						}}
					/>
				</DialogContent>
			</Dialog>

			{/* Sidepanel */}
			{selectedService && (
				<SupportServiceSidepanel
					service={selectedService}
					userId={userId}
					userType={userType}
					profileVerificationStatus={verificationStatus}
					onClose={() => setSelectedService(null)}
					onUpdate={async () => {
						try {
							// Re-fetch services from DB and update provider + local state (no page reload)
							const { data, error } = await supabase
								.from("support_services")
								.select("*")
								.eq("user_id", userId)
								.order("created_at", { ascending: false });

							if (!error && data) {
								dash?.updatePartial({ supportServices: data });

								// Update the selectedService with fresh data so sidepanel reflects changes
								const updated = data.find(s => s.id === selectedService.id);
								if (updated) {
									setSelectedService(updated);
								}
							}
						} catch (err) {
							console.error("Error refreshing services:", err);
						}
						loadSharedServices();
					}}
				/>
			)}
		</div>
	);
}

// Sub-component for Service Card to cleaner code
function ServiceCard({ 
	service, 
	isShared, 
	sharedBy, 
	onClick, 
	onDelete, 
	isDeleting 
}: { 
	service: SupportService, 
	isShared: boolean, 
	sharedBy?: string, 
	onClick: () => void, 
	onDelete: () => void, 
	isDeleting?: boolean 
}) {
	const getStatusColor = (status?: string | null) => {
		switch (status) {
			case "verified": return "bg-serene-green-100 text-serene-green-700 border-serene-green-200";
			case "rejected": return "bg-red-100 text-red-700 border-red-200";
			case "under_review": return "bg-sauti-yellow-light text-sauti-yellow border-sauti-yellow/20";
			case "suspended": return "bg-gray-100 text-gray-700 border-gray-200";
			default: return "bg-serene-neutral-100 text-serene-neutral-600 border-serene-neutral-200";
		}
	};

	const formatDate = (dateString?: string | null) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
	};

	const getDocumentCount = (service: SupportService) => {
		return safelyParseJsonArray(service.accreditation_files_metadata).length;
	};

	return (
		<div
			className="group bg-white rounded-2xl border border-serene-neutral-200 hover:border-sauti-teal/30 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative"
			onClick={onClick}
		>
			{service.verification_status === "suspended" && (
				<div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
					<Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 font-semibold px-3 py-1">
						Suspended
					</Badge>
				</div>
			)}
			<div className="p-4 bg-gradient-to-r from-serene-neutral-50 to-white border-b border-serene-neutral-100">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0">
						<div className={`p-2 rounded-xl transition-colors ${isShared ? 'bg-blue-50 text-blue-600' : 'bg-sauti-teal/10 text-sauti-teal group-hover:bg-sauti-teal/20'}`}>
							{isShared ? <Share2 className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
						</div>
						<div className="min-w-0">
							<h3 className="font-semibold text-serene-neutral-900 truncate group-hover:text-sauti-teal transition-colors">
								{service.name}
							</h3>
							<p className="text-xs text-serene-neutral-500 capitalize">
								{service.service_types.replace("_", " ")}
							</p>
						</div>
					</div>
					<Badge className={`text-xs font-medium ${getStatusColor(service.verification_status)}`}>
						{service.verification_status === "verified" && <CheckCircle className="h-3 w-3 mr-1" />}
						{service.verification_status === "under_review" && <Clock className="h-3 w-3 mr-1" />}
						{service.verification_status || "Pending"}
					</Badge>
				</div>
			</div>

			<div className="p-4 space-y-3">
				{isShared && sharedBy && (
					<p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
						Shared by {sharedBy}
					</p>
				)}

				<div className="space-y-2">
					{service.email && (
						<div className="flex items-center gap-2 text-sm text-serene-neutral-600">
							<Mail className="h-3.5 w-3.5 text-serene-neutral-400" />
							<span className="truncate">{service.email}</span>
						</div>
					)}
					{service.phone_number && (
						<div className="flex items-center gap-2 text-sm text-serene-neutral-600">
							<Phone className="h-3.5 w-3.5 text-serene-neutral-400" />
							<span>{service.phone_number}</span>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between pt-3 border-t border-serene-neutral-100">
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-1.5 text-xs text-serene-neutral-500">
							<FileText className="h-3.5 w-3.5" />
							<span>{getDocumentCount(service)} docs</span>
						</div>
						<span className="text-serene-neutral-300">•</span>
						<span className="text-xs text-serene-neutral-500">
							{formatDate(service.created_at)}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								onClick();
							}}
							className="h-8 w-8 p-0 text-serene-neutral-400 hover:text-sauti-teal hover:bg-sauti-teal/10 rounded-lg"
						>
							<Eye className="h-4 w-4" />
						</Button>
						{!isShared && (
							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
								disabled={isDeleting}
								className="h-8 w-8 p-0 text-serene-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
							>
								{isDeleting ? (
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
								) : (
									<Trash2 className="h-4 w-4" />
								)}
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
