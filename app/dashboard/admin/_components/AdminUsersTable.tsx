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
	Filter,
	MoreHorizontal,
	Ban,
	UserCheck,
	UserX,
	Eye,
	Shield,
	Building2,
	User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User as AdminUser } from "@/types/admin-types";

interface AdminUsersTableProps {
	onRefresh: () => void;
}

export function AdminUsersTable({ onRefresh }: AdminUsersTableProps) {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [banFilter, setBanFilter] = useState("all");
	const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadUsers();
	}, []);

	useEffect(() => {
		filterUsers();
	}, [users, searchTerm, roleFilter, statusFilter, banFilter]);

	const loadUsers = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("profiles")
				.select(
					`
          id, first_name, last_name, user_type, verification_status, is_banned,
          created_at, verification_updated_at, verification_notes
        `
				)
				.in("user_type", ["professional", "ngo", "survivor"])
				.order("created_at", { ascending: false });

			if (error) throw error;
			setUsers(data || []);
		} catch (error) {
			console.error("Error loading users:", error);
			toast({
				title: "Error",
				description: "Failed to load users",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const filterUsers = () => {
		let filtered = users;

		// Search filter
		if (searchTerm) {
			filtered = filtered.filter((user) =>
				`${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Role filter
		if (roleFilter !== "all") {
			filtered = filtered.filter((user) => user.user_type === roleFilter);
		}

		// Status filter
		if (statusFilter !== "all") {
			filtered = filtered.filter(
				(user) => user.verification_status === statusFilter
			);
		}

		// Ban filter
		if (banFilter !== "all") {
			filtered = filtered.filter((user) =>
				banFilter === "banned" ? user.is_banned : !user.is_banned
			);
		}

		setFilteredUsers(filtered);
	};

	const handleBanUser = async (userId: string, ban: boolean) => {
		try {
			setIsProcessing(true);
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Not authenticated");

			const { error } = await supabase
				.from("profiles")
				.update({
					is_banned: ban,
					banned_at: ban ? new Date().toISOString() : null,
					banned_by: ban ? user.id : null,
					ban_reason: ban ? "Banned by admin" : null,
				})
				.eq("id", userId);

			if (error) throw error;

			// Log admin action
			await supabase.from("admin_actions").insert({
				admin_id: user.id,
				action_type: ban ? "ban_user" : "unban_user",
				target_type: "user",
				target_id: userId,
				details: { action: ban ? "banned" : "unbanned" },
			});

			toast({
				title: "Success",
				description: `User ${ban ? "banned" : "unbanned"} successfully`,
			});

			onRefresh();
			loadUsers();
		} catch (error) {
			console.error("Error updating user ban status:", error);
			toast({
				title: "Error",
				description: `Failed to ${ban ? "ban" : "unban"} user`,
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

	const getRoleIcon = (userType: string) => {
		switch (userType) {
			case "professional":
				return <User className="h-4 w-4" />;
			case "ngo":
				return <Building2 className="h-4 w-4" />;
			case "survivor":
				return <User className="h-4 w-4" />;
			default:
				return <User className="h-4 w-4" />;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Users Management</CardTitle>
					<CardDescription>Loading users...</CardDescription>
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
				<CardTitle>Users Management</CardTitle>
				<CardDescription>
					Manage user accounts, verification status, and access permissions
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
						<Input
							placeholder="Search users..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10"
						/>
					</div>

					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="Role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Roles</SelectItem>
							<SelectItem value="professional">Professional</SelectItem>
							<SelectItem value="ngo">NGO</SelectItem>
							<SelectItem value="survivor">Survivor</SelectItem>
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
							<SelectItem value="all">All Users</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="banned">Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Users Table */}
				<div className="border rounded-lg">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Joined</TableHead>
								<TableHead>Last Updated</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredUsers.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											{getRoleIcon(user.user_type)}
											<div>
												<div className="font-medium">{user.first_name} {user.last_name}</div>
												{user.is_banned && (
													<Badge variant="destructive" className="text-xs">
														Banned
													</Badge>
												)}
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="capitalize">
											{user.user_type}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge className={getStatusColor(user.verification_status)}>
											{user.verification_status.replace("_", " ")}
										</Badge>
									</TableCell>
									<TableCell className="text-sm text-gray-600">
										{formatDate(user.created_at)}
									</TableCell>
									<TableCell className="text-sm text-gray-600">
										{formatDate(user.verification_updated_at)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex items-center justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setSelectedUser(user)}
											>
												<Eye className="h-4 w-4" />
											</Button>

											{user.is_banned ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleBanUser(user.id, false)}
													disabled={isProcessing}
													className="text-green-600 hover:text-green-700"
												>
													<UserCheck className="h-4 w-4" />
												</Button>
											) : (
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleBanUser(user.id, true)}
													disabled={isProcessing}
													className="text-red-600 hover:text-red-700"
												>
													<UserX className="h-4 w-4" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				{filteredUsers.length === 0 && (
					<div className="text-center py-8 text-gray-500">
						<User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
						<p>No users found matching your criteria.</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
