"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, FileText, AlertTriangle, ShieldCheck, Building2, User, ChevronDown, ChevronUp, AlertCircle, Briefcase, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";



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
    description?: string; // Assuming description exists or falling back
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

export default function ReviewPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string; // This is the PROFILE ID
    const initialType = searchParams.get("type"); // Might be 'service' or 'professional'
    
    // If we land here with a SERVICE ID (because dashboard link was for a service),
    // we need to handle that. Ideally, the dashboard links to PROFILE ID.
    // BUT, if dashboard links to SERVICE ID, we must fetch service first to get owner ID.
    // For now, assuming standard flow: Dashboard passes PROFILE ID (or we redirect).
    // Let's assume ID is PROFILE ID for simplicity as per plan "Refactor to Profile-Centric".
    // If the dashboard passes a Service ID, this page will fail to load a profile.
    // To fix dashboard links: The dashboard should pass `profile_id` if it knows it.
    // Since dashboard has `profiles` and `support_services` separately:
    // If `type` is 'service', we might need to fetch the service first to find the `user_id`.

    const [isResolvingId, setIsResolvingId] = useState(initialType === 'service');
    const [profileId, setProfileId] = useState<string>(initialType === 'service' ? '' : id);
    
    const [profile, setProfile] = useState<ProfileItem | null>(null);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
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

    // ID Resolution Effect
    useEffect(() => {
        const resolveId = async () => {
            if (initialType === 'service') {
                const { data, error } = await supabase
                    .from('support_services')
                    .select('user_id')
                    .eq('id', id)
                    .single();
                
                if (data && data.user_id) {
                    setProfileId(data.user_id);
                } else {
                    toast({ title: "Error", description: "Could not find owner of this service.", variant: "destructive" });
                    router.push('/dashboard/admin'); // Fallback
                }
                setIsResolvingId(false);
            }
        };

        if (initialType === 'service') {
            resolveId();
        }
    }, [id, initialType]);

    // Data Fetch Effect
    useEffect(() => {
        if (!isResolvingId && profileId) {
            fetchData();
        }
    }, [profileId, isResolvingId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', profileId)
                .single();

            if (profileError) throw profileError;

            // 2. Fetch Services
            const { data: servicesData, error: servicesError } = await supabase
                .from('support_services')
                .select('*')
                .eq('user_id', profileId);

            if (servicesError) throw servicesError;

            // 3. Fetch History (Profile + Services)
            // We need to fetch actions where target_id IS profileId OR target_id IN servicesIds
            const serviceIds = servicesData?.map(s => s.id) || [];
            const targetIds = [profileId, ...serviceIds];
            
            const { data: historyData, error: historyError } = await supabase
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

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "Failed to load profile data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async () => {
        const { action, targetId, targetType, notes } = actionDialog;
        if (!action || !targetId) return;

        const status = action === 'verify' ? 'verified' : (action === 'ban' ? 'suspended' : 'rejected');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
                return;
            }

            // 1. Update Target Status
            const updatePayload: any = {
                verification_status: status,
                verification_notes: notes,
                verification_updated_at: new Date().toISOString(),
                ...(action === 'verify' ? { 
                    verified_by: user.id, // Only for profile/service schema support? Check schema if verify_by exists for services.
                    // Profiles has admin_verified_by. Services table schema? 
                    // Let's check schema assumption. Assuming standard fields or JSON metadata.
                } : {}),
                reviewed_by: {
                    reviewer_id: user.id,
                    reviewed_at: new Date().toISOString(),
                    action: action,
                    notes: notes
                }
            };
            
            // Schema check: profiles has `admin_verified_by`, support_services might not?
            // Using `reviewed_by` JSONB for generic tracking is safer across both.
            if (targetType === 'profile' && action === 'verify') {
                updatePayload.admin_verified_by = user.id;
                updatePayload.admin_verified_at = new Date().toISOString(); 
                updatePayload.isVerified = true;
            }

            const table = targetType === 'profile' ? 'profiles' : 'support_services';
            const { error: updateError } = await supabase
                .from(table)
                .update(updatePayload)
                .eq('id', targetId);

            if (updateError) throw updateError;

            // 2. Log Action
            const actionTypeSuffix = targetType === 'profile' ? 'user' : 'service';
            await supabase.from('admin_actions').insert({
                admin_id: user.id,
                action_type: `${action}_${actionTypeSuffix}`,
                target_id: targetId,
                target_type: targetType === 'profile' ? 'user' : 'service',
                details: { notes, previous_status: targetType === 'profile' ? profile?.verification_status : services.find(s => s.id === targetId)?.verification_status }
            });

            // 3. Send Notification to User
            const notificationTitle = targetType === 'profile' 
                ? "Profile Verification Update"
                : "Service Verification Update";
            
            const notificationMessage = targetType === 'profile' 
                ? `Your profile verification status has been updated to ${status}.`
                : `Your service "${services.find(s => s.id === targetId)?.name || 'Service'}" verification status has been updated to ${status}.`;

            const notificationLink = targetType === 'profile' 
                ? '/dashboard/profile?section=account'
                : '/dashboard/profile?section=services';

            if (!profile) throw new Error("Profile not loaded");

            await supabase.from('notifications').insert({
                user_id: profile.id, // The profile owner
                type: `verification_${status}`,
                title: notificationTitle,
                message: notificationMessage,
                link: notificationLink,
                read: false,
                metadata: { 
                    target_type: targetType, 
                    target_id: targetId,
                    notes: notes,
                    action_by: user.id
                }
            });

            toast({ title: "Success", description: `${targetType === 'profile' ? 'Profile' : 'Service'} marked as ${status}.` });
            setActionDialog(prev => ({ ...prev, isOpen: false, notes: '' }));
            fetchData(); // Refresh

        } catch (error) {
            console.error("Action error:", error);
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleDocumentReview = async (doc: any, status: 'verified' | 'rejected', notes: string) => {
        if (!viewingDoc) return;
        const { contextId, contextType } = viewingDoc;

        // 1. Create Metadata Entry
        const reviewEntry = {
            url: doc.url,
            name: doc.name,
            status,
            notes,
            reviewed_at: new Date().toISOString(),
            reviewer_id: (await supabase.auth.getUser()).data.user?.id
        };

        try {
            // Get current metadata
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

             // Save
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
        
        // Auto-fill rejection notes from flagged documents
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

    if (isLoading || isResolvingId) {
        return <div className="flex items-center justify-center h-screen text-serene-neutral-500 animate-pulse">Loading profile...</div>;
    }

    if (!profile) {
        return <div className="p-12 text-center text-serene-neutral-500">Profile not found.</div>;
    }

    const unverifiedProfileWarning = profile.verification_status !== 'verified' && services.some(s => s.verification_status === 'verified');

    return (
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8 pb-20 bg-serene-neutral-50/30 min-h-screen">
            {/* Header */}
            <DetailHeader 
                title={`${profile.first_name} ${profile.last_name}`}
                type={profile.user_type}
                backUrl="/dashboard/admin"
                status={profile.verification_status}
                onAction={(action) => openActionDialog(profile.id, 'profile', action, `${profile.first_name} ${profile.last_name}`)}
                meta={[
                    <span key="joined">Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                ]}
            />

            {unverifiedProfileWarning && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Action Recommended</AlertTitle>
                    <AlertDescription>
                        This profile has verified services but the profile itself is not verified. 
                        Please verify the profile to allow matching.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Column: Navigation / Summary */}
                <div className="lg:col-span-1 space-y-6">
                     <Card className="rounded-3xl border-serene-neutral-200 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm font-medium">Services</span>
                                <Badge variant="secondary" className="bg-white border border-gray-200 text-gray-700 shadow-sm">{services.length}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm font-medium">Documents</span>
                                <Badge variant="secondary" className="bg-white border border-gray-200 text-gray-700 shadow-sm">
                                    {(profile.accreditation_files_metadata?.length || 0) + services.reduce((acc, s) => acc + (s.accreditation_files_metadata?.length || 0), 0)}
                                </Badge>
                            </div>
                        </CardContent>
                     </Card>
                </div>

                {/* Right Column: Content */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="profile" className="w-full space-y-6">
                        <TabsList className="w-full justify-start border-b border-serene-neutral-200 bg-transparent p-0 gap-8 h-auto">
                            <TabsTrigger value="profile" className="tab-trigger">Profile Info</TabsTrigger>
                            <TabsTrigger value="services" className="tab-trigger">Services ({services.length})</TabsTrigger>
                            <TabsTrigger value="history" className="tab-trigger">History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile" className="space-y-6 animate-in slide-in-from-bottom-2">
                             {/* Profile Details Card */}
                             <Card className="border-serene-neutral-200 shadow-sm rounded-3xl overflow-hidden bg-white">
                                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-100 bg-gray-50/30">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl text-gray-900 font-bold">Personal Details</CardTitle>
                                        <CardDescription className="text-gray-500">Basic information and identity documents</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <ActionButtons 
                                            status={profile.verification_status} 
                                            onAction={(action) => openActionDialog(profile.id, 'profile', action, `${profile.first_name} ${profile.last_name}`)} 
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <InfoBlock label="Email" value={profile.email} variant="inline" />
                                        <InfoBlock label="Phone" value={profile.phone} variant="inline" />
                                        <InfoBlock label="Professional Title" value={profile.professional_title} variant="inline" />
                                        <InfoBlock label="Bio" value={profile.bio} fullWidth variant="inline" />
                                    </div>

                                    <div className="pt-6 mt-2 border-t border-gray-100">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                                                <FileText className="h-4 w-4" />
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

                        <TabsContent value="services" className="space-y-6 animate-in slide-in-from-bottom-2">
                            {services.length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                                    <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No services listed.</p>
                                </div>
                            ) : (
                                <Accordion type="multiple" defaultValue={services.map(s => s.id)} className="space-y-4">
                                    {services.map(service => (
                                        <AccordionItem key={service.id} value={service.id} className={cn(
                                            "rounded-2xl px-2 shadow-sm transition-all overflow-hidden border bg-white",
                                            service.verification_status === 'verified' ? "border-green-100 shadow-green-100/50" :
                                            service.verification_status === 'rejected' ? "border-red-100 shadow-red-100/50" :
                                            "border-amber-100 shadow-amber-100/50"
                                        )}>
                                            <AccordionTrigger className="hover:no-underline py-4 px-4 group">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4 text-left w-full pr-4">
                                                    {/* Icon & Name */}
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center border shrink-0 bg-white/40 backdrop-blur-sm",
                                                            service.verification_status === 'verified' ? "text-sauti-teal border-sauti-teal/10" :
                                                            service.verification_status === 'rejected' ? "text-sauti-red border-sauti-red/10" :
                                                            "text-sauti-orange border-sauti-yellow/10"
                                                        )}>
                                                            <Building2 className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-serene-neutral-900 line-clamp-1">{service.name}</h4>
                                                            <p className="text-sm text-serene-neutral-600 capitalize md:hidden">{Array.isArray(service.service_types) ? service.service_types[0] : service.service_types}</p>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Metadata Columns (Hidden on Mobile) */}
                                                    <div className="hidden md:flex items-center gap-6 text-sm text-serene-neutral-600">
                                                        <div className="flex items-center gap-1.5 min-w-[120px]">
                                                            <Briefcase className="h-3.5 w-3.5 opacity-70" />
                                                            <span className="capitalize truncate max-w-[140px]">{Array.isArray(service.service_types) ? service.service_types[0] : service.service_types}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 min-w-[140px]">
                                                            <MapPin className="h-3.5 w-3.5 opacity-70" />
                                                            <span className="truncate max-w-[160px]">
                                                                {service.coverage_area_radius && service.coverage_area_radius > 40000 ? "Matching nationwide" : 
                                                                 service.coverage_area_radius ? `Local (${(service.coverage_area_radius/1000).toFixed(0)}km)` : "Remote"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge - Positioned cleanly */}
                                                    <div className="flex items-center shrink-0">
                                                         <Badge variant="outline" className={cn(
                                                            "capitalize border shadow-none font-medium px-2.5 py-0.5",
                                                            service.verification_status === 'verified' ? "bg-white/50 text-sauti-teal border-sauti-teal/20" :
                                                            service.verification_status === 'rejected' ? "bg-white/50 text-sauti-red border-sauti-red/20" :
                                                            "bg-white/50 text-sauti-orange border-sauti-yellow/20"
                                                        )}>
                                                            {service.verification_status || 'Pending'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-6 pt-2 px-4 border-t border-black/5 mt-2">
                                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
                                                        {/* Details Card */}
                                                        <div className="xl:col-span-2 bg-serene-neutral-50/50 rounded-2xl border border-serene-neutral-100 p-5">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                                <InfoBlock label="Helpline" value={service.helpline} variant="inline" />
                                                                <InfoBlock label="Website" value={service.website} variant="inline" />
                                                                <InfoBlock label="Service Types" value={Array.isArray(service.service_types) ? service.service_types.join(', ') : service.service_types} variant="inline" />
                                                                <InfoBlock 
                                                                    label="Location / Coverage" 
                                                                    value={
                                                                        <div className="flex flex-col gap-2">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="font-medium">
                                                                                    {service.coverage_area_radius && service.coverage_area_radius > 40000 ? "Wide Area / Nationwide" : 
                                                                                    service.coverage_area_radius && service.coverage_area_radius > 10000 ? "Regional Coverage" : 
                                                                                    service.coverage_area_radius ? `Local (${(service.coverage_area_radius/1000).toFixed(1)} km)` : "Remote / Online"}
                                                                                </span>
                                                                                {service.latitude && service.longitude && (
                                                                                    <span className="text-xs text-xs text-gray-500 font-normal">
                                                                                        {service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {service.latitude && service.longitude && (
                                                                                <div className="aspect-video w-full rounded-lg overflow-hidden border border-serene-neutral-200 mt-1">
                                                                                    <iframe
                                                                                        width="100%"
                                                                                        height="100%"
                                                                                        frameBorder="0"
                                                                                        scrolling="no"
                                                                                        marginHeight={0}
                                                                                        marginWidth={0}
                                                                                        src={`https://maps.google.com/maps?q=${service.latitude},${service.longitude}&z=15&output=embed`}
                                                                                    ></iframe>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    } 
                                                                    variant="inline"
                                                                />
                                                                <InfoBlock label="Description" value={service.description} fullWidth variant="inline" />
                                                            </div>
                                                        </div>

                                                        {/* Quick Actions Card */}
                                                        <div className="flex flex-col gap-3 shrink-0 bg-white p-5 rounded-2xl border border-serene-neutral-200 shadow-sm h-fit">
                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Actions</span>
                                                            <ActionButtons 
                                                                status={service.verification_status}
                                                                onAction={(action) => openActionDialog(service.id, 'service', action, service.name)}
                                                                size="sm"
                                                                className="flex-col items-stretch w-full"
                                                            />
                                                        </div>
                                                    </div>

                                                 <div className="mt-8 pt-4 border-t border-black/5">
                                                     <h5 className="text-xs font-bold text-serene-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                         <FileText className="h-3 w-3" />
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

                        <TabsContent value="history" className="animate-in slide-in-from-bottom-2">
                             <Card className="border-gray-200 shadow-sm rounded-3xl bg-white">
                                <CardContent className="pt-6 space-y-6">
                                    {history.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No history recorded.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {history.map(log => (
                                                <div key={log.id} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                                    <div className="mt-1">
                                                        {log.action_type.includes('verify') ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                                         log.action_type.includes('reject') ? <XCircle className="h-5 w-5 text-red-600" /> :
                                                         <ShieldCheck className="h-5 w-5 text-blue-600" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 capitalize">
                                                            {log.action_type.replace('_', ' ')}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            by {log.admin?.first_name} {log.admin?.last_name} • {new Date(log.created_at).toLocaleString()}
                                                        </p>
                                                        {log.details?.notes && (
                                                            <p className="text-sm text-gray-700 mt-2 bg-white p-2 rounded border border-gray-200">
                                                                "{log.details.notes}"
                                                            </p>
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

            {/* Action Dialog - Premium Polish */}
            <Dialog open={actionDialog.isOpen} onOpenChange={(open) => !open && setActionDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="rounded-3xl max-w-md overflow-hidden p-0 border-0 bg-white shadow-2xl">
                    <div className="p-8 pb-0">
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto transition-colors",
                            actionDialog.action === 'verify' ? "bg-green-100 text-green-600" :
                            actionDialog.action === 'ban' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                        )}>
                            {actionDialog.action === 'verify' ? <CheckCircle className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                        </div>
                        
                        <DialogTitle className="text-2xl font-bold text-center text-gray-900 capitalize">
                            {actionDialog.action === 'verify' ? 
                                (actionDialog.targetType === 'profile' ? 'Approve Profile' : 'Approve Service') : 
                             actionDialog.action === 'ban' ? 'Suspend Account' : 
                             (actionDialog.targetType === 'profile' ? 'Reject Profile' : 'Reject Service')}
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-gray-500 mt-2 text-base">
                            Are you sure you want to {actionDialog.action} <span className="font-semibold text-gray-900">{actionDialog.targetName}</span>?
                            {actionDialog.action === 'verify' && actionDialog.targetType === 'profile' && " This will verify their personal details and identity documents."}
                            {actionDialog.action === 'verify' && actionDialog.targetType === 'service' && " This will approve this specific service for public listing."}
                            {actionDialog.action === 'reject' && " They will be notified to update their information."}
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
                             {actionDialog.action === 'reject' && (
                                 <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                     Notes from flagged documents are auto-filled above.
                                 </p>
                             )}
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


            {/* Document Sidepanel */}
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
    // Prefer metadata as it has review status and extended info
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

