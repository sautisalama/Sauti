"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
	Globe,
	FileText,
	Sparkles,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { SupportServiceSidepanel } from "./support-services-sidepanel";

import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

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
	const [selectedService, setSelectedService] = useState<SupportService | null>(
		null
	);
	const [showAddForm, setShowAddForm] = useState(false);
	const [isDeleting, setIsDeleting] = useState<string | null>(null);
	const supabase = createClient();
	const { toast } = useToast();

	// Use data from dashboard provider
	const services = dash?.data?.supportServices || [];
	const isLoading = !dash?.data?.preloaded;

	// Check if user can add more services
	const canAddService = () => {
		if (userType === "professional") {
			return services.length < 2;
		}
		if (userType === "ngo") {
			return true; // NGOs can add multiple services
		}
		return false;
	};

	// Data is loaded by dashboard provider - no need for additional loading

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

			// Notify parent component that data has been updated
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

	const getStatusColor = (status?: string | null) => {
		switch (status) {
			case "verified":
				return "bg-serene-green-100 text-serene-green-700 border-serene-green-200";
			case "rejected":
				return "bg-red-100 text-red-700 border-red-200";
			case "under_review":
				return "bg-sauti-yellow-light text-sauti-yellow border-sauti-yellow/20";
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
		if (!service.accreditation_files_metadata) return 0;
		const docs = Array.isArray(service.accreditation_files_metadata)
			? service.accreditation_files_metadata
			: JSON.parse(service.accreditation_files_metadata);
		return docs.length;
	};

	return (
		<div className="space-y-4">
			{/* Unified Status & Action Card */}
			<div className="bg-white rounded-2xl border border-serene-neutral-200 p-5 shadow-sm">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-start gap-4">
						<div className={`p-3 rounded-xl flex-shrink-0 ${
							verificationStatus === 'verified' ? 'bg-serene-green-50 text-serene-green-600' :
							verificationStatus === 'under_review' ? 'bg-amber-50 text-amber-600' :
							verificationStatus === 'rejected' ? 'bg-red-50 text-red-600' :
							'bg-serene-blue-50 text-serene-blue-600'
						}`}>
							{verificationStatus === 'verified' ? <CheckCircle className="h-6 w-6" /> :
							 verificationStatus === 'under_review' ? <Clock className="h-6 w-6" /> :
							 verificationStatus === 'rejected' ? <AlertCircle className="h-6 w-6" /> :
							 <Briefcase className="h-6 w-6" />}
						</div>
						<div>
							<div className="flex items-center gap-2 mb-1">
								<h3 className="font-bold text-lg text-serene-neutral-900">
									My Support Services
								</h3>
								<Badge variant="outline" className={`capitalize ${getStatusColor(verificationStatus)}`}>
									{verificationStatus?.replace('_', ' ') || 'Pending'}
								</Badge>
							</div>
							<p className="text-sm text-serene-neutral-500 max-w-lg">
								{verificationStatus === 'verified' 
									? "Your services are live and visible to survivors."
									: verificationStatus === 'under_review'
									? "Your profile is currently under review by our team."
									: verificationStatus === 'rejected'
									? "Action required: Please update your verification documents."
									: "Manage your services and verification status here."}
							</p>
						</div>
					</div>
					
					{/* Add Service Button logic moved to grid/dotted card */}
				</div>
			</div>

			{/* Service List / Loading / Empty States */}
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
			) : services.length === 0 ? (
				<div className="text-center py-12 bg-white rounded-2xl border border-dashed border-serene-neutral-300">
					<div className="p-4 bg-serene-neutral-50 rounded-full inline-block mb-4">
						<Briefcase className="h-8 w-8 text-serene-neutral-400" />
					</div>
					<h3 className="text-lg font-semibold text-serene-neutral-900 mb-2">No Services Yet</h3>
					<p className="text-serene-neutral-500 max-w-md mx-auto mb-6">
						Add a service to start connecting with survivors. Validating your service helps build trust on the platform.
					</p>
					{canAddService() && (
						<Button onClick={() => setShowAddForm(true)} variant="outline" className="gap-2">
							<Plus className="h-4 w-4" /> Add Your First Service
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{services.map((service) => (
						<div
							key={service.id}
							className="group bg-white rounded-2xl border border-serene-neutral-200 hover:border-sauti-teal/30 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden relative"
							onClick={() => setSelectedService(service)}
						>
							{service.verification_status === "suspended" && (
								<div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
									<Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 font-semibold px-3 py-1">
										Suspended
									</Badge>
								</div>
							)}
							<div className="p-4 bg-gradient-to-r from-serene-neutral-50 to-white border-b border-serene-neutral-100">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3 min-w-0">
										<div className="p-2 rounded-xl bg-sauti-teal/10 group-hover:bg-sauti-teal/20 transition-colors">
											<Briefcase className="h-5 w-5 text-sauti-teal" />
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
												setSelectedService(service);
											}}
											className="h-8 w-8 p-0 text-serene-neutral-400 hover:text-sauti-teal hover:bg-sauti-teal/10 rounded-lg"
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
											className="h-8 w-8 p-0 text-serene-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
										>
											{isDeleting === service.id ? (
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
											) : (
												<Trash2 className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							</div>
						</div>
					))}
					
					{/* Dotted "Add Service" Card */}
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
									
									// If we have a new service ID, open it immediately for document upload
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
							// Also notify parent component
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
					onClose={() => setSelectedService(null)}
					onUpdate={onDataUpdate}
				/>
			)}
		</div>
	);
}
