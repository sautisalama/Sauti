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
    ExternalLink,
    AlertTriangle,
    XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    user_id: string;
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
    verification_status: string;
};

export default function ServiceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    const [service, setService] = useState<ServiceItem | null>(null);
    const [owner, setOwner] = useState<ProfileItem | null>(null);
    const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
    const [stats, setStats] = useState<{ matches: number }>({ matches: 0 });
    const [isLoading, setIsLoading] = useState(true);
    
    const [viewingDoc, setViewingDoc] = useState<{ doc: AccreditationDocument, contextId: string, contextType: 'service' } | null>(null);
    const [actionDialog, setActionDialog] = useState<{
        isOpen: boolean;
        action: 'verify' | 'reject' | 'ban' | null;
        targetId: string;
        targetName: string;
        notes: string;
    }>({
        isOpen: false,
        action: null,
        targetId: '',
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
            // 1. Fetch Service
            const { data: serviceData, error: serviceError } = await supabase
                .from('support_services')
                .select('*')
                .eq('id', id)
                .single();

            if (serviceError) throw serviceError;

            // 2. Fetch Owner Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, email, phone, user_type, professional_title, verification_status')
                .eq('id', serviceData.user_id)
                .single();

            if (profileError) {
                 console.error("Error fetching owner:", profileError);
                 // Don't throw, just log. Owner might be missing in edge cases?
            }

            // 3. Fetch Matches Count
            let matchesCount = 0;
            const { count, error: countError } = await supabase
                .from('matched_services')
                .select('id', { count: 'exact', head: true })
                .eq('service_id', id);
            
            if (!countError) matchesCount = count || 0;

            // 4. Fetch History
            const { data: historyData } = await supabase
                .from('admin_actions')
                .select('*, admin:admin_id(first_name, last_name)')
                .eq('target_id', id)
                .order('created_at', { ascending: false });

            // Parse Documents
            const parsedService = {
                ...serviceData,
                accreditation_files_metadata: parseDocuments(serviceData.accreditation_files, serviceData.accreditation_files_metadata)
            };

            setService(parsedService);
            setOwner(profileData);
            setHistory(historyData || []);
            setStats({ matches: matchesCount });

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "Failed to load service data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async () => {
        const { action, targetId, notes } = actionDialog;
        if (!action || !targetId) return;

        const status = action === 'verify' ? 'verified' : (action === 'ban' ? 'suspended' : 'rejected');

        try {
            await performAdminAction({
                targetId,
                targetType: 'service',
                action,
                notes
            });

            toast({ title: "Success", description: `Service marked as ${status}.` });
            setActionDialog(prev => ({ ...prev, isOpen: false, notes: '' }));
            fetchData(); // Refresh

        } catch (error: any) {
            console.error("Action error:", error);
            toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
        }
    };

    const handleDocumentReview = async (doc: any, status: 'verified' | 'rejected', notes: string) => {
        if (!viewingDoc) return;
        const { contextId } = viewingDoc;

        const reviewEntry = {
            url: doc.url,
            name: doc.name,
            status,
            notes,
            reviewed_at: new Date().toISOString(),
            reviewer_id: (await supabase.auth.getUser()).data.user?.id
        };

        try {
             const { data: currentData } = await supabase.from('support_services').select('accreditation_files_metadata').eq('id', contextId).single();
             
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

             const { error } = await supabase.from('support_services').update({ accreditation_files_metadata: currentMetadata }).eq('id', contextId);
             if (error) throw error;

             toast({ title: "Success", description: "Document status updated." });
             fetchData();
        } catch (error) {
            console.error("Doc review error:", error);
            toast({ title: "Error", description: "Failed to save document review", variant: "destructive" });
        }
    };

    const openActionDialog = (targetId: string, action: 'verify' | 'reject' | 'ban', targetName: string) => {
        let prefilledNotes = '';
        if (action === 'reject') {
            if (service?.accreditation_files_metadata) {
                const rejectedDocs = service.accreditation_files_metadata.filter(d => d.status === 'rejected');
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

    if (!service) return <div className="p-12 text-center text-serene-neutral-500">Service not found.</div>;

    const unverifiedOwnerWarning = owner && owner.verification_status !== 'verified';

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-32 bg-serene-neutral-50/30 min-h-screen">
            {/* Header */}
            <DetailHeader 
                title={service.name}
                type={Array.isArray(service.service_types) ? service.service_types[0] : service.service_types}
                backUrl="/dashboard/admin/services"
                status={service.verification_status}
                onAction={(action) => openActionDialog(service.id, action, service.name)}
                meta={[
                    <span key="added" className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Added {new Date(service.created_at).toLocaleDateString()}</span>,
                    owner && (
                        <div 
                            key="owner"
                            className="flex items-center gap-1.5 cursor-pointer hover:text-serene-blue-600 transition-colors group pl-4 border-l border-serene-neutral-300"
                            onClick={() => router.push(`/dashboard/admin/professionals/${owner.id}`)}
                        >
                            <Users className="h-3.5 w-3.5" />
                            <span>Owned by {owner.first_name} {owner.last_name}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )
                ].filter(Boolean)}
            />

            {unverifiedOwnerWarning && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 rounded-2xl shadow-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Owner Not Verified</AlertTitle>
                    <AlertDescription>
                        The professional who owns this service ({owner?.first_name} {owner?.last_name}) is currently {owner?.verification_status}.
                        It is recommended to verify the owner before approving their services.
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
                                    {service.accreditation_files_metadata?.length || 0}
                                </span>
                            </div>
                        </CardContent>
                     </Card>
                     
                     {/* Location Preview Card */}
                     <Card className="rounded-[2rem] border-transparent shadow-card bg-white overflow-hidden">
                        <CardHeader className="bg-serene-neutral-50/50 pb-4 border-b border-serene-neutral-50">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-serene-neutral-400">Location</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pb-6 space-y-4">
                            <div className={cn(
                                "aspect-video w-full rounded-xl flex items-center justify-center relative overflow-hidden",
                                service.latitude && service.longitude ? "bg-white border border-serene-neutral-200" : "bg-serene-neutral-50/50 border border-serene-neutral-100"
                            )}>
                                {service.latitude && service.longitude ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        scrolling="no"
                                        marginHeight={0}
                                        marginWidth={0}
                                        src={`https://maps.google.com/maps?q=${service.latitude},${service.longitude}&z=15&output=embed`}
                                        className="absolute inset-0"
                                    ></iframe>
                                ) : (
                                    <div className="text-center">
                                        <div className="h-10 w-10 rounded-full bg-serene-neutral-100 flex items-center justify-center mx-auto mb-2">
                                            <MapPin className="h-5 w-5 text-serene-neutral-400" />
                                        </div>
                                        <p className="text-xs font-medium text-serene-neutral-500">No location data</p>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-serene-neutral-500">Radius</span>
                                    <span className="font-medium text-serene-neutral-900">
                                        {service.coverage_area_radius ? `${(service.coverage_area_radius/1000).toFixed(1)} km` : "N/A"}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                     </Card>
                </div>

                {/* Right Column: Detailed Content */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="details" className="w-full space-y-8">
                        <TabsList className="w-full justify-start border-b border-serene-neutral-200 bg-transparent p-0 gap-8 h-auto">
                            <TabsTrigger value="details" className="pb-4 data-[state=active]:border-serene-blue-600 data-[state=active]:text-serene-blue-700 text-serene-neutral-500 font-medium text-base hover:text-serene-neutral-800 transition-colors border-b-2 border-transparent px-0 rounded-none bg-transparent shadow-none">Service Details</TabsTrigger>
                            <TabsTrigger value="history" className="pb-4 data-[state=active]:border-serene-blue-600 data-[state=active]:text-serene-blue-700 text-serene-neutral-500 font-medium text-base hover:text-serene-neutral-800 transition-colors border-b-2 border-transparent px-0 rounded-none bg-transparent shadow-none">History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                             <Card className="border-transparent shadow-card rounded-[2rem] overflow-hidden bg-white">
                                <CardContent className="space-y-8 p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                        <InfoBlock label="Service Type" value={Array.isArray(service.service_types) ? service.service_types.join(', ') : service.service_types} variant="inline" />
                                        <InfoBlock label="Helpline" value={service.helpline} variant="inline" />
                                        <InfoBlock label="Website" value={service.website} variant="inline" />
                                        <InfoBlock label="Description" value={service.description} fullWidth variant="inline" />
                                    </div>

                                    <div className="pt-6 border-t border-serene-neutral-50">
                                        <h4 className="text-sm font-bold text-serene-neutral-900 mb-6 flex items-center gap-2 uppercase tracking-wide">
                                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                                <FileText className="h-3.5 w-3.5" />
                                            </div>
                                            Service Documents
                                        </h4>
                                        <DocumentsGrid 
                                            documents={service.accreditation_files_metadata || []} 
                                            onView={(doc) => setViewingDoc({ doc, contextId: service.id, contextType: 'service' })}
                                        />
                                    </div>
                                </CardContent>
                             </Card>
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
                            {actionDialog.action === 'verify' ? 'Approve Service' : 
                             actionDialog.action === 'ban' ? 'Suspend Service' : 'Reject Service'}
                        </DialogTitle>
                        
                        <DialogDescription className="text-center text-gray-500 mt-2 text-base">
                            Are you sure you want to {actionDialog.action} service <span className="font-semibold text-gray-900">{actionDialog.targetName}</span>?
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
                contextData={service}
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
