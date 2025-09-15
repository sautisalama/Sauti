"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";
import { SupportServiceSidepanel } from "./support-services-sidepanel";

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

interface SupportServicesManagerProps {
	userId: string;
	userType: UserType;
}

export function SupportServicesManager({
	userId,
	userType,
}: SupportServicesManagerProps) {
	const [services, setServices] = useState<SupportService[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedService, setSelectedService] = useState<SupportService | null>(
		null
	);
	const [showAddForm, setShowAddForm] = useState(false);
	const [isDeleting, setIsDeleting] = useState<string | null>(null);
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

	useEffect(() => {
		loadServices();
	}, [userId]);

	const loadServices = async () => {
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
	};

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
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">Support Services</h2>
					<p className="text-gray-600 mt-1">
						Manage your support services and their documentation
					</p>
				</div>
				{canAddService() && (
					<Dialog open={showAddForm} onOpenChange={setShowAddForm}>
						<DialogTrigger asChild>
							<Button className="gap-2">
								<Plus className="h-4 w-4" />
								Add Service
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>Add Support Service</DialogTitle>
								<DialogDescription>
									Create a new support service for your organization
								</DialogDescription>
							</DialogHeader>
							<AddServiceForm
								userId={userId}
								userType={userType}
								onSuccess={() => {
									setShowAddForm(false);
									loadServices();
								}}
							/>
						</DialogContent>
					</Dialog>
				)}
			</div>

			{/* Service Limits Alert */}
			{userType === "professional" && services.length > 0 && (
				<Alert>
					<Shield className="h-4 w-4" />
					<AlertDescription>
						<strong>Service Limit:</strong> As a professional, you can only have one
						support service. To add a different service, you'll need to delete the
						existing one first.
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
			)}

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

// Add Service Form Component
function AddServiceForm({
	userId,
	userType,
	onSuccess,
}: {
	userId: string;
	userType: UserType;
	onSuccess: () => void;
}) {
	const [formData, setFormData] = useState({
		name: "",
		service_types: "" as SupportServiceType | "",
		email: "",
		phone_number: "",
		website: "",
		availability: "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name || !formData.service_types) return;

		setIsSubmitting(true);
		try {
			const { error } = await supabase.from("support_services").insert([
				{
					name: formData.name,
					service_types: formData.service_types as SupportServiceType,
					email: formData.email || null,
					phone_number: formData.phone_number || null,
					website: formData.website || null,
					availability: formData.availability || null,
					user_id: userId,
				},
			]);

			if (error) throw error;

			toast({
				title: "Success",
				description: "Support service created successfully",
			});
			onSuccess();
		} catch (error) {
			console.error("Error creating service:", error);
			toast({
				title: "Error",
				description: "Failed to create support service",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label className="text-sm font-medium text-gray-700">Service Name *</label>
					<input
						type="text"
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						placeholder="e.g., Mental Health Counseling"
						required
					/>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Service Type *</label>
					<select
						value={formData.service_types}
						onChange={(e) =>
							setFormData({
								...formData,
								service_types: e.target.value as SupportServiceType,
							})
						}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						required
					>
						<option value="">Select service type</option>
						<option value="legal">Legal</option>
						<option value="medical">Medical</option>
						<option value="mental_health">Mental Health</option>
						<option value="shelter">Shelter</option>
						<option value="financial_assistance">Financial Assistance</option>
						<option value="other">Other</option>
					</select>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Email</label>
					<input
						type="email"
						value={formData.email}
						onChange={(e) => setFormData({ ...formData, email: e.target.value })}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						placeholder="service@example.com"
					/>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Phone Number</label>
					<input
						type="tel"
						value={formData.phone_number}
						onChange={(e) =>
							setFormData({ ...formData, phone_number: e.target.value })
						}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						placeholder="+1 (555) 123-4567"
					/>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Website</label>
					<input
						type="url"
						value={formData.website}
						onChange={(e) => setFormData({ ...formData, website: e.target.value })}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						placeholder="https://example.com"
					/>
				</div>

				<div>
					<label className="text-sm font-medium text-gray-700">Availability</label>
					<input
						type="text"
						value={formData.availability}
						onChange={(e) =>
							setFormData({ ...formData, availability: e.target.value })
						}
						className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-sauti-orange/20 focus:border-sauti-orange"
						placeholder="e.g., 24/7, Mon-Fri 9AM-5PM"
					/>
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() =>
						setFormData({
							name: "",
							service_types: "",
							email: "",
							phone_number: "",
							website: "",
							availability: "",
						})
					}
				>
					Reset
				</Button>
				<Button
					type="submit"
					disabled={!formData.name || !formData.service_types || isSubmitting}
					className="gap-2"
				>
					{isSubmitting ? (
						<>
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
							Creating...
						</>
					) : (
						<>
							<Plus className="h-4 w-4" />
							Create Service
						</>
					)}
				</Button>
			</div>
		</form>
	);
}
