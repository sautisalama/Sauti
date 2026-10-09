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
    ArrowRight,
    ClipboardList,
    LayoutGrid,
    List
} from "lucide-react";
import Link from "next/link";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { PendingUser, PendingService } from "@/types/admin-types";
import { formatDistanceToNow } from "date-fns";
import { AdminCasesTable } from "../_components/AdminCasesTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Presence = "all" | "with" | "without";
type SortKey = "newest" | "oldest" | "updated";
type Row = { docs: number; services: number };
const docCountOf = (u: any) => Math.max(
	Array.isArray(u.accreditation_files_metadata) ? u.accreditation_files_metadata.length : 0,
	Array.isArray(u.accreditation_files) ? u.accreditation_files.length : 0
);
const matchesPresence = (n: number, p: Presence) => p === "all" || (p === "with" ? n > 0 : n === 0);
const time = (d?: string | null) => (d ? new Date(d).getTime() : 0);
function sortBy<T extends { created_at: string | null; verification_updated_at: string | null }>(items: T[], key: SortKey) {
	return [...items].sort((a, b) =>
		key === "oldest" ? time(a.created_at) - time(b.created_at)
		: key === "updated" ? time(b.verification_updated_at || b.created_at) - time(a.verification_updated_at || a.created_at)
		: time(b.created_at) - time(a.created_at));
}

function RadioFilter<T extends string>({ legend, value, onChange, options }: { legend: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
	return (
		<fieldset className="min-w-0">
			<legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">{legend}</legend>
			<div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
				{options.map((o) => (
					<label key={o.value} className="cursor-pointer">
						<input type="radio" name={legend} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
						<span className="block rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400">{o.label}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

export default function ReviewDashboardPage() {
	const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
	const [pendingServices, setPendingServices] = useState<PendingService[]>([]);
    const [matchedCount, setMatchedCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [userServiceCounts, setUserServiceCounts] = useState<Record<string, number>>({});
	const [docFilter, setDocFilter] = useState<Presence>("all");
	const [serviceFilter, setServiceFilter] = useState<Presence>("all");
	const [sort, setSort] = useState<SortKey>("newest");
	const [view, setView] = useState<"cards" | "list">("cards");
	const supabase = createClient();

	useEffect(() => {
		try {
			const saved = localStorage.getItem("ss_review_view");
			if (saved === "cards" || saved === "list") setView(saved);
		} catch {}
	}, []);

	const changeView = (v: "cards" | "list") => {
		setView(v);
		try { localStorage.setItem("ss_review_view", v); } catch {}
	};

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
						`id, name, service_types, verification_status, accreditation_files_metadata, created_at, verification_updated_at, latitude, longitude, coverage_area_radius`
					)
					.in("verification_status", ["pending", "under_review"])
					.order("created_at", { ascending: false });

                // Load matched cases count
                const { count: casesCount } = await supabase
                    .from("reports")
                    .select("report_id", { count: 'exact', head: true })
                    .eq("ismatched", true);

				// How many services each applicant has, for the "with services" filter.
				const userIds = (users || []).map((u: any) => u.id);
				const counts: Record<string, number> = {};
				if (userIds.length) {
					const { data: owned } = await supabase.from("support_services").select("user_id").in("user_id", userIds);
					(owned || []).forEach((r: any) => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
				}
				setUserServiceCounts(counts);

				// Everything pending is listed (the same set the admin counters use), including applicants who have not uploaded documents yet.
				const myId = (await supabase.auth.getUser()).data.user?.id; // an admin never reviews their own profile/services
					setPendingUsers(((users || []) as unknown as PendingUser[]).filter((u) => u.id !== myId));
				const { data: mine } = myId ? await supabase.from("support_services").select("id").eq("user_id", myId) : { data: [] as { id: string }[] };
					const mineIds = new Set((mine || []).map((s) => s.id));
					setPendingServices(((services || []) as unknown as PendingService[]).filter((s) => !mineIds.has(s.id)));
                setMatchedCount(casesCount || 0);
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

	const shownUsers = sortBy(
		pendingUsers.filter((u) => matchesPresence(docCountOf(u), docFilter) && matchesPresence(userServiceCounts[u.id] || 0, serviceFilter)),
		sort
	);
	const shownServices = sortBy(
		pendingServices.filter((s) => matchesPresence(docCountOf(s), docFilter)),
		sort
	);
	const filtersActive = docFilter !== "all" || serviceFilter !== "all";
	const resetFilters = () => { setDocFilter("all"); setServiceFilter("all"); };

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
                     <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm border-blue-100 text-blue-700 bg-blue-50/50">
                        {matchedCount} Matched Cases
                    </Badge>
                </div>
			</div>

			<Tabs defaultValue="users" className="space-y-6">
				<div className="flex items-end justify-between gap-4 border-b border-gray-200">
				<TabsList className="bg-transparent w-full justify-start rounded-none h-auto p-0 gap-6">
					<TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 data-[state=active]:text-blue-700 font-medium">
						<UserCheck className="h-4 w-4 mr-2" />
						Professionals & NGOs
					</TabsTrigger>
					<TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 data-[state=active]:text-blue-700 font-medium">
						<Building2 className="h-4 w-4 mr-2" />
						Support Services
					</TabsTrigger>
                    <TabsTrigger value="cases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 px-1 data-[state=active]:text-blue-700 font-medium">
						<ClipboardList className="h-4 w-4 mr-2" />
						Incident Cases
					</TabsTrigger>
				</TabsList>
				<div className="mb-2 inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Layout">
					<button type="button" onClick={() => changeView("cards")} aria-pressed={view === "cards"} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${view === "cards" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
						<LayoutGrid className="h-3.5 w-3.5" /> Cards
					</button>
					<button type="button" onClick={() => changeView("list")} aria-pressed={view === "list"} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${view === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
						<List className="h-3.5 w-3.5" /> List
					</button>
				</div>
				</div>

				<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
					<RadioFilter legend="Documents" value={docFilter} onChange={setDocFilter} options={[{ value: "all", label: "All" }, { value: "with", label: "With documents" }, { value: "without", label: "No documents" }]} />
					<RadioFilter legend="Services" value={serviceFilter} onChange={setServiceFilter} options={[{ value: "all", label: "All" }, { value: "with", label: "With services" }, { value: "without", label: "No services" }]} />
					<div>
						<label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Order by</label>
						<Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
							<SelectTrigger className="h-9 w-[190px] rounded-lg bg-white text-xs font-semibold"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="newest">Newest submitted first</SelectItem>
								<SelectItem value="oldest">Oldest submitted first</SelectItem>
								<SelectItem value="updated">Recently updated</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{filtersActive && <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs text-blue-600">Clear filters</Button>}
					<p className="ml-auto pb-2 text-xs text-gray-500" aria-live="polite">Showing {shownUsers.length} of {pendingUsers.length} people · {shownServices.length} of {pendingServices.length} services</p>
				</div>

				<TabsContent value="users" className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
					{shownUsers.length === 0 ? (
						<EmptyState type="users" filtered={pendingUsers.length > 0} />
					) : (
						<div className={view === "cards" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"}>
							{shownUsers.map((user) => (
								<ReviewCard view={view} 
                                    key={user.id} 
                                    title={`${user.first_name || 'Unknown'} ${user.last_name || ''}`}
                                    subtitle={user.user_type || 'Professional'}
                                    status={user.verification_status || 'pending'}
                                    date={user.created_at || new Date().toISOString()}
                                    docsCount={docCountOf(user)}
                                    statusColor={getStatusColor(user.verification_status || 'pending')}
                                    href={`/dashboard/admin/review/${user.id}?type=professional`} 
                                />
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="services" className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
					{shownServices.length === 0 ? (
						<EmptyState type="services" filtered={pendingServices.length > 0} />
					) : (
						<div className={view === "cards" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"}>
							{shownServices.map((service) => (
								<ReviewCard view={view} 
                                    key={service.id} 
                                    title={service.name || 'Untitled Service'}
                                    subtitle={service.service_types || 'Support Service'}
                                    status={service.verification_status || 'pending'}
                                    date={service.created_at || new Date().toISOString()}
                                    docsCount={Array.isArray(service.accreditation_files_metadata) ? service.accreditation_files_metadata.length : 0}
                                    statusColor={getStatusColor(service.verification_status || 'pending')}
                                    location={service.latitude && service.longitude ? "Location set" : undefined}
                                    href={`/dashboard/admin/review/${service.id}?type=service`}
                                />
							))}
						</div>
					)}
				</TabsContent>

                <TabsContent value="cases" className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    <AdminCasesTable />
                </TabsContent>
			</Tabs>
		</div>
	);
}

interface ReviewCardProps {
    view: "cards" | "list";
    title: string;
    subtitle: string | null;
    status: string;
    date: string;
    docsCount: number;
    statusColor: string;
    location?: string;
    href: string;
}

function ReviewCard({ view, title, subtitle, status, date, docsCount, statusColor, location, href }: ReviewCardProps) {
    if (view === "list") {
        return (
            <Link href={href} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-blue-50/40">
                <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-semibold text-gray-900" title={title}>{title}</p>
                    <p className="truncate text-xs capitalize text-gray-500">{subtitle}</p>
                </div>
                <Badge className={`${statusColor} shrink-0 capitalize`}>{status.replace("_", " ")}</Badge>
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><FileText className="h-3.5 w-3.5 text-gray-400" />{docsCount} documents</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><Clock className="h-3.5 w-3.5 text-gray-400" />{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
                {location && <span className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5 text-gray-400" />{location}</span>}
                <ArrowRight className="h-4 w-4 text-blue-600 transition-transform group-hover:translate-x-1" />
            </Link>
        );
    }
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

function EmptyState({ type, filtered }: { type: 'users' | 'services'; filtered?: boolean }) {
    if (filtered) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center text-sm text-gray-500">
                Nobody matches these filters. Clear a filter to see more {type}.
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
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
