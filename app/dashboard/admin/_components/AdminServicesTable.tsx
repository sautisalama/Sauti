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
import { Service, VerificationStatus } from "@/types/admin-types";
import { SupportServiceReportView } from "@/components/admin/SupportServiceReportView";

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

        // Real-time subscription
        const channel = supabase
            .channel('admin-services-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'support_services'
                },
                (payload) => {
                    console.log('Real-time update:', payload);
                    loadServices();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
          phone_number, email, accreditation_files_metadata,
          profiles!inner(first_name, last_name, verification_status)
        `
				)
                .neq('name', '') // Filter out empty names
                .not('name', 'is', null) // Filter out null names
				.order("created_at", { ascending: false });

			if (error) throw error;

			const servicesWithProfile: Service[] =
				data?.map((service) => ({
					...service,
					// Map DB fields to Admin Type
					phone: service.phone_number,
					email: service.email,
					accreditation_files_metadata:
						service.accreditation_files_metadata || [],
					verification_status: service.verification_status as VerificationStatus,
					profile_name: service.profiles
						? `${service.profiles[0]?.first_name} ${service.profiles[0]?.last_name}`
						: "Unknown",
					// Pass the single profile object for ReportView
					profiles:
						service.profiles && service.profiles[0]
							? {
									first_name: service.profiles[0].first_name,
									last_name: service.profiles[0].last_name,
									verification_status: service.profiles[0]
										.verification_status as VerificationStatus,
							  }
							: undefined,
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

    const handleVerifyService = async (serviceId: string, notes: string) => {
		const service = services.find(s => s.id === serviceId);
        
        // Validation: Provider must be verified first
        if (service && service.profiles && (service.profiles as any).verification_status !== 'verified') {
            toast({
                title: "Action Blocked",
                description: "Cannot verify service because the provider's profile is not verified.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsProcessing(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from("support_services")
                .update({
                    verification_status: "verified",
                    verification_notes: notes,
                    verification_updated_at: new Date().toISOString(),
                    admin_verified_by: user.id,
                    admin_verified_at: new Date().toISOString(),
                    is_active: true
                })
                .eq("id", serviceId);

            if (error) throw error;

            // Audit Log
             await supabase.from("admin_actions").insert({
                admin_id: user.id,
                action_type: "verify_service",
                target_type: "service",
                target_id: serviceId,
                details: { notes }
            });

            toast({ title: "Service Verified", description: "Service has been successfully verified." });
            onRefresh();
            loadServices();
            setSelectedService(null);
        } catch (error) {
            console.error("Error verifying service:", error);
            toast({ title: "Error", description: "Failed to verify service", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };


    const handleRejectService = async (serviceId: string, notes: string) => {
         try {
            setIsProcessing(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { error } = await supabase
                .from("support_services")
                .update({
                    verification_status: "rejected",
                    verification_notes: notes,
                    verification_updated_at: new Date().toISOString(),
                    is_active: false
                })
                .eq("id", serviceId);

            if (error) throw error;

            // Audit Log
             await supabase.from("admin_actions").insert({
                admin_id: user.id,
                action_type: "reject_service",
                target_type: "service",
                target_id: serviceId,
                details: { notes }
            });

            toast({ title: "Service Rejected", description: "Service has been rejected." });
            onRefresh();
            loadServices();
            setSelectedService(null);
        } catch (error) {
           console.error("Error rejecting service:", error);
           toast({ title: "Error", description: "Failed to reject service", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

	const getStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-amber-50 text-amber-700 border-amber-200 shadow-sm";
			case "under_review":
				return "bg-blue-50 text-blue-700 border-blue-200 shadow-sm";
			case "verified":
				return "bg-green-50 text-green-700 border-green-200 shadow-sm";
			case "rejected":
				return "bg-red-50 text-red-700 border-red-200 shadow-sm";
			default:
				return "bg-serene-neutral-100 text-serene-neutral-700 border-serene-neutral-200";
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
		<Card className="border-serene-neutral-200/60 shadow-sm rounded-2xl overflow-hidden">
			<CardHeader className="bg-white border-b border-serene-neutral-100">
				<CardTitle className="text-xl font-bold text-serene-neutral-900">Services Management</CardTitle>
				<CardDescription className="text-serene-neutral-500">
					Manage support services, verification status, and availability
				</CardDescription>
			</CardHeader>
			<CardContent className="p-6 space-y-6">
				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search services..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 rounded-full bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
						/>
					</div>

					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="w-full sm:w-40 rounded-full border-serene-neutral-200">
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
						<SelectTrigger className="w-full sm:w-40 rounded-full border-serene-neutral-200">
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
						<SelectTrigger className="w-full sm:w-40 rounded-full border-serene-neutral-200">
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
				<div className="border border-serene-neutral-200 rounded-xl overflow-hidden">
					<Table>
						<TableHeader className="bg-serene-neutral-50/80 backdrop-blur-sm">
							<TableRow className="hover:bg-transparent border-b border-serene-neutral-200">
								<TableHead className="font-bold text-serene-neutral-600 pl-6">Service</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Provider</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Type</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Status</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Location</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Created</TableHead>
								<TableHead className="text-right font-bold text-serene-neutral-600 pr-6">Actions</TableHead>
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
