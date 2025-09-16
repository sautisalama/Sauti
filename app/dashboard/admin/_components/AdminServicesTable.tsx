"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Search,
	Building2,
	MapPin,
	Eye,
	Ban,
	CheckCircle,
	XCircle,
	Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Service } from "@/types/admin-types";

interface AdminServicesTableProps {
	onRefresh: () => void;
}

export function AdminServicesTable({ onRefresh }: AdminServicesTableProps) {
	const [services, setServices] = useState<Service[]>([]);
	const [filteredServices, setFilteredServices] = useState<Service[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [banFilter, setBanFilter] = useState("all");
	const [selectedService, setSelectedService] = useState<Service | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadServices();
	}, []);

	useEffect(() => {
		filterServices();
	}, [services, searchTerm, typeFilter, statusFilter, banFilter]);

	const loadServices = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("support_services")
				.select(
					`
          id, name, service_types, verification_status, is_active, is_banned,
          created_at, verification_updated_at, verification_notes,
          latitude, longitude, coverage_area_radius, profile_id,
          profiles!inner(first_name, last_name)
        `
				)
				.order("created_at", { ascending: false });

			if (error) throw error;

			const servicesWithProfile =
				data?.map((service) => ({
					...service,
					profile_name: service.profiles
						? `${service.profiles[0]?.first_name} ${service.profiles[0]?.last_name}`
						: "Unknown",
				})) || [];

			setServices(servicesWithProfile);
		} catch (error) {
			console.error("Error loading services:", error);
			toast({
				title: "Error",
				description: "Failed to load services",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const filterServices = () => {
		let filtered = services;

		// Search filter
		if (searchTerm) {
			filtered = filtered.filter(
				(service) =>
					service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					service.profile_name?.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Type filter
		if (typeFilter !== "all") {
			filtered = filtered.filter(
				(service) => service.service_types === typeFilter
			);
		}

		// Status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter(
				(service) => service.verification_status === statusFilter
			);
		}

		// Ban filter
		if (banFilter !== "all") {
			filtered = filtered.filter((service) =>
				banFilter === "banned" ? service.is_banned : !service.is_banned
			);
		}

		setFilteredServices(filtered);
	};

	const handleBanService = async (serviceId: string, ban: boolean) => {
		try {
			setIsProcessing(true);
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Not authenticated");

			const { error } = await supabase
				.from("support_services")
				.update({
					is_banned: ban,
					banned_at: ban ? new Date().toISOString() : null,
					banned_by: ban ? user.id : null,
					ban_reason: ban ? "Banned by admin" : null,
					is_active: ban ? false : true,
				})
				.eq("id", serviceId);

			if (error) throw error;

			// Log admin action
			await supabase.from("admin_actions").insert({
				admin_id: user.id,
				action_type: ban ? "ban_service" : "unban_service",
				target_type: "service",
				target_id: serviceId,
				details: { action: ban ? "banned" : "unbanned" },
			});

			toast({
				title: "Success",
				description: `Service ${ban ? "banned" : "unbanned"} successfully`,
			});

			onRefresh();
			loadServices();
		} catch (error) {
			console.error("Error updating service ban status:", error);
			toast({
				title: "Error",
				description: `Failed to ${ban ? "ban" : "unban"} service`,
				variant: "destructive",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-yellow-100 text-yellow-800";
			case "under_review":
				return "bg-blue-100 text-blue-800";
			case "verified":
				return "bg-green-100 text-green-800";
			case "rejected":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getServiceTypes = () => {
		const types = new Set(services.map((service) => service.service_types));
		return Array.from(types).sort();
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Services Management</CardTitle>
					<CardDescription>Loading services...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[...Array(5)].map((_, i) => (
							<div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Services Management</CardTitle>
				<CardDescription>
					Manage support services, verification status, and availability
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
						<Input
							placeholder="Search services..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10"
						/>
					</div>

					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="Type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{getServiceTypes().map((type) => (
								<SelectItem key={type} value={type} className="capitalize">
									{type.replace("_", " ")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="under_review">Under Review</SelectItem>
							<SelectItem value="verified">Verified</SelectItem>
							<SelectItem value="rejected">Rejected</SelectItem>
						</SelectContent>
					</Select>

					<Select value={banFilter} onValueChange={setBanFilter}>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="Ban Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Services</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="banned">Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Services Table */}
				<div className="border rounded-lg">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Service</TableHead>
								<TableHead>Provider</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Location</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredServices.map((service) => (
								<TableRow key={service.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<Building2 className="h-4 w-4 text-gray-600" />
											<div>
												<div className="font-medium">{service.name}</div>
												<div className="flex gap-1 mt-1">
													{service.is_banned && (
														<Badge variant="destructive" className="text-xs">
															Banned
														</Badge>
													)}
													{!service.is_active && !service.is_banned && (
														<Badge variant="secondary" className="text-xs">
															Inactive
														</Badge>
													)}
												</div>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="text-sm text-gray-600">
											{service.profile_name || "Unknown"}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="capitalize">
											{service.service_types.replace("_", " ")}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge className={getStatusColor(service.verification_status)}>
											{service.verification_status.replace("_", " ")}
										</Badge>
									</TableCell>
									<TableCell>
										{service.latitude && service.longitude ? (
											<div className="flex items-center gap-1 text-sm text-gray-600">
												<MapPin className="h-3 w-3" />
												<span>
													{service.coverage_area_radius
														? `${service.coverage_area_radius}km`
														: "Set"}
												</span>
											</div>
										) : (
											<span className="text-sm text-gray-400">Not set</span>
										)}
									</TableCell>
									<TableCell className="text-sm text-gray-600">
										{formatDate(service.created_at)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setSelectedService(service)}
											>
												<Eye className="h-4 w-4" />
											</Button>

											{service.is_banned ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleBanService(service.id, false)}
													disabled={isProcessing}
													className="text-green-600 hover:text-green-700"
												>
													<CheckCircle className="h-4 w-4" />
												</Button>
											) : (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleBanService(service.id, true)}
													disabled={isProcessing}
													className="text-red-600 hover:text-red-700"
												>
													<XCircle className="h-4 w-4" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				{filteredServices.length === 0 && (
					<div className="text-center py-8 text-gray-500">
						<Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
						<p>No services found matching your criteria.</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
