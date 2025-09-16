"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	UserCheck,
	Building2,
	CheckCircle,
	XCircle,
	Eye,
	Clock,
	FileText,
	MapPin,
	Phone,
	Mail,
	X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PendingUser, PendingService } from "@/types/admin-types";

interface VerificationQueueProps {
	onRefresh: () => void;
}

export function VerificationQueue({ onRefresh }: VerificationQueueProps) {
	const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
	const [pendingServices, setPendingServices] = useState<PendingService[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
	const [selectedService, setSelectedService] = useState<PendingService | null>(
		null
	);
	const [verificationNotes, setVerificationNotes] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	const loadPendingVerifications = useCallback(async () => {
		try {
			setIsLoading(true);

			// Load pending users
			const { data: users, error: usersError } = await supabase
				.from("profiles")
				.select(
					`
          id, first_name, last_name, user_type, verification_status, verification_notes,
          accreditation_files_metadata, created_at, verification_updated_at
        `
				)
				.in("user_type", ["professional", "ngo"])
				.in("verification_status", ["pending", "under_review"])
				.order("verification_updated_at", { ascending: false });

			if (usersError) throw usersError;

			// Load pending services
			const { data: services, error: servicesError } = await supabase
				.from("support_services")
				.select(
					`
          id, name, service_types, verification_status, verification_notes,
          accreditation_files_metadata, created_at, verification_updated_at,
          latitude, longitude, coverage_area_radius
        `
				)
				.in("verification_status", ["pending", "under_review"])
				.order("verification_updated_at", { ascending: false });

			if (servicesError) throw servicesError;

			setPendingUsers(users || []);
			setPendingServices(services || []);
		} catch (error) {
			console.error("Error loading pending verifications:", error);
			toast({
				title: "Error",
				description: "Failed to load pending verifications",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [supabase, toast]);

	useEffect(() => {
		loadPendingVerifications();
	}, [loadPendingVerifications]);

	const handleVerification = async (
		type: "user" | "service",
		id: string,
		action: "verify" | "reject"
	) => {
		try {
			setIsProcessing(true);

			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Not authenticated");

			const verificationStatus = action === "verify" ? "verified" : "rejected";
			const table = type === "user" ? "profiles" : "support_services";

			// Update verification status
			const { error: updateError } = await supabase
				.from(table)
				.update({
					verification_status: verificationStatus,
					verification_notes: verificationNotes,
					verification_updated_at: new Date().toISOString(),
					...(action === "verify" &&
						type === "user" && {
							verified_by: user.id,
							verified_at: new Date().toISOString(),
						}),
					...(action === "verify" &&
						type === "service" && {
							verified_by: user.id,
							verified_at: new Date().toISOString(),
							is_active: true,
						}),
				})
				.eq("id", id);

			if (updateError) throw updateError;

			// Log admin action
			const { error: logError } = await supabase.from("admin_actions").insert({
				admin_id: user.id,
				action_type: action === "verify" ? "verify_user" : "reject_user",
				target_type: type,
				target_id: id,
				details: {
					verification_notes: verificationNotes,
					previous_status:
						type === "user"
							? selectedUser?.verification_status
							: selectedService?.verification_status,
					new_status: verificationStatus,
				},
			});

			if (logError) console.error("Error logging admin action:", logError);

			toast({
				title: "Success",
				description: `${type === "user" ? "User" : "Service"} ${
					action === "verify" ? "verified" : "rejected"
				} successfully`,
			});

			// Reset state
			setSelectedUser(null);
			setSelectedService(null);
			setVerificationNotes("");

			// Refresh data
			onRefresh();
			loadPendingVerifications();
		} catch (error) {
			console.error("Error processing verification:", error);
			toast({
				title: "Error",
				description: `Failed to ${action} ${type}`,
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
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="h-8 bg-gray-200 rounded animate-pulse" />
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">Verification Queue</h2>
					<p className="text-gray-600">
						Review and verify pending user and service applications
					</p>
				</div>
				<Badge variant="outline" className="text-orange-600 border-orange-200">
					<Clock className="h-4 w-4 mr-1" />
					{pendingUsers.length + pendingServices.length} Pending
				</Badge>
			</div>

			<Tabs defaultValue="users" className="space-y-4">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="users" className="flex items-center gap-2">
						<UserCheck className="h-4 w-4" />
						Users ({pendingUsers.length})
					</TabsTrigger>
					<TabsTrigger value="services" className="flex items-center gap-2">
						<Building2 className="h-4 w-4" />
						Services ({pendingServices.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="users" className="space-y-4">
					{pendingUsers.length === 0 ? (
						<Card>
							<CardContent className="text-center py-8">
								<CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									All Caught Up!
								</h3>
								<p className="text-gray-500">
									No pending user verifications at the moment.
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{pendingUsers.map((user) => (
								<Card key={user.id} className="hover:shadow-md transition-shadow">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<CardTitle className="text-lg">
												{user.first_name} {user.last_name}
											</CardTitle>
											<Badge className={getStatusColor(user.verification_status)}>
												{user.verification_status.replace("_", " ")}
											</Badge>
										</div>
										<CardDescription className="capitalize">
											{user.user_type}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="text-sm text-gray-600">
											<p>Submitted: {formatDate(user.created_at)}</p>
											<p>Last Updated: {formatDate(user.verification_updated_at)}</p>
										</div>

										{user.accreditation_files_metadata && (
											<div className="flex items-center gap-2 text-sm text-gray-600">
												<FileText className="h-4 w-4" />
												{Array.isArray(user.accreditation_files_metadata)
													? user.accreditation_files_metadata.length
													: 0}{" "}
												documents
											</div>
										)}

										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setSelectedUser(user)}
												className="flex-1"
											>
												<Eye className="h-4 w-4 mr-1" />
												Review
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="services" className="space-y-4">
					{pendingServices.length === 0 ? (
						<Card>
							<CardContent className="text-center py-8">
								<CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									All Caught Up!
								</h3>
								<p className="text-gray-500">
									No pending service verifications at the moment.
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{pendingServices.map((service) => (
								<Card key={service.id} className="hover:shadow-md transition-shadow">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<CardTitle className="text-lg">{service.name}</CardTitle>
											<Badge className={getStatusColor(service.verification_status)}>
												{service.verification_status.replace("_", " ")}
											</Badge>
										</div>
										<CardDescription className="capitalize">
											{service.service_types}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="text-sm text-gray-600">
											<p>Submitted: {formatDate(service.created_at)}</p>
											<p>Last Updated: {formatDate(service.verification_updated_at)}</p>
										</div>

										{service.latitude && service.longitude && (
											<div className="flex items-center gap-2 text-sm text-gray-600">
												<MapPin className="h-4 w-4" />
												{service.coverage_area_radius
													? `${service.coverage_area_radius}km radius`
													: "Location set"}
											</div>
										)}

										{service.accreditation_files_metadata && (
											<div className="flex items-center gap-2 text-sm text-gray-600">
												<FileText className="h-4 w-4" />
												{Array.isArray(service.accreditation_files_metadata)
													? service.accreditation_files_metadata.length
													: 0}{" "}
												documents
											</div>
										)}

										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setSelectedService(service)}
												className="flex-1"
											>
												<Eye className="h-4 w-4 mr-1" />
												Review
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* User Review Modal */}
			{selectedUser && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								Review User: {selectedUser.first_name} {selectedUser.last_name}
								<Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
									<X className="h-4 w-4" />
								</Button>
							</CardTitle>
							<CardDescription className="capitalize">
								{selectedUser.user_type}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<label className="font-medium text-gray-600">Status</label>
									<Badge className={getStatusColor(selectedUser.verification_status)}>
										{selectedUser.verification_status.replace("_", " ")}
									</Badge>
								</div>
								<div>
									<label className="font-medium text-gray-600">Submitted</label>
									<p>{formatDate(selectedUser.created_at)}</p>
								</div>
							</div>

							{selectedUser.verification_notes && (
								<div>
									<label className="font-medium text-gray-600">Current Notes</label>
									<p className="text-sm bg-gray-50 p-2 rounded">
										{selectedUser.verification_notes}
									</p>
								</div>
							)}

							<div>
								<label className="font-medium text-gray-600">Verification Notes</label>
								<textarea
									value={verificationNotes}
									onChange={(e) => setVerificationNotes(e.target.value)}
									placeholder="Add notes about this verification decision..."
									className="w-full mt-1 p-2 border rounded-md resize-none"
									rows={3}
								/>
							</div>

							<div className="flex gap-2 pt-4">
								<Button
									onClick={() => handleVerification("user", selectedUser.id, "verify")}
									disabled={isProcessing}
									className="flex-1 bg-green-600 hover:bg-green-700"
								>
									<CheckCircle className="h-4 w-4 mr-1" />
									Verify
								</Button>
								<Button
									onClick={() => handleVerification("user", selectedUser.id, "reject")}
									disabled={isProcessing}
									variant="destructive"
									className="flex-1"
								>
									<XCircle className="h-4 w-4 mr-1" />
									Reject
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Service Review Modal */}
			{selectedService && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								Review Service: {selectedService.name}
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSelectedService(null)}
								>
									<X className="h-4 w-4" />
								</Button>
							</CardTitle>
							<CardDescription className="capitalize">
								{selectedService.service_types}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<label className="font-medium text-gray-600">Status</label>
									<Badge className={getStatusColor(selectedService.verification_status)}>
										{selectedService.verification_status.replace("_", " ")}
									</Badge>
								</div>
								<div>
									<label className="font-medium text-gray-600">Submitted</label>
									<p>{formatDate(selectedService.created_at)}</p>
								</div>
							</div>

							{selectedService.latitude && selectedService.longitude && (
								<div>
									<label className="font-medium text-gray-600">Location</label>
									<p className="text-sm">
										{selectedService.latitude}, {selectedService.longitude}
										{selectedService.coverage_area_radius &&
											` (${selectedService.coverage_area_radius}km radius)`}
									</p>
								</div>
							)}

							{selectedService.verification_notes && (
								<div>
									<label className="font-medium text-gray-600">Current Notes</label>
									<p className="text-sm bg-gray-50 p-2 rounded">
										{selectedService.verification_notes}
									</p>
								</div>
							)}

							<div>
								<label className="font-medium text-gray-600">Verification Notes</label>
								<textarea
									value={verificationNotes}
									onChange={(e) => setVerificationNotes(e.target.value)}
									placeholder="Add notes about this verification decision..."
									className="w-full mt-1 p-2 border rounded-md resize-none"
									rows={3}
								/>
							</div>

							<div className="flex gap-2 pt-4">
								<Button
									onClick={() =>
										handleVerification("service", selectedService.id, "verify")
									}
									disabled={isProcessing}
									className="flex-1 bg-green-600 hover:bg-green-700"
								>
									<CheckCircle className="h-4 w-4 mr-1" />
									Verify
								</Button>
								<Button
									onClick={() =>
										handleVerification("service", selectedService.id, "reject")
									}
									disabled={isProcessing}
									variant="destructive"
									className="flex-1"
								>
									<XCircle className="h-4 w-4 mr-1" />
									Reject
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
