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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	MapPin,
	Building2,
	Filter,
	RefreshCw,
	Eye,
	EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CoverageData } from "@/types/admin-types";

interface CoverageMapProps {}

export function CoverageMap({}: CoverageMapProps) {
	const [coverageData, setCoverageData] = useState<CoverageData[]>([]);
	const [filteredData, setFilteredData] = useState<CoverageData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [showInactive, setShowInactive] = useState(false);
	const [mapCenter, setMapCenter] = useState({ lat: -1.2921, lng: 36.8219 }); // Nairobi center

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadCoverageData();
	}, []);

	useEffect(() => {
		filterCoverageData();
	}, [coverageData, typeFilter, statusFilter, showInactive]);

	const loadCoverageData = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase.rpc("get_coverage_map_data");

			if (error) throw error;
			setCoverageData(data || []);
		} catch (error) {
			console.error("Error loading coverage data:", error);
			toast({
				title: "Error",
				description: "Failed to load coverage map data",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const filterCoverageData = () => {
		let filtered = coverageData;

		// Type filter
		if (typeFilter !== "all") {
			filtered = filtered.filter((service) => service.service_type === typeFilter);
		}

		// Status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter(
				(service) => service.verification_status === statusFilter
			);
		}

		// Active filter
		if (!showInactive) {
			filtered = filtered.filter((service) => service.is_active);
		}

		setFilteredData(filtered);
	};

	const getServiceTypes = () => {
		const types = new Set(coverageData.map((service) => service.service_type));
		return Array.from(types).sort();
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "verified":
				return "bg-green-100 text-green-800";
			case "pending":
				return "bg-yellow-100 text-yellow-800";
			case "under_review":
				return "bg-blue-100 text-blue-800";
			case "rejected":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getTypeColor = (type: string) => {
		const colors = {
			counseling: "bg-purple-100 text-purple-800",
			legal_aid: "bg-blue-100 text-blue-800",
			medical: "bg-green-100 text-green-800",
			shelter: "bg-orange-100 text-orange-800",
			emergency: "bg-red-100 text-red-800",
			other: "bg-gray-100 text-gray-800",
		};
		return colors[type as keyof typeof colors] || colors.other;
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Service Coverage Map</CardTitle>
					<CardDescription>Loading coverage data...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="h-96 bg-gray-200 rounded animate-pulse flex items-center justify-center">
						<div className="text-center">
							<MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
							<p className="text-gray-500">Loading map data...</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Service Coverage Map</CardTitle>
						<CardDescription>
							Visualize service coverage areas and locations across the platform
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={loadCoverageData}
						className="gap-2"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-4">
					<Select value={typeFilter} onValueChange={setTypeFilter}>
						<SelectTrigger className="w-full sm:w-48">
							<SelectValue placeholder="Service Type" />
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
						<SelectTrigger className="w-full sm:w-48">
							<SelectValue placeholder="Verification Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="verified">Verified</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="under_review">Under Review</SelectItem>
							<SelectItem value="rejected">Rejected</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant={showInactive ? "default" : "outline"}
						size="sm"
						onClick={() => setShowInactive(!showInactive)}
						className="gap-2"
					>
						{showInactive ? (
							<Eye className="h-4 w-4" />
						) : (
							<EyeOff className="h-4 w-4" />
						)}
						{showInactive ? "Show All" : "Hide Inactive"}
					</Button>
				</div>

				{/* Map Placeholder */}
				<div className="h-96 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
					<div className="text-center">
						<MapPin className="h-16 w-16 mx-auto text-gray-400 mb-4" />
						<h3 className="text-lg font-medium text-gray-900 mb-2">
							Interactive Map
						</h3>
						<p className="text-gray-500 mb-4">
							Map visualization will be implemented with a mapping library like Leaflet
							or Mapbox
						</p>
						<div className="text-sm text-gray-400">
							{filteredData.length} services found
						</div>
					</div>
				</div>

				{/* Service List */}
				<div className="space-y-2">
					<h4 className="font-medium text-gray-900">Services in View</h4>
					<div className="max-h-64 overflow-y-auto space-y-2">
						{filteredData.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								<Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
								<p>No services found matching your criteria.</p>
							</div>
						) : (
							filteredData.map((service) => (
								<div
									key={service.service_id}
									className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
								>
									<div className="flex items-center gap-3">
										<div className="h-2 w-2 rounded-full bg-green-500" />
										<div>
											<div className="font-medium text-sm">{service.name}</div>
											<div className="text-xs text-gray-500">
												{service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Badge className={getTypeColor(service.service_type)}>
											{service.service_type.replace("_", " ")}
										</Badge>
										<Badge className={getStatusColor(service.verification_status)}>
											{service.verification_status.replace("_", " ")}
										</Badge>
										<div className="text-xs text-gray-500">
											{service.coverage_area_radius}km
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				{/* Statistics */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
					<div className="text-center">
						<div className="text-2xl font-bold text-gray-900">
							{filteredData.length}
						</div>
						<div className="text-sm text-gray-500">Total Services</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-green-600">
							{filteredData.filter((s) => s.verification_status === "verified").length}
						</div>
						<div className="text-sm text-gray-500">Verified</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-yellow-600">
							{filteredData.filter((s) => s.verification_status === "pending").length}
						</div>
						<div className="text-sm text-gray-500">Pending</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-blue-600">
							{new Set(filteredData.map((s) => s.service_type)).size}
						</div>
						<div className="text-sm text-gray-500">Service Types</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
