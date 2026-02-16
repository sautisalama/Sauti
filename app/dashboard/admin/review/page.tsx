"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	UserCheck,
	Building2,
	CheckCircle,
	Eye,
	Clock,
	FileText,
	MapPin,
    ArrowRight
} from "lucide-react";
import Link from "next/link";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PendingUser, PendingService } from "@/types/admin-types";
import { formatDistanceToNow } from "date-fns";

export default function ReviewDashboardPage() {
	const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
	const [pendingServices, setPendingServices] = useState<PendingService[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const supabase = createClient();

	useEffect(() => {
		const loadPendingVerifications = async () => {
			try {
				setIsLoading(true);

				// Load pending users
				const { data: users } = await supabase
					.from("profiles")
					.select(
						`id, first_name, last_name, user_type, verification_status, accreditation_files, accreditation_files_metadata, created_at, verification_updated_at`
					)
					.in("user_type", ["professional", "ngo"])
					.in("verification_status", ["pending", "under_review"])
					.order("created_at", { ascending: false });

				// Load pending services
				const { data: services } = await supabase
					.from("support_services")
					.select(
						`id, name, service_types, verification_status, accreditation_files, accreditation_files_metadata, created_at, verification_updated_at, latitude, longitude, coverage_area_radius`
					)
					.in("verification_status", ["pending", "under_review"])
					.order("created_at", { ascending: false });

				setPendingUsers((users || []).filter(u => 
					(Array.isArray(u.accreditation_files_metadata) && u.accreditation_files_metadata.length > 0) ||
					(Array.isArray(u.accreditation_files) && u.accreditation_files.length > 0)
				));
				setPendingServices((services || []).filter(s => 
					(Array.isArray(s.accreditation_files_metadata) && s.accreditation_files_metadata.length > 0) ||
					(Array.isArray(s.accreditation_files) && s.accreditation_files.length > 0)
				));
			} catch (error) {
				console.error("Error loading pending verifications:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadPendingVerifications();
	}, []);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-amber-100 text-amber-800 border-amber-200";
			case "under_review":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "verified":
				return "bg-green-100 text-green-800 border-green-200";
			case "rejected":
				return "bg-red-100 text-red-800 border-red-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	if (isLoading) {
		return <ReviewDashboardSkeleton />;
	}

	return (
		<div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-20">
             <SereneBreadcrumb
				items={[
					{ label: "Admin", href: "/dashboard/admin" },
					{ label: "Review Queue", active: true },
				]}
			/>
            
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 tracking-tight">Review Queue</h1>
					<p className="text-gray-500 mt-1">
						Manage and verify pending applications
					</p>
				</div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm border-gray-200 text-gray-700">
                        {pendingUsers.length} Users
                    </Badge>
                     <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm border-gray-200 text-gray-700">
                        {pendingServices.length} Services
                    </Badge>
                </div>
			</div>

			<Tabs defaultValue="users" className="space-y-6">
				<TabsList className="bg-transparent border-b border-gray-200 w-full justify-start rounded-none h-auto p-0 gap-6">
					<TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 data-[state=active]:text-blue-700 font-medium">
						<UserCheck className="h-4 w-4 mr-2" />
						Professionals & NGOs
					</TabsTrigger>
					<TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 data-[state=active]:text-blue-700 font-medium">
						<Building2 className="h-4 w-4 mr-2" />
						Support Services
					</TabsTrigger>
				</TabsList>

				<TabsContent value="users" className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
					{pendingUsers.length === 0 ? (
						<EmptyState type="users" />
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{pendingUsers.map((user) => (
								<ReviewCard 
                                    key={user.id} 
                                    title={`${user.first_name} ${user.last_name}`}
                                    subtitle={user.user_type}
                                    status={user.verification_status}
                                    date={user.created_at}
                                    docsCount={Array.isArray(user.accreditation_files_metadata) ? user.accreditation_files_metadata.length : 0}
                                    statusColor={getStatusColor(user.verification_status)}
                                    href={`/dashboard/admin/review/${user.id}?type=professional`} 
                                />
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="services" className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
					{pendingServices.length === 0 ? (
						<EmptyState type="services" />
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{pendingServices.map((service) => (
								<ReviewCard 
                                    key={service.id} 
                                    title={service.name}
                                    subtitle={service.service_types}
                                    status={service.verification_status}
                                    date={service.created_at}
                                    docsCount={Array.isArray(service.accreditation_files_metadata) ? service.accreditation_files_metadata.length : 0}
                                    statusColor={getStatusColor(service.verification_status)}
                                    location={service.latitude && service.longitude ? "Location set" : undefined}
                                    href={`/dashboard/admin/review/${service.id}?type=service`}
                                />
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ReviewCard({ title, subtitle, status, date, docsCount, statusColor, location, href }: any) {
    return (
        <Link href={href} className="group block h-full">
            <Card className="h-full border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden group-hover:scale-[1.01]">
                <CardHeader className="pb-3 bg-white border-b border-gray-50">
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg font-bold text-gray-900 line-clamp-1" title={title}>
                            {title}
                        </CardTitle>
                        <Badge className={`${statusColor} shrink-0 capitalize`}>
                            {status.replace("_", " ")}
                        </Badge>
                    </div>
                    <CardDescription className="capitalize font-medium text-gray-500 line-clamp-1">
                        {subtitle}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            <span>Submitted {formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
                        </div>
                        {location && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                <span>{location}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-gray-400" />
                            <span>{docsCount} documents</span>
                        </div>
                    </div>
                    <div className="pt-2">
                        <Button variant="ghost" className="w-full justify-between hover:bg-blue-50 text-blue-600 group-hover:text-blue-700">
                            Review Details
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

function EmptyState({ type }: { type: 'users' | 'services' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
                All Caught Up!
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto">
                There are no pending verification requests for {type} at the moment.
            </p>
        </div>
    )
}

function ReviewDashboardSkeleton() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-20">
             <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
					<div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
				</div>
                <div className="flex gap-2">
                    <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
			</div>
             <div className="space-y-6">
                <div className="flex gap-6 border-b border-gray-200 pb-0">
                     <div className="h-10 w-32 bg-gray-100 rounded-t animate-pulse" />
                     <div className="h-10 w-32 bg-gray-100 rounded-t animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
             </div>
        </div>
    )
}
