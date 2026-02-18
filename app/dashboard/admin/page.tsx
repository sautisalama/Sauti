"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
	Shield,
	ShieldAlert,
    Building2,
    Users,
    BookOpen,
} from "lucide-react";
import { 
    SereneWelcomeHeader, 
    SereneQuickActionCard,
    SereneSectionHeader
} from "../_components/SurvivorDashboardComponents";
import { AdminActivitySection } from "./_components/AdminActivitySection";

import { Database } from "@/types/db-schema";

export default function AdminDashboard() {
	const [stats, setStats] = useState<{
        pendingVerifications: number;
        activeServices: number;
        serviceGrowth: { value: string; trend: 'up' | 'down' | 'neutral' };
        totalServiceProviders: number;
        serviceProviderGrowth: { value: string; trend: 'up' | 'down' | 'neutral' };
        blogGrowth: { value: string; trend: 'up' | 'down' | 'neutral' };
        unreadMessages: number;
    } | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
    const [adminProfile, setAdminProfile] = useState<any>(null);
	const supabase = createClient();
    
	useEffect(() => {
		checkAdminStatus();
		loadQuickStats();
	}, []);

	const checkAdminStatus = async () => {
		try {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;

			const { data: profile } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.single();

			setIsAdmin(profile?.is_admin || false);
            setAdminProfile(profile);
		} catch (error) {
			console.error("Error checking admin status:", error);
		}
	};

    const calculateGrowth = async (table: keyof Database['public']['Tables'], filter?: any): Promise<{ value: string; trend: 'up' | 'down' | 'neutral' }> => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString();

        // Current Total
        let currentQuery = supabase.from(table).select("*", { count: 'exact', head: true });
        if (filter) {
            Object.entries(filter).forEach(([key, value]) => {
                if (Array.isArray(value)) { 
                    currentQuery = currentQuery.in(key, value); 
                } else {
                    currentQuery = currentQuery.eq(key, value);
                }
            });
        }
        const { count: currentTotal } = await currentQuery;

        // Count 30 Days Ago (Total at that time)
        // Which is basically: Count of all items where created_at <= 30 days ago
        let prevQuery = supabase.from(table).select("*", { count: 'exact', head: true }).lte('created_at', dateStr);
        if (filter) {
             Object.entries(filter).forEach(([key, value]) => {
                if (Array.isArray(value)) { 
                    prevQuery = prevQuery.in(key, value); 
                } else {
                    prevQuery = prevQuery.eq(key, value);
                }
            });
        }
        const { count: prevTotal } = await prevQuery;

        const current = currentTotal || 0;
        const prev = prevTotal || 0;

        if (prev === 0) {
            return { value: current > 0 ? "+100%" : "0%", trend: 'neutral' as const }; // If baseline is 0
        }

        const growth = ((current - prev) / prev) * 100;
        return {
            value: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`,
            trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'neutral' as const
        };
    };

	const loadQuickStats = async () => {
		try {
            // Pending Verifications (Queue) - Count unique USERS who require verification
            // 1. Get IDs of professionals/NGOs with pending status
            const { data: pendingProfiles } = await supabase
                .from("profiles")
                .select("id")
                .in("user_type", ["professional", "ngo"])
                .in("verification_status", ["pending", "under_review"]);

            // 2. Get User IDs of services with pending status
            const { data: pendingServices } = await supabase
                .from("support_services")
                .select("user_id")
                .in("verification_status", ["pending", "under_review"]);
            
            // 3. Combine and get unique user count
            const uniqueUserIds = new Set([
                ...(pendingProfiles?.map(p => p.id) || []),
                ...(pendingServices?.map(s => s.user_id).filter(Boolean) || []) // Filter out null user_ids if any
            ]);
            
            const totalPending = uniqueUserIds.size;


            // Services
            const { count: serviceCount } = await supabase
                .from("support_services")
                .select("*", { count: 'exact', head: true })
                .eq("verification_status", "verified");
            const serviceGrowth = await calculateGrowth("support_services", { verification_status: "verified" });

            // Service Providers
            const { count: spCount } = await supabase
                .from("profiles")
                .select("*", { count: 'exact', head: true })
                .in("user_type", ["professional", "ngo"]);
            const serviceProviderGrowth = await calculateGrowth("profiles", { user_type: ["professional", "ngo"] });

            // Blogs
            const blogGrowth = await calculateGrowth("blogs");

            // Mock unread messages
            const unreadMessages = 0; 

			setStats({
                pendingVerifications: totalPending,
                activeServices: serviceCount || 0,
                serviceGrowth,
                totalServiceProviders: spCount || 0,
                serviceProviderGrowth: serviceProviderGrowth,
                blogGrowth,
                unreadMessages
            });
		} catch (error) {
			console.error("Error loading admin stats:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (!isAdmin && !isLoading) {
		return (
			<div className="max-w-4xl mx-auto p-4 md:p-8">
				<div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
                    <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
					    <ShieldAlert className="h-8 w-8" />
                    </div>
					<h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
					<p className="text-red-700">
						You don't have admin privileges to access this dashboard.
					</p>
				</div>
			</div>
		);
	}

    const getTimeOfDay = (): "morning" | "afternoon" | "evening" => {
		const hour = new Date().getHours();
		if (hour < 12) return "morning";
		if (hour < 18) return "afternoon";
		return "evening";
	};

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 pb-20">
            {/* Welcome Header */}
            <SereneWelcomeHeader 
                name={adminProfile?.first_name || "Admin"}
                timeOfDay={getTimeOfDay()}
                welcomeMessage="Here's what needs your attention today."
            />

            {/* Activity Feed */}
            <AdminActivitySection />

            {/* Quick Action Grid */}
            <div>
                <SereneSectionHeader title="Management Console" description="Quick access to core administrative functions" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     <SereneQuickActionCard 
                        title="Verifications"
                        description={stats ? `${stats.pendingVerifications} Pending` : "Manage queue"}
                        icon={<Shield className="h-6 w-6 text-sauti-red" />}
                        href="/dashboard/admin/review"
                        variant="custom"
                        className="bg-sauti-red-light border-sauti-red/10 shadow-sm hover:shadow-md transition-all"
                        badge={stats?.pendingVerifications || undefined}
                        badgeClassName="bg-sauti-red text-white"
                     />
                     <SereneQuickActionCard 
                        title="Services"
                        description={stats ? `${stats.activeServices} Active` : "Manage Directory"}
                        icon={<Building2 className="h-6 w-6 text-sauti-yellow" />}
                        href="/dashboard/admin/services"
                        variant="custom"
                        className="bg-sauti-yellow-light border-sauti-yellow/10 shadow-sm hover:shadow-md transition-all"
                        stats={stats?.serviceGrowth}
                     />
                     <SereneQuickActionCard 
                        title="Service Providers"
                        description={stats ? `${stats.totalServiceProviders} Registered` : "Userbase"}
                        icon={<Users className="h-6 w-6 text-sauti-teal" />}
                        href="/dashboard/admin/professionals"
                        variant="custom"
                        className="bg-sauti-teal-light border-sauti-teal/10 shadow-sm hover:shadow-md transition-all"
                        stats={stats?.serviceProviderGrowth}
                     />
                     <SereneQuickActionCard 
                        title="Content"
                        description="Blogs & Events"
                        icon={<BookOpen className="h-5 w-5" />}
                        href="/dashboard/admin/blogs"
                        variant="neutral"
                        stats={stats?.blogGrowth}
                     />
                </div>
            </div>
		</div>
	);
}
