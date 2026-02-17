"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
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
	ChevronLeft,
	ChevronRight,
	MoreHorizontal
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Service, VerificationStatus } from "@/types/admin-types";
import { cn } from "@/lib/utils";

interface AdminServicesTableProps {
	onRefresh: () => void;
}

export function AdminServicesTable({ onRefresh }: AdminServicesTableProps) {
	const router = useRouter();
	const [services, setServices] = useState<Service[]>([]);
	const [filteredServices, setFilteredServices] = useState<Service[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [banFilter, setBanFilter] = useState("all");
	const [isProcessing, setIsProcessing] = useState(false);
    
    // Ban Dialog State
    const [banDialog, setBanDialog] = useState<{ isOpen: boolean; serviceId: string; serviceName: string; isBanned: boolean }>({
        isOpen: false,
        serviceId: '',
        serviceName: '',
        isBanned: false
    });
	
	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

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
		setCurrentPage(1);
	}, [services, searchTerm, typeFilter, statusFilter, banFilter]);

	const loadServices = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("support_services")
				.select("*, profiles:profiles!support_services_user_id_fkey(*)")
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Supabase error fetching services:", error);
				throw error;
			}

			if (!data) {
				setServices([]);
				return;
			}

			const servicesWithProfile: Service[] =
				data.map((service: any) => ({
					...service,
					// Map DB fields to Admin Type
					phone: service.phone_number,
					email: service.email,
					accreditation_files_metadata:
						service.accreditation_files_metadata || [],
					verification_status: service.verification_status as VerificationStatus,
					profile_name: service.profiles
						? `${service.profiles.first_name} ${service.profiles.last_name}`
						: "Unknown",
					// Pass the single profile object for ReportView
					profiles: service.profiles
						? {
								first_name: service.profiles.first_name,
								last_name: service.profiles.last_name,
								verification_status: service.profiles
									.verification_status as VerificationStatus,
						  }
						: undefined,
				}));

			setServices(servicesWithProfile);
		} catch (error: any) {
			console.error("Error loading services:", JSON.stringify(error, null, 2));
			toast({
				title: "Error",
				description:
					error.message || "Failed to load services. Please try again.",
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
	
	// Pagination Logic
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedServices = filteredServices.slice(startIndex, startIndex + itemsPerPage);

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
				return "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 shadow-sm rounded-full px-3 py-0.5";
			case "under_review":
				return "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm rounded-full px-3 py-0.5";
			case "verified":
				return "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 shadow-sm rounded-full px-3 py-0.5";
			case "rejected":
				return "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shadow-sm rounded-full px-3 py-0.5";
			default:
				return "bg-serene-neutral-100 text-serene-neutral-700 border-serene-neutral-200 rounded-full px-3 py-0.5";
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

    const getVerificationBadge = (status: string) => {
		switch (status) {
			case "verified":
				return (
					<Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 shadow-sm rounded-full px-3 py-0.5">
						Verified
					</Badge>
				);
			case "pending":
				return (
					<Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 shadow-sm rounded-full px-3 py-0.5">
						Pending
					</Badge>
				);
			case "under_review":
				return (
					<Badge className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm rounded-full px-3 py-0.5">
						Reviewing
					</Badge>
				);
			case "rejected":
				return (
					<Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shadow-sm rounded-full px-3 py-0.5">
						Rejected
					</Badge>
				);
			default:
				return (
					<Badge
						variant="outline"
						className="text-serene-neutral-500 border-serene-neutral-200 rounded-full px-3 py-0.5"
					>
						Unverified
					</Badge>
				);
		}
	};

	const handleViewService = (serviceId: string) => {
		router.push(`/dashboard/admin/services/${serviceId}`);
	};

	if (isLoading) {
		return (
			<Card className="border-none shadow-none bg-transparent">
				<CardHeader className="px-0">
					<div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
					<div className="h-4 w-96 bg-gray-100 rounded animate-pulse mt-2" />
				</CardHeader>
				<CardContent className="px-0 space-y-4">
					{[...Array(5)].map((_, i) => (
						<div key={i} className="h-20 bg-white rounded-2xl border border-serene-neutral-100 shadow-sm animate-pulse" />
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
            {/* Header & Filters */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-serene-neutral-900 tracking-tight">Services Directory</h2>
					<p className="text-serene-neutral-500 text-sm mt-1">Monitor support services and coverage</p>
				</div>
                
				<div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end md:items-center">
					<div className="relative w-full sm:w-auto flex-1 md:flex-none">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search services..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 h-10 w-full md:w-[240px] rounded-xl bg-white border-serene-neutral-200 focus:border-serene-blue-300 focus:ring-4 focus:ring-serene-blue-100 transition-all shadow-sm"
						/>
					</div>

					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="h-10 w-full sm:w-[140px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
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
						<SelectTrigger className="h-10 w-full sm:w-[140px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
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
				</div>
            </div>

			{/* Services Table */}
			<Card className="border-none shadow-card rounded-[2rem] overflow-hidden bg-white">
				<CardContent className="p-0">
                    <div className="hidden md:block">
					    <Table>
						    <TableHeader className="bg-serene-neutral-50/50">
							    <TableRow className="hover:bg-transparent border-b border-serene-neutral-100">
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pl-8">Service</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Provider</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Type</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Status</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Location</TableHead>
								    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pr-8">Actions</TableHead>
							    </TableRow>
						    </TableHeader>
						    <TableBody className="divide-y divide-serene-neutral-50">
							    {paginatedServices.length > 0 ? (
								    paginatedServices.map((service) => (
									    <TableRow 
                                            key={service.id}
                                            className="group hover:bg-serene-blue-50/30 transition-colors border-none cursor-pointer"
                                            onClick={() => handleViewService(service.id)}
                                        >
										    <TableCell className="py-4 pl-8">
											    <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-serene-neutral-50 flex items-center justify-center text-serene-neutral-500 border border-serene-neutral-100 shadow-sm group-hover:border-serene-blue-200 group-hover:text-serene-blue-600 transition-colors">
												        <Building2 className="h-5 w-5" />
                                                    </div>
												    <div>
													    <div className="font-semibold text-serene-neutral-900 group-hover:text-serene-blue-700 transition-colors">{service.name}</div>
													    <div className="flex gap-1 mt-1">
														    {service.is_banned && (
															    <Badge variant="destructive" className="text-[10px] h-4 py-0 px-1.5">
																    Banned
															    </Badge>
														    )}
														    {!service.is_active && !service.is_banned && (
															    <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1.5 bg-serene-neutral-100 text-serene-neutral-500">
																    Inactive
															    </Badge>
														    )}
													    </div>
												    </div>
											    </div>
										    </TableCell>
										    <TableCell className="py-4">
											    <div className="text-sm font-medium text-serene-neutral-600">
												    {service.profile_name || "Unknown"}
											    </div>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge variant="outline" className="capitalize text-serene-neutral-600 border-serene-neutral-200 font-medium">
												    {service.service_types.replace("_", " ")}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge className={getStatusColor(service.verification_status)}>
												    {service.verification_status.replace("_", " ")}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4">
											    {service.latitude && service.longitude ? (
												    <div className="flex items-center gap-1.5 text-sm text-serene-neutral-500">
													    <MapPin className="h-3.5 w-3.5 opacity-70" />
													    <span>
														    {service.coverage_area_radius
															    ? `${(service.coverage_area_radius / 1000).toFixed(0)}km`
															    : "Set"}
													    </span>
												    </div>
											    ) : (
												    <span className="text-sm text-serene-neutral-400 italic">Not set</span>
											    )}
										    </TableCell>
										    <TableCell className="text-right py-4 pr-8">
											    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
												    <Button
													    variant="ghost"
													    size="sm"
													    onClick={() => handleViewService(service.id)}
                                                        className="text-serene-neutral-400 hover:text-serene-blue-600 hover:bg-serene-blue-50 rounded-lg px-2"
												    >
													    View
												    </Button>
                                                
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-serene-neutral-600 rounded-full">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-serene-neutral-100 p-1">
                                                            <DropdownMenuItem onClick={() => handleViewService(service.id)} className="rounded-lg cursor-pointer">
                                                                <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-serene-neutral-50" />
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBanDialog({
                                                                        isOpen: true,
                                                                        serviceId: service.id,
                                                                        serviceName: service.name,
                                                                        isBanned: service.is_banned
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "cursor-pointer text-xs rounded-lg",
                                                                    service.is_banned ? "text-green-600 focus:text-green-700 focus:bg-green-50" : "text-red-600 focus:text-red-700 focus:bg-red-50"
                                                                )}
                                                                disabled={isProcessing}
                                                            >
                                                                {service.is_banned ? (
                                                                    <>
                                                                        <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                                                        Unban Service
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Ban className="mr-2 h-3.5 w-3.5" />
                                                                        Ban Service
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
											    </div>
										    </TableCell>
									    </TableRow>
								    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-[600px] text-center text-serene-neutral-400">
                                            No services found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {/* Spacer Rows to keep pagination at bottom */}
                                {paginatedServices.length > 0 && paginatedServices.length < itemsPerPage && (
                                    Array.from({ length: itemsPerPage - paginatedServices.length }).map((_, idx) => (
                                        <TableRow key={`spacer-${idx}`} className="hover:bg-transparent pointer-events-none border-none">
                                            <TableCell colSpan={6} className="py-4 h-[73px]"></TableCell>
                                        </TableRow>
                                    ))
                                )}
						    </TableBody>
					    </Table>
				    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-serene-neutral-50">
                        {paginatedServices.length > 0 ? (
                            paginatedServices.map((service) => (
                                <div 
                                    key={service.id} 
                                    className="p-4 bg-white hover:bg-serene-neutral-50/50 transition-colors cursor-pointer"
                                    onClick={() => handleViewService(service.id)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-serene-neutral-50 flex items-center justify-center text-serene-neutral-500 border border-serene-neutral-100 shadow-sm">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-serene-neutral-900 line-clamp-1">{service.name}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-serene-neutral-500 mt-0.5">
                                                    <span className="font-medium">{service.profile_name || "Unknown Provider"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 text-serene-neutral-400" onClick={(e) => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-serene-neutral-100 p-1">
                                                <DropdownMenuItem onClick={() => handleViewService(service.id)} className="rounded-lg">
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBanDialog({
                                                            isOpen: true,
                                                            serviceId: service.id,
                                                            serviceName: service.name,
                                                            isBanned: service.is_banned
                                                        });
                                                    }}
                                                    className={cn("rounded-lg", service.is_banned ? "text-green-600" : "text-red-600")}
                                                >
                                                    {service.is_banned ? "Unban Service" : "Ban Service"}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    {/* ... rest of mobile view content ... */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="outline" className="capitalize text-[10px] h-5 px-1.5 border-serene-neutral-200 text-serene-neutral-500">
                                            {service.service_types.replace("_", " ")}
                                        </Badge>
                                        {getVerificationBadge(service.verification_status)}
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-serene-neutral-50 text-xs text-serene-neutral-500">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 opacity-70" />
                                            <span>
                                                {service.coverage_area_radius 
                                                    ? `${(service.coverage_area_radius / 1000).toFixed(0)}km radius` 
                                                    : "Location set"}
                                            </span>
                                        </div>
                                        <span>{new Date(service.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-center text-serene-neutral-400">
                                        <div className="bg-sauti-blue/10 h-20 w-20 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-sauti-blue/20">
                                            <Building2 className="h-10 w-10 text-sauti-blue" />
                                        </div>
                                        <h3 className="text-lg font-bold text-sauti-teal mb-1">
                                            No services found
                                        </h3>
                                        <p className="text-sm text-serene-neutral-500 max-w-sm mx-auto mb-6">
                                            No services match your current filters. Try adjusting your search keywords or filters.
                                        </p>
                                        <Button 
                                            variant="outline" 
                                            onClick={() => {
                                                setSearchTerm("");
                                                setTypeFilter("all");
                                                setStatusFilter("all");
                                                setBanFilter("all");
                                            }}
                                            className="border-serene-neutral-200 text-serene-neutral-600 hover:text-sauti-dark hover:bg-serene-neutral-50"
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                )}
                    </div>
                </CardContent>

                {/* Footer Pagination */}
                <div className="bg-serene-neutral-50/50 border-t border-serene-neutral-100 p-4 flex items-center justify-between">
                    <div className="text-xs text-serene-neutral-500 font-medium">
                        Showing <span className="text-serene-neutral-900 font-semibold">{paginatedServices.length > 0 ? startIndex + 1 : 0}</span> to <span className="text-serene-neutral-900 font-semibold">{Math.min(startIndex + itemsPerPage, filteredServices.length)}</span> of <span className="text-serene-neutral-900 font-semibold">{filteredServices.length}</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 rounded-lg border-serene-neutral-200 hover:bg-white hover:text-serene-blue-600 disabled:opacity-50"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-medium text-serene-neutral-600 min-w-[3rem] text-center">
                            Page {currentPage} of {totalPages || 1}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0 rounded-lg border-serene-neutral-200 hover:bg-white hover:text-serene-blue-600 disabled:opacity-50"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
			</Card>

            {/* Custom Ban Dialog */}
            <Dialog open={banDialog.isOpen} onOpenChange={(open) => setBanDialog(prev => ({ ...prev, isOpen: open }))}>
                <DialogContent className="rounded-3xl max-w-md overflow-hidden p-0 border-0 bg-white shadow-2xl">
                    <div className="p-8 pb-0">
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto transition-colors",
                            banDialog.isBanned ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                        )}>
                            {banDialog.isBanned ? <CheckCircle className="w-8 h-8" /> : <Ban className="w-8 h-8" />}
                        </div>
                        
                        <DialogTitle className="text-2xl font-bold text-center text-gray-900">
                            {banDialog.isBanned ? 'Unban Service' : 'Suspend Service'}
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-gray-500 mt-2 text-base">
                            Are you sure you want to {banDialog.isBanned ? 'unban' : 'suspend'} <span className="font-semibold text-gray-900">{banDialog.serviceName}</span>?
                            <br />
                            <span className="text-sm mt-2 block">
                                {banDialog.isBanned 
                                    ? "This will restore the service's visibility on the platform." 
                                    : "This will remove the service from public listings."}
                            </span>
                        </DialogDescription>
                    </div>

                    <div className="p-6 bg-gray-50 flex gap-3 mt-6">
                        <Button 
                            variant="outline" 
                            onClick={() => setBanDialog(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 rounded-xl h-12 border-gray-200 hover:bg-white hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => {
                                handleBanService(banDialog.serviceId, !banDialog.isBanned);
                                setBanDialog(prev => ({ ...prev, isOpen: false }));
                            }}
                            className={cn(
                                "flex-1 rounded-xl h-12 text-white font-semibold shadow-lg transition-all hover:scale-[1.02]",
                                banDialog.isBanned ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                            )}
                        >
                            {banDialog.isBanned ? 'Unban Service' : 'Suspend Service'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

		</div>
	);
}
