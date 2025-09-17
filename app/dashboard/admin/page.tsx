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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Users,
	Shield,
	CheckCircle,
	XCircle,
	AlertTriangle,
	MapPin,
	BarChart3,
	UserCheck,
	UserX,
	Building2,
	FileText,
	Eye,
	Ban,
	Check,
	X,
} from "lucide-react";
import { AdminStatsCards } from "./_components/AdminStatsCards";
import { VerificationQueue } from "./_components/VerificationQueue";
import { CoverageMap } from "./_components/CoverageMap";
import { AdminUsersTable } from "./_components/AdminUsersTable";
import { AdminServicesTable } from "./_components/AdminServicesTable";
import { useToast } from "@/hooks/use-toast";
import { AdminStats } from "@/types/admin-types";

export default function AdminDashboard() {
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		checkAdminStatus();
		loadStats();
	}, []);

	const checkAdminStatus = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data: profile } = await supabase
				.from("profiles")
				.select("is_admin")
				.eq("id", user.id)
				.single();

			setIsAdmin(profile?.is_admin || false);
		} catch (error) {
			console.error("Error checking admin status:", error);
		}
	};

	const loadStats = async () => {
		try {
			const { data, error } = await supabase
				.from("admin_dashboard_stats")
				.select("*")
				.single();

			if (error) throw error;
			setStats(data);
		} catch (error) {
			console.error("Error loading admin stats:", error);
			toast({
				title: "Error",
				description: "Failed to load admin statistics",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	if (!isAdmin) {
		return (
			<div className="max-w-4xl mx-auto p-4 md:p-6">
				<Card className="border-red-200 bg-red-50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-red-800">
							<Shield className="h-5 w-5" />
							Access Denied
						</CardTitle>
						<CardDescription className="text-red-600">
							You don't have admin privileges to access this dashboard.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="max-w-7xl mx-auto p-4 md:p-6">
				<div className="space-y-6">
					<div className="h-8 bg-gray-200 rounded animate-pulse" />
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{[...Array(4)].map((_, i) => (
							<div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6">
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
						<p className="text-gray-600 mt-1">
							Manage user verifications, services, and platform statistics
						</p>
					</div>
					<Badge variant="secondary" className="bg-blue-100 text-blue-800">
						<Shield className="h-4 w-4 mr-1" />
						Admin Mode
					</Badge>
				</div>

				{/* Stats Cards */}
				{stats && <AdminStatsCards stats={stats} />}

				{/* Main Content Tabs */}
				<Tabs defaultValue="verification" className="space-y-6">
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="verification" className="flex items-center gap-2">
							<UserCheck className="h-4 w-4" />
							Verification
						</TabsTrigger>
						<TabsTrigger value="users" className="flex items-center gap-2">
							<Users className="h-4 w-4" />
							Users
						</TabsTrigger>
						<TabsTrigger value="services" className="flex items-center gap-2">
							<Building2 className="h-4 w-4" />
							Services
						</TabsTrigger>
						<TabsTrigger value="coverage" className="flex items-center gap-2">
							<MapPin className="h-4 w-4" />
							Coverage
						</TabsTrigger>
						<TabsTrigger value="analytics" className="flex items-center gap-2">
							<BarChart3 className="h-4 w-4" />
							Analytics
						</TabsTrigger>
					</TabsList>

					<TabsContent value="verification" className="space-y-6">
						<VerificationQueue onRefresh={loadStats} />
					</TabsContent>

					<TabsContent value="users" className="space-y-6">
						<AdminUsersTable onRefresh={loadStats} />
					</TabsContent>

					<TabsContent value="services" className="space-y-6">
						<AdminServicesTable onRefresh={loadStats} />
					</TabsContent>

					<TabsContent value="coverage" className="space-y-6">
						<CoverageMap />
					</TabsContent>

					<TabsContent value="analytics" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Platform Analytics</CardTitle>
								<CardDescription>
									Detailed insights into platform usage and performance
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="text-center py-8 text-gray-500">
									<BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
									<p>Analytics dashboard coming soon...</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
