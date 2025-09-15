"use client";

import { useEffect, useState, useCallback } from "react";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { fetchUserSupportServices } from "@/app/dashboard/_views/actions/support-services";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { SupportServiceSidepanel } from "../profile/support-services-sidepanel";
import { VerificationProgressBar } from "../profile/verification-progress-bar";
import {
	Building,
	Plus,
	Eye,
	Trash2,
	Shield,
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
} from "lucide-react";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

interface SupportService {
	id: string;
	name: string;
	service_types: SupportServiceType;
	email?: string;
	phone_number?: string;
	website?: string;
	availability?: string;
	verification_status?: string;
	verification_notes?: string;
	last_verification_check?: string;
	accreditation_files_metadata?: any;
	created_at?: string;
}

export default function ServicesClient({ userId }: { userId: string }) {
	const [services, setServices] = useState<SupportService[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedService, setSelectedService] = useState<SupportService | null>(
		null
	);
	const [showAddForm, setShowAddForm] = useState(false);
	const [isDeleting, setIsDeleting] = useState<string | null>(null);
	const [userType, setUserType] = useState<UserType>("professional");
	const [verificationStatus, setVerificationStatus] = useState("pending");
	const [hasAccreditation, setHasAccreditation] = useState(false);
	const [hasMatches, setHasMatches] = useState(false);
	const [verificationNotes, setVerificationNotes] = useState<
		string | undefined
	>();
	const [documentsCount, setDocumentsCount] = useState(0);

	const supabase = createClient();
	const { toast } = useToast();

	// Check if user can add more services
	const canAddService = () => {
		if (userType === "professional") {
			return services.length === 0;
		}
		if (userType === "ngo") {
			return true; // NGOs can add multiple services
		}
		return false;
	};

	const loadServices = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data, error } = await supabase
				.from("support_services")
				.select("*")
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (error) throw error;
			setServices(data || []);
		} catch (error) {
			console.error("Error loading services:", error);
			toast({
				title: "Error",
				description: "Failed to load support services",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [userId, supabase, toast]);

	const loadUserProfile = useCallback(async () => {
		try {
			const { data: profile } = await supabase
				.from("profiles")
				.select(
					"user_type, verification_status, verification_notes, accreditation_files_metadata"
				)
				.eq("id", userId)
				.single();

			if (profile) {
				setUserType(profile.user_type || "professional");
				setVerificationStatus(profile.verification_status || "pending");
				setVerificationNotes(profile.verification_notes);

				// Check if user has accreditation files
				const docs = profile.accreditation_files_metadata
					? Array.isArray(profile.accreditation_files_metadata)
						? profile.accreditation_files_metadata
						: JSON.parse(profile.accreditation_files_metadata)
					: [];
				setHasAccreditation(docs.length > 0);
				setDocumentsCount(docs.length);
			}

			// Check for matches
			const { data: services } = await supabase
				.from("support_services")
				.select("id")
				.eq("user_id", userId);

			if (services && services.length > 0) {
				const serviceIds = services.map((s) => s.id);
				const { data: matches } = await supabase
					.from("matched_services")
					.select("id")
					.in("service_id", serviceIds)
					.limit(1);

				setHasMatches(!!matches && matches.length > 0);
			}
		} catch (error) {
			console.error("Error loading user profile:", error);
		}
	}, [userId, supabase]);

	useEffect(() => {
		loadUserProfile();
		loadServices();
	}, [loadUserProfile, loadServices]);

	const deleteService = async (serviceId: string) => {
		setIsDeleting(serviceId);
		try {
			const { error } = await supabase
				.from("support_services")
				.delete()
				.eq("id", serviceId);

			if (error) throw error;

			setServices((prev) => prev.filter((s) => s.id !== serviceId));
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

	const getStatusIcon = (status?: string) => {
		switch (status) {
			case "verified":
				return <CheckCircle className="h-4 w-4 text-green-600" />;
			case "rejected":
				return <XCircle className="h-4 w-4 text-red-600" />;
			case "under_review":
				return <Clock className="h-4 w-4 text-yellow-600" />;
			default:
				return <AlertCircle className="h-4 w-4 text-gray-600" />;
		}
	};

	const getStatusColor = (status?: string) => {
		switch (status) {
			case "verified":
				return "bg-green-100 text-green-800 border-green-200";
			case "rejected":
				return "bg-red-100 text-red-800 border-red-200";
			case "under_review":
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return "";
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getDocumentCount = (service: SupportService) => {
		if (!service.accreditation_files_metadata) return 0;
		const docs = Array.isArray(service.accreditation_files_metadata)
			? service.accreditation_files_metadata
			: JSON.parse(service.accreditation_files_metadata);
		return docs.length;
	};

	return (
		<div className="space-y-6">
			{/* Verification Progress Bar */}
			<VerificationProgressBar
				hasAccreditation={hasAccreditation}
				hasSupportServices={services.length > 0}
				verificationStatus={verificationStatus}
				hasMatches={hasMatches}
				verificationNotes={verificationNotes}
				documentsCount={documentsCount}
				servicesCount={services.length}
			/>

			{/* Service Limits Alert */}
			{userType === "professional" && services.length > 1 && (
				<Alert className="border-orange-200 bg-orange-50">
					<Shield className="h-4 w-4 text-orange-600 flex-shrink-0" />
					<AlertDescription className="text-orange-800">
						<span className="hidden sm:inline">
							<strong>Important:</strong> As a professional, you can only have one
							support service. Matching will only happen using the first service you
							added. Please delete the other services to avoid confusion.
						</span>
						<span className="sm:hidden">
							<strong>Important:</strong> You can only have one service. Delete others
							to avoid confusion.
						</span>
					</AlertDescription>
				</Alert>
			)}

			{userType === "professional" && services.length === 1 && (
				<Alert className="border-blue-200 bg-blue-50">
					<Shield className="h-4 w-4 text-blue-600 flex-shrink-0" />
					<AlertDescription className="text-blue-800">
						<span className="hidden sm:inline">
							<strong>Service Limit:</strong> As a professional, you can only have one
							support service. To add a different service, you'll need to delete the
							existing one first.
						</span>
						<span className="sm:hidden">
							<strong>Service Limit:</strong> You can only have one service. Delete
							existing to add a different one.
						</span>
					</AlertDescription>
				</Alert>
			)}

			{/* Services List */}
			{isLoading ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card key={i} className="animate-pulse">
							<CardContent className="p-6">
								<div className="h-4 bg-gray-200 rounded mb-2" />
								<div className="h-3 bg-gray-200 rounded mb-4" />
								<div className="h-6 bg-gray-200 rounded w-20" />
							</CardContent>
						</Card>
					))}
				</div>
			) : services.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Building className="h-12 w-12 text-gray-400 mb-4" />
						<h3 className="text-lg font-semibold text-gray-700 mb-2">
							No support services yet
						</h3>
						<p className="text-gray-500 text-center mb-6">
							{userType === "professional"
								? "Add your support service to start helping survivors"
								: "Add support services to expand your organization's reach"}
						</p>
						{canAddService() && (
							<Button onClick={() => setShowAddForm(true)} className="gap-2">
								<Plus className="h-4 w-4" />
								Add Your First Service
							</Button>
						)}
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{/* Add Service Button */}
					{canAddService() && (
						<div className="flex justify-end">
							<Button onClick={() => setShowAddForm(true)} className="gap-2">
								<Plus className="h-4 w-4" />
								Add Service
							</Button>
						</div>
					)}

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{services.map((service) => (
							<Card
								key={service.id}
								className="hover:shadow-md transition-shadow cursor-pointer group"
								onClick={() => setSelectedService(service)}
							>
								<CardContent className="p-6">
									<div className="flex items-start justify-between mb-4">
										<div className="flex items-center gap-2">
											<Building className="h-5 w-5 text-sauti-orange" />
											<h3 className="font-semibold text-gray-900 truncate">
												{service.name}
											</h3>
										</div>
										<Badge className={getStatusColor(service.verification_status)}>
											{service.verification_status || "pending"}
										</Badge>
									</div>

									<div className="space-y-2 mb-4">
										<div className="flex items-center gap-2 text-sm text-gray-600">
											<span className="capitalize">
												{service.service_types.replace("_", " ")}
											</span>
										</div>
										{service.email && (
											<div className="text-sm text-gray-600 truncate">{service.email}</div>
										)}
										{service.phone_number && (
											<div className="text-sm text-gray-600">{service.phone_number}</div>
										)}
										<div className="text-xs text-gray-500">
											Created {formatDate(service.created_at)}
										</div>
									</div>

									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2 text-sm text-gray-600">
											<Shield className="h-4 w-4" />
											<span>{getDocumentCount(service)} documents</span>
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedService(service);
												}}
												className="opacity-0 group-hover:opacity-100 transition-opacity"
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													deleteService(service.id);
												}}
												disabled={isDeleting === service.id}
												className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700"
											>
												{isDeleting === service.id ? (
													<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* Add Service Dialog */}
			<Dialog open={showAddForm} onOpenChange={setShowAddForm}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Add Support Service</DialogTitle>
						<DialogDescription>
							Tell us about your support service. Fill in the details below to register
							your service.
						</DialogDescription>
					</DialogHeader>
					<AddSupportServiceForm
						onSuccess={() => {
							setShowAddForm(false);
							loadServices();
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
					onClose={() => setSelectedService(null)}
					onUpdate={loadServices}
				/>
			)}
		</div>
	);
}
