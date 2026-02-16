"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    Clock, 
    ArrowRight, 
    CheckCircle2, 
    Building2,
    FileText,
    History,
    Inbox
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";

type ActivityItem = {
    id: string;
    type: "professional" | "service";
    name: string;
    submittedAt: string;
    updatedAt?: string;
    avatarUrl?: string | null;
    status: string;
    details?: string;
    hasDocuments: boolean;
    reviewerId?: string;
};

export function AdminActivitySection() {
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const user = useUser();

    useEffect(() => {
        fetchActivity();

        // Real-time subscription
        const channel = supabase
            .channel('admin-activity')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchActivity())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_services' }, () => fetchActivity())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchActivity = async () => {
        try {
            // Fetch professionals
            const { data: professionals } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, created_at, updated_at, verification_updated_at, avatar_url, user_type, verification_status, accreditation_files_metadata, reviewed_by")
                .in("user_type", ["professional", "ngo"])
                .order("updated_at", { ascending: false })
                .limit(20);

            // Fetch services
            const { data: services } = await supabase
                .from("support_services")
                .select("id, name, created_at, updated_at, verification_updated_at, service_types, verification_status, accreditation_files_metadata, reviewed_by")
                .order("updated_at", { ascending: false })
                .limit(20);

            const combinedItems: ActivityItem[] = [
                ...(professionals?.map(p => {
                    const hasDocs = Array.isArray(p.accreditation_files_metadata) && p.accreditation_files_metadata.length > 0;
                    // Check if reviewed_by is object or string and extract ID
                    const reviewerId = typeof p.reviewed_by === 'object' && p.reviewed_by !== null ? (p.reviewed_by as any).reviewer_id : null;
                    
                    return {
                        id: p.id,
                        type: "professional" as const,
                        name: `${p.first_name} ${p.last_name}`,
                        submittedAt: p.created_at || new Date().toISOString(),
                        updatedAt: p.verification_updated_at || p.updated_at || p.created_at,
                        avatarUrl: p.avatar_url,
                        status: p.verification_status || 'pending',
                        details: p.user_type === 'ngo' ? 'NGO Representative' : 'Professional',
                        hasDocuments: hasDocs,
                        reviewerId
                    };
                }) || []),
                ...(services?.map(s => {
                    const hasDocs = Array.isArray(s.accreditation_files_metadata) && s.accreditation_files_metadata.length > 0;
                    const reviewerId = typeof s.reviewed_by === 'object' && s.reviewed_by !== null ? (s.reviewed_by as any).reviewer_id : null;

                    return {
                        id: s.id,
                        type: "service" as const,
                        name: s.name,
                        submittedAt: s.created_at || new Date().toISOString(),
                        updatedAt: s.verification_updated_at || s.updated_at || s.created_at,
                        avatarUrl: null,
                        status: s.verification_status || 'pending',
                        details: Array.isArray(s.service_types) ? s.service_types[0] : s.service_types,
                        hasDocuments: hasDocs,
                        reviewerId
                    };
                }) || [])
            ];

            setItems(combinedItems);
        } catch (error) {
            console.error("Error fetching activity:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter Logic
    const newItems = useMemo(() => {
        return items
            .filter(i => (i.status === 'pending' || i.status === 'under_review') && i.hasDocuments)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .slice(0, 3);
    }, [items]);

    const historyItems = useMemo(() => {
        return items
            .filter(i => i.status !== 'pending' && i.status !== 'under_review') // Only completed items
            .sort((a, b) => new Date(b.updatedAt || b.submittedAt).getTime() - new Date(a.updatedAt || a.submittedAt).getTime())
            .slice(0, 2);
    }, [items]);

    if (isLoading) {
        return <AdminActivitySkeleton />;
    }

    if (newItems.length === 0 && historyItems.length === 0) {
        return <EmptyActivityState />;
    }

    return (
        <div className="space-y-8">
            {/* New / Inbox Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Inbox className="h-5 w-5 text-serene-blue-600" />
                        New Verifications
                    </h3>
                    {newItems.length > 0 && (
                         <span className="bg-serene-blue-100 text-serene-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                            {newItems.length}
                        </span>
                    )}
                </div>

                <div className="grid gap-3">
                    {newItems.length > 0 ? (
                        newItems.map((item) => (
                            <ActivityCard key={`${item.type}-${item.id}`} item={item} isNew={true} />
                        ))
                    ) : (
                        <div className="p-6 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-500 text-sm">No new verifications pending.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* History Section */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <History className="h-5 w-5 text-gray-500" />
                        Recent History
                    </h3>
                    <Link 
                        href="/dashboard/admin/review" 
                        className="text-sm font-medium text-serene-blue-600 hover:text-serene-blue-700 flex items-center gap-1 transition-colors"
                    >
                        View All <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="grid gap-3">
                    {historyItems.length > 0 ? (
                        historyItems.map((item) => (
                            <ActivityCard key={`${item.type}-${item.id}`} item={item} isNew={false} />
                        ))
                    ) : (
                        <div className="p-6 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-500 text-sm">No recent activity history.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ActivityCard({ item, isNew }: { item: ActivityItem, isNew: boolean }) {
    // Determine link - always go to profile-centric review
    // If it's a service, we might want to pass a tab? For now, standard review page.
    const href = `/dashboard/admin/review/${item.id}`; // Wait, this ID is profile ID or service ID.
    // If it's a service, we need the OWNER's ID for the profile-centric view. 
    // Ah, my Implementation Plan says "Clicking a Service... takes you to Professional's review page".
    // I need to fetch the owner ID for services in the main fetch.
    
    // NOTE: For now, the review page [id] handles `type` param correctly to fetch either profile or service.
    // I will update the [id] page to *redirect* or *handle* this unifying logic. 
    // For this card, I will pass `?type=${item.type}` so the page knows what ID it is receiving.
    
    return (
        <Link 
            href={`${href}?type=${item.type}`}
            className="block group"
        >
            <Card className={cn(
                "hover:shadow-md transition-all duration-200 overflow-hidden border",
                isNew 
                    ? "border-serene-blue-200 bg-white shadow-sm ring-1 ring-serene-blue-50" 
                    : "border-gray-100 bg-gray-50/30 hover:bg-white"
            )}>
                <CardContent className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
                    {/* Icon/Avatar */}
                    <div className="shrink-0 pt-0.5">
                        {item.type === 'professional' ? (
                            <Avatar className={cn(
                                "h-10 w-10 sm:h-12 sm:w-12 border-2 shadow-sm",
                                isNew ? "border-serene-blue-100" : "border-white grayscale-[0.3]"
                            )}>
                                <AvatarImage src={item.avatarUrl || undefined} />
                                <AvatarFallback className={cn(
                                    "font-bold text-xs sm:text-sm",
                                    isNew ? "bg-serene-blue-50 text-serene-blue-700" : "bg-gray-100 text-gray-500"
                                )}>
                                    {item.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        ) : (
                            <div className={cn(
                                "h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-2 shadow-sm",
                                isNew 
                                    ? "bg-serene-purple-50 text-serene-purple-600 border-serene-purple-100" 
                                    : "bg-gray-100 text-gray-400 border-white"
                            )}>
                                <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 grid gap-1">
                        <div className="flex items-start justify-between gap-2">
                            <h4 className={cn(
                                "truncate text-sm sm:text-base pr-2",
                                isNew ? "font-bold text-gray-900" : "font-medium text-gray-600"
                            )}>
                                {item.name}
                            </h4>
                            <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap pt-1 shrink-0 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(isNew ? item.submittedAt : (item.updatedAt || item.submittedAt)), { addSuffix: true })}
                            </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className={cn(
                                "px-1.5 py-0 h-5 text-[10px] sm:text-xs font-normal border uppercase tracking-tight",
                                isNew ? "bg-white border-gray-200 text-gray-700" : "bg-gray-100 border-gray-200 text-gray-500"
                            )}>
                                {item.type === 'professional' ? 'Pro' : 'Service'}
                            </Badge>
                            
                            {!isNew && (
                                <Badge variant="outline" className={cn(
                                    "px-1.5 py-0 h-5 text-[10px] sm:text-xs font-normal border capitalize",
                                    item.status === 'verified' ? "bg-green-50 text-green-700 border-green-200" :
                                    item.status === 'rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-gray-50 text-gray-600 border-gray-200"
                                )}>
                                    {item.status.replace('_', ' ')}
                                </Badge>
                            )}

                            <span className="text-xs text-gray-500 truncate max-w-[150px] sm:max-w-[300px]">
                                {item.details}
                            </span>
                        </div>
                        
                        {isNew && (
                             <div className="flex items-center gap-1 mt-1 text-xs font-medium text-serene-blue-600">
                                <FileText className="h-3 w-3" />
                                <span>Documents attached</span>
                             </div>
                        )}
                    </div>

                    {/* Mobile Arrow / Desktop Action Indicator */}
                    <div className="self-center text-gray-300 group-hover:text-serene-blue-400 transition-colors">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

function EmptyActivityState() {
     return (
        <Card className="border-dashed border-2 bg-gray-50/50 shadow-none">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">All caught up!</h3>
                <p className="text-gray-500 max-w-sm mt-1">
                    There are no pending verification requests at the moment.
                </p>
            </CardContent>
        </Card>
    );
}

function AdminActivitySkeleton() {
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                 <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
                 <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                         <div key={i} className="h-24 w-full bg-gray-100 animate-pulse rounded-xl" />
                    ))}
                </div>
            </div>
             <div className="space-y-4">
                 <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
                 <div className="space-y-3">
                    {[1, 2].map((i) => (
                         <div key={i} className="h-24 w-full bg-gray-100 animate-pulse rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}
