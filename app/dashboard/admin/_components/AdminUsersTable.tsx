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
	Filter,
	MoreHorizontal,
	Ban,
	UserCheck,
	UserX,
	Eye,
	Shield,
	Building2,
	User,
	ChevronLeft,
	ChevronRight,
	CheckCircle,
	XCircle
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
import { User as AdminUser } from "@/types/admin-types";
import { cn } from "@/lib/utils";

interface AdminUsersTableProps {
	onRefresh: () => void;
}

export function AdminUsersTable({ onRefresh }: AdminUsersTableProps) {
	const router = useRouter();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [banFilter, setBanFilter] = useState("all");
	const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
    
    // Ban Dialog State
    const [banDialog, setBanDialog] = useState<{ isOpen: boolean; userId: string; userName: string; isBanned: boolean }>({
        isOpen: false,
        userId: '',
        userName: '',
        isBanned: false
    });
	
	// Pagination
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadUsers();
	}, []);

	useEffect(() => {
		filterUsers();
		setCurrentPage(1);
	}, [users, searchTerm, roleFilter, statusFilter, banFilter]);

	const loadUsers = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("profiles")
				.select(
					`
          id, first_name, last_name, user_type, verification_status, is_banned,
          created_at, verification_updated_at, verification_notes, email
        `
				)
				.in("user_type", ["professional", "ngo", "survivor"])
				.order("created_at", { ascending: false });

			if (error) throw error;
			setUsers(data as any as AdminUser[]);
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
				`${user.first_name} ${user.last_name} ${user.email || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
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
	
	// Pagination Logic
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

	const handleBanUser = async (userId: string, ban: boolean) => {
		try {
			setIsProcessing(true);
			const {
				data: { user: currentUser },
			} = await supabase.auth.getUser();
			if (!currentUser) throw new Error("Not authenticated");

			const { error } = await supabase
				.from("profiles")
				.update({
					is_banned: ban,
					banned_at: ban ? new Date().toISOString() : null,
					banned_by: ban ? currentUser.id : null,
					ban_reason: ban ? "Banned by admin" : null,
				})
				.eq("id", userId);

			if (error) throw error;

			// Log admin action
			await supabase.from("admin_actions").insert({
				admin_id: currentUser.id,
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
    
    const getVerificationBadge = (status: string) => {
        switch(status) {
            case 'verified': return <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 shadow-sm rounded-full px-3 py-0.5">Verified</Badge>;
            case 'pending': return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 shadow-sm rounded-full px-3 py-0.5">Pending</Badge>;
            case 'under_review': return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm rounded-full px-3 py-0.5">Reviewing</Badge>;
            case 'rejected': return <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shadow-sm rounded-full px-3 py-0.5">Rejected</Badge>;
            default: return <Badge variant="outline" className="text-serene-neutral-500 border-serene-neutral-200 rounded-full px-3 py-0.5">Unverified</Badge>;
        }
    };

	const getRoleIcon = (userType: string) => {
		switch (userType) {
			case "professional":
				return <User className="h-4 w-4" />;
			case "ngo":
				return <Building2 className="h-4 w-4" />;
			case "survivor":
				return <Shield className="h-4 w-4" />;
			default:
				return <User className="h-4 w-4" />;
		}
	};

	const handleViewUser = (userId: string) => {
		router.push(`/dashboard/admin/review/${userId}`);
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
						<div key={i} className="h-16 bg-white rounded-2xl border border-serene-neutral-100 shadow-sm animate-pulse" />
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
					<h2 className="text-2xl font-bold text-serene-neutral-900 tracking-tight">Users Management</h2>
					<p className="text-serene-neutral-500 text-sm mt-1">Manage all user accounts and roles</p>
				</div>
				<div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end md:items-center">
					<div className="relative w-full sm:w-auto flex-1 md:flex-none">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search users..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 h-10 w-full md:w-[240px] rounded-xl bg-white border-serene-neutral-200 focus:border-serene-blue-300 focus:ring-4 focus:ring-serene-blue-100 transition-all shadow-sm"
						/>
					</div>

					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className="h-10 w-full sm:w-[130px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
							<SelectValue placeholder="Role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Roles</SelectItem>
							<SelectItem value="professional">Service Provider</SelectItem>
							<SelectItem value="ngo">Organisation</SelectItem>
							<SelectItem value="survivor">Survivor</SelectItem>
						</SelectContent>
					</Select>

					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="h-10 w-full sm:w-[130px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
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
						<SelectTrigger className="h-10 w-full sm:w-[130px] rounded-xl bg-white border-serene-neutral-200 shadow-sm">
							<SelectValue placeholder="Ban Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Users</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="banned">Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Users Table */}
			<Card className="border-none shadow-card rounded-[2rem] overflow-hidden bg-white">
				<CardContent className="p-0">
                    <div className="hidden md:block">
					    <Table>
						    <TableHeader className="bg-serene-neutral-50/50">
							    <TableRow className="hover:bg-transparent border-b border-serene-neutral-100">
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pl-8">User</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Role</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Status</TableHead>
								    <TableHead className="font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5">Joined</TableHead>
								    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-serene-neutral-500 py-5 pr-8">Actions</TableHead>
							    </TableRow>
						    </TableHeader>
						    <TableBody className="divide-y divide-serene-neutral-50">
							    {paginatedUsers.length > 0 ? (
								    paginatedUsers.map((user) => (
									    <TableRow 
                                            key={user.id} 
                                            className="group hover:bg-serene-blue-50/30 transition-colors border-none cursor-pointer"
                                            onClick={() => handleViewUser(user.id)}
                                        >
										    <TableCell className="py-4 pl-8">
											    <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-serene-neutral-50 flex items-center justify-center text-serene-neutral-500 border border-serene-neutral-100 shadow-sm group-hover:border-serene-blue-200 group-hover:text-serene-blue-600 transition-colors">
												        {getRoleIcon(user.user_type)}
                                                    </div>
												    <div>
													    <div className="font-semibold text-serene-neutral-900 group-hover:text-serene-blue-700 transition-colors">{user.first_name} {user.last_name}</div>
													    {user.is_banned && (
														    <Badge variant="destructive" className="mt-1 text-[10px] h-4 py-0 px-1.5 inline-flex">
															    Banned
														    </Badge>
													    )}
												    </div>
											    </div>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge variant="outline" className="capitalize text-serene-neutral-600 border-serene-neutral-200 font-medium bg-white">
												    {user.user_type === 'professional' ? 'Service Provider' : user.user_type === 'ngo' ? 'Organisation' : user.user_type}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4">
											    <Badge className={getStatusColor(user.verification_status)}>
												    {user.verification_status.replace("_", " ")}
											    </Badge>
										    </TableCell>
										    <TableCell className="py-4 text-sm text-serene-neutral-500">
											    {new Date(user.created_at).toLocaleDateString()}
										    </TableCell>
										    <TableCell className="text-right py-4 pr-8">
											    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
												    <Button
													    variant="ghost"
													    size="sm"
													    onClick={() => handleViewUser(user.id)}
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
                                                            <DropdownMenuItem onClick={() => handleViewUser(user.id)} className="rounded-lg cursor-pointer">
                                                                <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-serene-neutral-50" />
                                                            <DropdownMenuItem 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBanDialog({
                                                                        isOpen: true,
                                                                        userId: user.id,
                                                                        userName: `${user.first_name} ${user.last_name}`,
                                                                        isBanned: user.is_banned
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "rounded-lg cursor-pointer", 
                                                                    user.is_banned ? "text-green-600 focus:text-green-700 focus:bg-green-50" : "text-red-600 focus:text-red-700 focus:bg-red-50"
                                                                )}
                                                                disabled={isProcessing}
                                                            >
                                                                {user.is_banned ? (
                                                                    <>
                                                                        <UserCheck className="mr-2 h-3.5 w-3.5" />
                                                                        Unban User
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserX className="mr-2 h-3.5 w-3.5" />
                                                                        Ban User
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
                                        <TableCell colSpan={5} className="h-[600px] text-center text-serene-neutral-400">
                                            No users found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {/* Spacer Rows */}
                                {paginatedUsers.length > 0 && paginatedUsers.length < itemsPerPage && (
                                    Array.from({ length: itemsPerPage - paginatedUsers.length }).map((_, idx) => (
                                        <TableRow key={`spacer-${idx}`} className="hover:bg-transparent pointer-events-none border-none">
                                            <TableCell colSpan={5} className="py-4 h-[73px]"></TableCell>
                                        </TableRow>
                                    ))
                                )}
						    </TableBody>
					    </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-serene-neutral-50">
                        {paginatedUsers.length > 0 ? (
                            paginatedUsers.map((user) => (
                                <div 
                                    key={user.id} 
                                    className="p-4 bg-white hover:bg-serene-neutral-50/50 transition-colors cursor-pointer"
                                    onClick={() => handleViewUser(user.id)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-serene-neutral-50 flex items-center justify-center text-serene-neutral-500 border border-serene-neutral-100 shadow-sm">
                                                {getRoleIcon(user.user_type)}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-serene-neutral-900">{user.first_name} {user.last_name}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-serene-neutral-500 mt-0.5">
                                                    <Badge variant="outline" className="capitalize text-[10px] h-4 px-1 py-0 font-normal">
                                                        {user.user_type === 'professional' ? 'Service Provider' : user.user_type === 'ngo' ? 'Organisation' : user.user_type}
                                                    </Badge>
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
                                                <DropdownMenuItem onClick={() => handleViewUser(user.id)} className="rounded-lg">
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBanDialog({
                                                            isOpen: true,
                                                            userId: user.id,
                                                            userName: `${user.first_name} ${user.last_name}`,
                                                            isBanned: user.is_banned
                                                        });
                                                    }}
                                                    className={cn("rounded-lg", user.is_banned ? "text-green-600" : "text-red-600")}
                                                >
                                                    {user.is_banned ? "Unban User" : "Ban User"}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-serene-neutral-50 text-xs text-serene-neutral-500">
                                        <div className="flex items-center gap-2">
                                            {getVerificationBadge(user.verification_status)}
                                            {user.is_banned && <Badge variant="destructive" className="h-4 px-1 text-[9px]">Banned</Badge>}
                                        </div>
                                        <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-serene-neutral-400">
                                No users found.
                            </div>
                        )}
                    </div>
				</CardContent>

                {/* Footer Pagination */}
                <div className="bg-serene-neutral-50/50 border-t border-serene-neutral-100 p-4 flex items-center justify-between">
                    <div className="text-xs text-serene-neutral-500 font-medium">
                        Showing <span className="text-serene-neutral-900 font-semibold">{paginatedUsers.length > 0 ? startIndex + 1 : 0}</span> to <span className="text-serene-neutral-900 font-semibold">{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</span> of <span className="text-serene-neutral-900 font-semibold">{filteredUsers.length}</span> results
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
                            {banDialog.isBanned ? <UserCheck className="w-8 h-8" /> : <Ban className="w-8 h-8" />}
                        </div>
                        
                        <DialogTitle className="text-2xl font-bold text-center text-gray-900">
                            {banDialog.isBanned ? 'Unban User' : 'Suspend User'}
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-gray-500 mt-2 text-base">
                            Are you sure you want to {banDialog.isBanned ? 'unban' : 'suspend'} <span className="font-semibold text-gray-900">{banDialog.userName}</span>?
                            <br />
                            <span className="text-sm mt-2 block">
                                {banDialog.isBanned 
                                    ? "This will restore the user's access to the platform." 
                                    : "This will prevent the user from accessing the platform. They will not be able to log in."}
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
                                handleBanUser(banDialog.userId, !banDialog.isBanned);
                                setBanDialog(prev => ({ ...prev, isOpen: false }));
                            }}
                            className={cn(
                                "flex-1 rounded-xl h-12 text-white font-semibold shadow-lg transition-all hover:scale-[1.02]",
                                banDialog.isBanned ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                            )}
                        >
                            {banDialog.isBanned ? 'Unban User' : 'Suspend User'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
		</div>
	);
}
