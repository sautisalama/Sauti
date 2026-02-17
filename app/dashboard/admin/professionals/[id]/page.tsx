"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { 
    ArrowLeft, 
    FileText, 
    Building2, 
    ShieldCheck, 
    Clock, 
    Users, 
    Target,
    Briefcase,
    MapPin,
    AlertCircle,
    CheckCircle,
    XCircle,
    AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { DocumentSidepanel } from "../../_components/DocumentSidepanel";
import { 
    InfoBlock, 
    DocumentsGrid, 
    ActionButtons, 
    VerificationStatusBadge, 
    type AccreditationDocument,
    DetailHeader
} from "../../_components/AdminDetailComponents";

import { 
    Dialog, 
    DialogContent, 
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { performAdminAction } from "@/app/actions/admin-actions";

type ReviewHistoryItem = {
    id: string;
    action_type: string;
    created_at: string;
    admin: { first_name: string; last_name: string };
    details: { notes?: string };
    target_type?: string;
};

type ServiceItem = {
    id: string;
    name: string;
    service_types: string | string[];
    verification_status: string;
    verification_notes?: string;
    created_at: string;
    updated_at: string;
    helpline?: string;
    website?: string;
    coverage_area_radius?: number;
    description?: string;
    accreditation_files?: any;
    accreditation_files_metadata?: AccreditationDocument[];
    latitude?: number;
    longitude?: number;
};

type ProfileItem = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    user_type: string;
    professional_title?: string;
    bio?: string;
    verification_status: string;
    verification_notes?: string;
    created_at: string;
    updated_at: string;
    accreditation_files?: any;
    accreditation_files_metadata?: AccreditationDocument[];
};

export default function ProfessionalDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    const [profile, setProfile] = useState<ProfileItem | null>(null);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
    const [stats, setStats] = useState<{ matches: number }>({ matches: 0 });
    const [isLoading, setIsLoading] = useState(true);
    
    const [viewingDoc, setViewingDoc] = useState<{ doc: AccreditationDocument, contextId: string, contextType: 'profile' | 'service' } | null>(null);
    const [actionDialog, setActionDialog] = useState<{
        isOpen: boolean;
        action: 'verify' | 'reject' | 'ban' | null;
        targetId: string;
        targetType: 'profile' | 'service';
        targetName: string;
        notes: string;
    }>({
        isOpen: false,
        action: null,
        targetId: '',
        targetType: 'profile',
        targetName: '',
        notes: ''
    });

    const supabase = createClient();

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (profileError) throw profileError;

            // 2. Fetch Services
            const { data: servicesData, error: servicesError } = await supabase
                .from('support_services')
                .select('*')
                .eq('user_id', id);

            if (servicesError) throw servicesError;

            // 3. Fetch Matches Count
            const serviceIds = servicesData?.map(s => s.id) || [];
            let matchesCount = 0;
            if (serviceIds.length > 0) {
                const { count, error: countError } = await supabase
                    .from('matched_services')
                    .select('id', { count: 'exact', head: true })
                    .in('service_id', serviceIds);
                if (!countError) matchesCount = count || 0;
            }

            // 4. Fetch History
            const targetIds = [id, ...serviceIds];
            const { data: historyData } = await supabase
                .from('admin_actions')
                .select('*, admin:admin_id(first_name, last_name)')
                .in('target_id', targetIds)
                .order('created_at', { ascending: false });

            // Parse Documents
            const parsedProfile = {
                ...profileData,
                accreditation_files_metadata: parseDocuments(profileData.accreditation_files, profileData.accreditation_files_metadata)
            };

            const parsedServices = servicesData?.map(s => ({
                ...s,
                accreditation_files_metadata: parseDocuments(s.accreditation_files, s.accreditation_files_metadata)
            })) || [];

            setProfile(parsedProfile);
            setServices(parsedServices);
            setHistory(historyData || []);
            setStats({ matches: matchesCount });

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "Failed to load professional data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async () => {
        const { action, targetId, targetType, notes } = actionDialog;
        if (!action || !targetId) return;

        const status = action === 'verify' ? 'verified' : (action === 'ban' ? 'suspended' : 'rejected');

        try {
            await performAdminAction({
                targetId,
                targetType,
                action,
                notes
            });

            toast({ title: "Success", description: `${targetType === 'profile' ? 'Profile' : 'Service'} marked as ${status}.` });
            setActionDialog(prev => ({ ...prev, isOpen: false, notes: '' }));
            fetchData(); // Refresh

        } catch (error: any) {
            console.error("Action error:", error);
            toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
        }
    };

    const handleDocumentReview = async (doc: any, status: 'verified' | 'rejected', notes: string) => {
        if (!viewingDoc) return;
        const { contextId, contextType } = viewingDoc;

        const reviewEntry = {
            url: doc.url,
            name: doc.name,
            status,
            notes,
            reviewed_at: new Date().toISOString(),
            reviewer_id: (await supabase.auth.getUser()).data.user?.id
        };

        try {
             const table = contextType === 'profile' ? 'profiles' : 'support_services';
             const { data: currentData } = await supabase.from(table).select('accreditation_files_metadata').eq('id', contextId).single();
             
             let currentMetadata: any[] = [];
             const existingMeta = currentData?.accreditation_files_metadata;

             if (Array.isArray(existingMeta)) {
                currentMetadata = [...existingMeta];
             } else if (existingMeta) {
                 currentMetadata = [existingMeta];
             }

             // Update or Add
             currentMetadata = currentMetadata.filter((m: any) => m.url !== doc.url);
             currentMetadata.push(reviewEntry);

             const { error } = await supabase.from(table).update({ accreditation_files_metadata: currentMetadata }).eq('id', contextId);
             if (error) throw error;

             toast({ title: "Success", description: "Document status updated." });
             fetchData();
        } catch (error) {
            console.error("Doc review error:", error);
            toast({ title: "Error", description: "Failed to save document review", variant: "destructive" });
        }
    };

    const openActionDialog = (targetId: string, targetType: 'profile' | 'service', action: 'verify' | 'reject' | 'ban', targetName: string) => {
        let prefilledNotes = '';
        if (action === 'reject') {
            const targetObj = targetType === 'profile' ? profile : services.find(s => s.id === targetId);
            if (targetObj?.accreditation_files_metadata) {
                const rejectedDocs = targetObj.accreditation_files_metadata.filter(d => d.status === 'rejected');
                if (rejectedDocs.length > 0) {
                    prefilledNotes = "Rejected due to invalid documents:\n" + 
                        rejectedDocs.map(d => `- ${d.name}: ${d.notes || 'No specific reason'}`).join('\n');
                }
            }
        }

        setActionDialog({
            isOpen: true,
            action,
            targetId,
            targetType,
            targetName,
            notes: prefilledNotes
        });
    };

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto p-8 space-y-8">
                <div className="h-16 w-3/4 bg-gray-100 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
                    </div>
                    <div className="lg:col-span-3 space-y-6">
                        <div className="h-96 bg-gray-100 rounded-3xl animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) return <div className="p-12 text-center text-serene-neutral-500">Profile not found.</div>;

    const unverifiedProfileWarning = profile.verification_status !== 'verified' && services.some(s => s.verification_status === 'verified');

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-32 bg-serene-neutral-50/30 min-h-screen">
            {/* Header */}
            <DetailHeader 
                title={`${profile.first_name} ${profile.last_name}`}
                type={profile.user_type}
                backUrl="/dashboard/admin/professionals"
                status={profile.verification_status}
                onAction={(action) => openActionDialog(profile.id, 'profile', action, `${profile.first_name} ${profile.last_name}`)}
                meta={[
                    <span key="joined" className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                ]}
            />

            {unverifiedProfileWarning && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 rounded-2xl shadow-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Action Recommended</AlertTitle>
                    <AlertDescription>
                        This profile has verified services but the profile itself is not verified. 
                        Please verify the profile to enforce consistent status.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column: Quick Stats */}
                <div className="lg:col-span-1 space-y-6">
                     <Card className="rounded-[2rem] border-transparent shadow-card bg-white overflow-hidden">
                        <CardHeader className="bg-serene-neutral-50/50 pb-4 border-b border-serene-neutral-50">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-serene-neutral-400">Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-serene-blue-50 text-serene-blue-600 group-hover:bg-serene-blue-100 transition-colors">
                                        <Briefcase className="h-4 w-4" />
                                    </div>
                                    <span className="text-serene-neutral-600 font-medium">Services</span>
                                </div>
                                <span className="text-xl font-bold text-serene-neutral-900">{services.length}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                                        <Target className="h-4 w-4" />
                                    </div>
                                    <span className="text-serene-neutral-600 font-medium">Matches</span>
                                </div>
                                <span className="text-xl font-bold text-serene-neutral-900">{stats.matches}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <span className="text-serene-neutral-600 font-medium">Documents</span>
                                </div>
                                <span className="text-xl font-bold text-serene-neutral-900">
                                    {(profile.accreditation_files_metadata?.length || 0) + services.reduce((acc, s) => acc + (s.accreditation_files_metadata?.length || 0), 0)}
                                </span>
                            </div>
                        </CardContent>
                     </Card>
                </div>

                {/* Right Column: Detailed Content */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="profile" className="w-full space-y-8">
                        <TabsList className="w-full justify-start border-b border-serene-neutral-200 bg-transparent p-0 gap-8 h-auto">
                            <TabsTrigger value="profile" className="pb-4 data-[state=active]:border-serene-blue-600 data-[state=active]:text-serene-blue-700 text-serene-neutral-500 font-medium text-base hover:text-serene-neutral-800 transition-colors border-b-2 border-transparent px-0 rounded-none bg-transparent shadow-none">Profile Info</TabsTrigger>
                            <TabsTrigger value="services" className="pb-4 data-[state=active]:border-serene-blue-600 data-[state=active]:text-serene-blue-700 text-serene-neutral-500 font-medium text-base hover:text-serene-neutral-800 transition-colors border-b-2 border-transparent px-0 rounded-none bg-transparent shadow-none">Services ({services.length})</TabsTrigger>
                            <TabsTrigger value="history" className="pb-4 data-[state=active]:border-serene-blue-600 data-[state=active]:text-serene-blue-700 text-serene-neutral-500 font-medium text-base hover:text-serene-neutral-800 transition-colors border-b-2 border-transparent px-0 rounded-none bg-transparent shadow-none">History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                             <Card className="border-transparent shadow-card rounded-[2rem] overflow-hidden bg-white">
                                <CardContent className="space-y-8 p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <InfoBlock label="Email" value={profile.email} variant="inline" />
                                        <InfoBlock label="Phone" value={profile.phone} variant="inline" />
                                        <InfoBlock label="Professional Title" value={profile.professional_title} variant="inline" />
                                        <InfoBlock label="Bio" value={profile.bio} fullWidth variant="inline" />
                                    </div>

                                    <div className="pt-6 border-t border-serene-neutral-50">
                                        <h4 className="text-sm font-bold text-serene-neutral-900 mb-6 flex items-center gap-2 uppercase tracking-wide">
                                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                                <FileText className="h-3.5 w-3.5" />
                                            </div>
                                            Identity Documents
                                        </h4>
                                        <DocumentsGrid 
                                            documents={profile.accreditation_files_metadata || []} 
                                            onView={(doc) => setViewingDoc({ doc, contextId: profile.id, contextType: 'profile' })}
                                        />
                                    </div>
                                </CardContent>
                             </Card>
                        </TabsContent>

                        <TabsContent value="services" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            {services.length === 0 ? (
                                <div className="p-10 text-center bg-white rounded-[1.5rem] border border-dashed border-serene-neutral-200">
                                    <div className="h-12 w-12 rounded-full bg-serene-neutral-50 flex items-center justify-center mx-auto mb-3">
                                        <Building2 className="h-6 w-6 text-serene-neutral-400" />
                                    </div>
                                    <p className="text-sm font-medium text-serene-neutral-500">No services listed yet.</p>
                                </div>
                            ) : (
                                <Accordion type="multiple" defaultValue={services.map(s => s.id)} className="space-y-4">
                                    {services.map(service => (
                                        <AccordionItem key={service.id} value={service.id} className={cn(
                                            "rounded-xl px-2 shadow-sm transition-all duration-300 overflow-hidden border bg-white group hover:shadow-md",
                                            service.verification_status === 'verified' ? "border-green-100 shadow-green-50/50" :
                                            service.verification_status === 'rejected' ? "border-red-100 shadow-red-50/50" :
                                            "border-amber-100 shadow-amber-50/50"
                                        )}>
                                            <AccordionTrigger className="hover:no-underline py-5 px-6 group-open:pb-2">
                                                <div className="flex flex-col md:flex-row md:items-center gap-5 text-left w-full pr-4">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={cn(
                                                            "h-12 w-12 rounded-2xl flex items-center justify-center border shrink-0 transition-colors",
                                                            service.verification_status === 'verified' ? "bg-green-50 text-green-600 border-green-100" :
                                                            service.verification_status === 'rejected' ? "bg-red-50 text-red-600 border-red-100" :
                                                            "bg-amber-50 text-amber-600 border-amber-100"
                                                        )}>
                                                            <Building2 className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-lg text-serene-neutral-900 line-clamp-1">{service.name}</h4>
                                                            <p className="text-sm text-serene-neutral-500 capitalize md:hidden mt-0.5">{Array.isArray(service.service_types) ? service.service_types[0] : service.service_types}</p>
                                                        </div>
                                                    </div>

                                                    <div className="hidden md:flex items-center gap-8 text-sm text-serene-neutral-600 font-medium">
                                                        <div className="flex items-center gap-2 min-w-[140px]">
                                                            <Briefcase className="h-4 w-4 text-serene-neutral-400" />
                                                            <span className="capitalize truncate max-w-[160px]">{Array.isArray(service.service_types) ? service.service_types[0] : service.service_types}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 min-w-[160px]">
                                                            <MapPin className="h-4 w-4 text-serene-neutral-400" />
                                                            <span className="truncate max-w-[180px]">
                                                                {service.coverage_area_radius && service.coverage_area_radius > 40000 ? "Matching nationwide" : 
                                                                 service.coverage_area_radius ? `Local (${(service.coverage_area_radius/1000).toFixed(0)}km)` : "Remote"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center shrink-0">
                                                         <VerificationStatusBadge status={service.verification_status} />
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-8 pt-2 px-6 border-t border-serene-neutral-50 mt-4 mx-2">
                                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
                                                        {/* Details Card */}
                                                        <div className="xl:col-span-2 bg-serene-neutral-50/50 rounded-2xl border border-serene-neutral-100 p-5">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                                <InfoBlock label="Helpline" value={service.helpline} variant="inline" />
                                                                <InfoBlock label="Website" value={service.website} variant="inline" />
                                                                <InfoBlock 
                                                                    label="Description" 
                                                                    value={service.description} 
                                                                    fullWidth 
                                                                    variant="inline"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Quick Actions Card */}
                                                        <div className="flex flex-col gap-3 shrink-0 bg-white p-5 rounded-2xl border border-serene-neutral-200 shadow-sm h-fit">
                                                            <span className="text-xs font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Quick Actions</span>
                                                            <ActionButtons 
                                                                status={service.verification_status}
                                                                onAction={(action) => openActionDialog(service.id, 'service', action, service.name)}
                                                                size="sm"
                                                                className="flex-col items-stretch w-full"
                                                            />
                                                            <Button variant="ghost" size="sm" className="w-full text-serene-neutral-500 hover:text-serene-blue-600 text-xs h-8" onClick={() => router.push(`/dashboard/admin/services/${service.id}`)}>
                                                                View Full Details
                                                            </Button>
                                                        </div>
                                                    </div>

                                                 <div className="mt-8 pt-6 border-t border-serene-neutral-50">
                                                     <h5 className="text-xs font-bold text-serene-neutral-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                                                         <div className="p-1 rounded bg-serene-neutral-100 text-serene-neutral-500">
                                                            <FileText className="h-3 w-3" />
                                                         </div>
                                                         Service Documents
                                                     </h5>
                                                     <DocumentsGrid 
                                                        documents={service.accreditation_files_metadata || []}
                                                        onView={(doc) => setViewingDoc({ doc, contextId: service.id, contextType: 'service' })}
                                                     />
                                                 </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="animate-in slide-in-from-bottom-4 duration-500">
                             <Card className="border-transparent shadow-card rounded-[2rem] overflow-hidden bg-white">
                                <CardContent className="pt-8 pb-8 px-8 space-y-6">
                                    {history.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="h-10 w-10 bg-serene-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <Clock className="h-5 w-5 text-serene-neutral-400" />
                                            </div>
                                            <p className="text-sm text-serene-neutral-500 font-medium">No history recorded.</p>
                                        </div>
                                    ) : (
                                        <div className="relative border-l-2 border-serene-neutral-100 ml-4 space-y-8 pl-8 py-2">
                                            {history.map((log, idx) => (
                                                <div key={log.id} className="relative group">
                                                    <div className={cn(
                                                        "absolute -left-[41px] top-1 h-6 w-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-white z-10",
                                                        log.action_type.includes('verify') ? "text-green-600 ring-2 ring-green-100" :
                                                        log.action_type.includes('reject') ? "text-red-600 ring-2 ring-red-100" :
                                                        "text-blue-600 ring-2 ring-blue-100"
                                                    )}>
                                                        {log.action_type.includes('verify') ? <CheckCircle className="h-3.5 w-3.5" /> :
                                                         log.action_type.includes('reject') ? <XCircle className="h-3.5 w-3.5" /> :
                                                         <ShieldCheck className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div className="bg-serene-neutral-50/40 rounded-2xl p-4 border border-transparent hover:border-serene-neutral-100 transition-all">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <p className="font-bold text-serene-neutral-900 capitalize text-sm">
                                                                {log.action_type.replace(/_/g, ' ')}
                                                            </p>
                                                            <span className="text-xs text-serene-neutral-400 font-medium whitespace-nowrap ml-4">
                                                                {new Date(log.created_at).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-serene-neutral-500 mb-3">
                                                            Performed by <span className="font-semibold text-serene-neutral-700">{log.admin?.first_name} {log.admin?.last_name}</span>
                                                        </p>
                                                        {log.details?.notes && (
                                                            <div className="text-sm text-serene-neutral-700 bg-white p-3 rounded-xl border border-serene-neutral-100 italic relative">
                                                                <span className="absolute top-2 left-2 text-serene-neutral-200 text-lg leading-none">"</span>
                                                                <span className="relative z-10 px-2">{log.details.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                             </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Action Dialog */}
            <Dialog open={actionDialog.isOpen} onOpenChange={(open) => !open && setActionDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="rounded-3xl max-w-md overflow-hidden p-0 border-0 bg-white shadow-2xl">
                    <div className="p-8 pb-0">
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto transition-colors",
                            actionDialog.action === 'verify' ? "bg-green-100 text-green-600" :
                            actionDialog.action === 'ban' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                        )}>
                            {actionDialog.action === 'verify' ? <CheckCircle className="w-8 h-8" /> : 
                             actionDialog.action === 'ban' ? <AlertTriangle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                        </div>
                        
                        <DialogTitle className="text-2xl font-bold text-center text-gray-900 capitalize">
                            {actionDialog.action === 'verify' ? 
                                (actionDialog.targetType === 'profile' ? 'Approve Profile' : 'Approve Service') : 
                             actionDialog.action === 'ban' ? 'Suspend Account' : 
                             (actionDialog.targetType === 'profile' ? 'Reject Profile' : 'Reject Service')}
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-gray-500 mt-2 text-base">
                            Are you sure you want to {actionDialog.action} <span className="font-semibold text-gray-900">{actionDialog.targetName}</span>?
                        </DialogDescription>
                    </div>
                    
                    <div className="p-8 pt-6 space-y-4">
                        <div className="space-y-3">
                             <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                 {actionDialog.action === 'verify' ? "Internal Notes (Optional)" : "Reason for Rejection"}
                             </Label>
                             <Textarea 
                                value={actionDialog.notes}
                                onChange={(e) => setActionDialog(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder={actionDialog.action === 'verify' ? "Add an internal note..." : "Please describe why this is being rejected..."}
                                className="min-h-[120px] rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-serene-neutral-300 transition-all resize-none text-base"
                             />
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 flex gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => setActionDialog(prev => ({ ...prev, isOpen: false }))}
                            className="flex-1 rounded-xl h-12 border-gray-200 hover:bg-white hover:text-gray-900 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAction}
                            disabled={actionDialog.action === 'reject' && !actionDialog.notes.trim()}
                            className={cn(
                                "flex-1 rounded-xl h-12 text-white font-semibold shadow-lg transition-all hover:scale-[1.02]",
                                actionDialog.action === 'verify' ? "bg-green-600 hover:bg-green-700 shadow-green-200" :
                                actionDialog.action === 'ban' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"
                            )}
                        >
                            {actionDialog.action === 'verify' ? 'Approve' : 
                             actionDialog.action === 'ban' ? 'Suspend' : 'Reject'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <DocumentSidepanel 
                isOpen={!!viewingDoc}
                onClose={() => setViewingDoc(null)}
                document={viewingDoc ? viewingDoc.doc : null}
                contextType={viewingDoc?.contextType}
                contextData={viewingDoc?.contextType === 'profile' ? profile : services.find(s => s.id === viewingDoc?.contextId)}
                onSaveReview={handleDocumentReview}
            />
        </div>
    );
}

const parseDocuments = (filesJson: any, metadataJson: any): AccreditationDocument[] => {
    if (metadataJson && Array.isArray(metadataJson)) {
        return metadataJson.map((meta: any) => ({
            url: meta.url || filesJson?.find((f: any) => f.url === meta.url)?.url || '#',
            name: meta.name || 'Untitled Document',
            type: meta.type || filesJson?.find((f: any) => f.url === meta.url)?.type || 'unknown',
            status: meta.status,
            notes: meta.notes,
            docNumber: meta.docNumber,
            issuer: meta.issuer,
            reviewed_at: meta.reviewed_at,
        }));
    } else if (filesJson && Array.isArray(filesJson)) {
        return filesJson.map((file: any) => ({
            url: file.url || '#',
            name: file.name || 'Untitled Document',
            type: file.type || 'unknown',
            status: 'pending', 
        }));
    }
    return [];
};
