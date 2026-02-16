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
	User,
	Shield,
	Ban,
	CheckCircle,
	XCircle,
	Mail,
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
import { useToast } from "@/hooks/use-toast";
import { User as UserType } from "@/types/admin-types"; // Ensure this type exists and matches

export function ProfessionalsTable() {
	const [users, setUsers] = useState<UserType[]>([]);
	const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [isProcessing, setIsProcessing] = useState(false);

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadProfessionals();
	}, []);

	useEffect(() => {
		filterUsers();
	}, [users, searchTerm, statusFilter]);

	const loadProfessionals = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("user_type", "professional")
				.order("created_at", { ascending: false });

			if (error) throw error;
			setUsers(data as any as UserType[]);
		} catch (error) {
			console.error("Error loading professionals:", error);
			toast({
				title: "Error",
				description: "Failed to load professionals",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const filterUsers = () => {
		let filtered = users;

		if (searchTerm) {
			filtered = filtered.filter(
				(user) =>
					(user.first_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
					(user.last_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
					(user.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
			);
		}

		if (statusFilter !== "all") {
			filtered = filtered.filter((user) => {
                if (statusFilter === 'banned') return user.is_banned;
                if (statusFilter === 'verified') return user.verification_status === 'verified';
                if (statusFilter === 'pending') return user.verification_status === 'pending' || user.verification_status === 'under_review';
                return true;
            });
		}

		setFilteredUsers(filtered);
	};

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

            // Log action
            await supabase.from("admin_actions").insert({
				admin_id: currentUser.id,
				action_type: ban ? "ban_user" : "unban_user",
				target_type: "user",
				target_id: userId,
				details: { action: ban ? "banned" : "unbanned" },
			});

			toast({
				title: "Success",
				description: `Professional ${ban ? "banned" : "unbanned"} successfully`,
			});
			loadProfessionals();
		} catch (error) {
			console.error("Error updating ban status:", error);
			toast({
				title: "Error",
				description: "Failed to update ban status",
				variant: "destructive",
			});
		} finally {
			setIsProcessing(false);
		}
	};

    const getVerificationBadge = (status: string | null) => {
        switch(status) {
            case 'verified': return <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 shadow-sm">Verified</Badge>;
            case 'pending': return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 shadow-sm">Pending</Badge>;
            case 'under_review': return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm">Reviewing</Badge>;
            case 'rejected': return <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shadow-sm">Rejected</Badge>;
            default: return <Badge variant="outline" className="text-serene-neutral-500 border-serene-neutral-200">Unverified</Badge>;
        }
    };

	if (isLoading) {
		return <div className="p-8 text-center">Loading professionals...</div>;
	}

	return (
		<Card className="border-serene-neutral-200/60 shadow-sm rounded-2xl overflow-hidden">
			<CardHeader className="bg-white border-b border-serene-neutral-100">
				<CardTitle className="text-xl font-bold text-serene-neutral-900">Professionals Directory</CardTitle>
				<CardDescription className="text-serene-neutral-500">
					Manage verified professionals and their account status
				</CardDescription>
			</CardHeader>
			<CardContent className="p-6 space-y-6">
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search professionals..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 rounded-full bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-full sm:w-40 rounded-full border-serene-neutral-200">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="verified">Verified</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="banned">Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="border border-serene-neutral-200 rounded-xl overflow-hidden">
					<Table>
						<TableHeader className="bg-serene-neutral-50/80 backdrop-blur-sm">
							<TableRow className="hover:bg-transparent border-b border-serene-neutral-200">
								<TableHead className="font-bold text-serene-neutral-600 pl-6">Professional</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Contact</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Verification</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Joined</TableHead>
								<TableHead className="text-right font-bold text-serene-neutral-600 pr-6">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredUsers.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-serene-blue-50 flex items-center justify-center text-serene-blue-600 font-semibold border border-serene-blue-100 shadow-sm">
                                                {user.first_name?.[0] || "U"}
                                            </div>
											<div>
												<div className="font-semibold text-serene-neutral-900">
													{user.first_name} {user.last_name}
												</div>
                                                {user.is_banned && <Badge variant="destructive" className="mt-1 text-[10px] py-0 px-1.5 h-4">Banned</Badge>}
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex flex-col text-sm text-gray-500">
                                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
										</div>
									</TableCell>
									<TableCell>
										{getVerificationBadge(user.verification_status)}
									</TableCell>
									<TableCell className="text-sm text-gray-500">
										{new Date(user.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuItem onClick={() => {}}>
                                                    View Profile
                                                </DropdownMenuItem>
												<DropdownMenuSeparator />
												{user.is_banned ? (
													<DropdownMenuItem
														onClick={() => handleBanUser(user.id, false)}
														className="text-green-600"
													>
														<CheckCircle className="mr-2 h-4 w-4" />
														Unban User
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														onClick={() => handleBanUser(user.id, true)}
														className="text-red-600"
													>
														<Ban className="mr-2 h-4 w-4" />
														Ban User
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
                
                {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-neutral-500">
                        No professionals found matching your filters.
                    </div>
                )}
			</CardContent>
		</Card>
	);
}
