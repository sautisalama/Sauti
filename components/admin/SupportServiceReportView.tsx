"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
    Building2, MapPin, Phone, Mail, Globe, Clock, Shield, AlertTriangle, 
    FileText, CheckCircle, XCircle, History, User 
} from "lucide-react";
import { Service } from "@/types/admin-types";
import { DocumentReviewModal } from "./DocumentReviewModal";

interface SupportServiceReportViewProps {
    service: Service | null;
    isOpen: boolean;
    onClose: () => void;
    onVerify: (id: string, notes: string) => void;
    onReject: (id: string, notes: string) => void;
    onBan: (id: string, reason: string) => void;
}

export function SupportServiceReportView({
    service,
    isOpen,
    onClose,
    onVerify,
    onReject,
    onBan
}: SupportServiceReportViewProps) {
    const [selectedDoc, setSelectedDoc] = useState<{url: string, name: string} | null>(null);
    const [actionNotes, setActionNotes] = useState("");

    if (!service) return null;

    const documents = service.accreditation_files_metadata || []; // Standardized to metadata
    // If accreditation_files is just URLs or a different structure, we'd adapt here.
    // For now mocking/adapting based on likely structure.
    
    // safe parsing of docs if needed
    const parsedDocs = Array.isArray(documents) ? documents : [];

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent side="right" className="w-[90vw] sm:w-[600px] sm:max-w-[600px] p-0 flex flex-col h-full bg-white dark:bg-neutral-900 border-l shadow-2xl">
                    
                    {/* Header */}
                    <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-white shadow-lg rounded-xl">
                                    <AvatarImage src={service.profile_image_url || ""} />
                                    <AvatarFallback className="rounded-xl text-lg bg-sauti-blue text-white">
                                        {service.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <SheetTitle className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                                        {service.name}
                                    </SheetTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="capitalize bg-white text-neutral-600 border-neutral-300">
                                            {service.service_types.replace('_', ' ')}
                                        </Badge>
                                        <Badge className={`
                                            capitalize border-0
                                            ${service.verification_status === 'verified' ? 'bg-green-100 text-green-700' : ''}
                                            ${service.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                                            ${service.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : ''}
                                        `}>
                                            {service.verification_status}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="flex items-center gap-2 text-neutral-600">
                                <User className="h-4 w-4" />
                                <span className="truncate">{service.profile_name || 'Unknown Provider'}</span>
                                {service.profiles && (service.profiles as any).verification_status !== 'verified' && (
                                     <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 pb-1">
                                        Unverified Provider
                                     </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-neutral-600">
                                <Clock className="h-4 w-4" />
                                <span>Joined {new Date(service.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Scrollable Area */}
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-8">
                            
                            {/* Contact & Location */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Contact & Location</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {service.phone && (
                                        <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                                            <Phone className="h-4 w-4 text-sauti-blue" />
                                            <span className="text-sm font-medium">{service.phone}</span>
                                        </div>
                                    )}
                                    {service.email && (
                                        <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                                            <Mail className="h-4 w-4 text-sauti-blue" />
                                            <span className="text-sm font-medium">{service.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                                        <MapPin className="h-4 w-4 text-sauti-blue shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium block">
                                                {service.latitude && service.longitude 
                                                    ? `${service.latitude.toFixed(4)}, ${service.longitude.toFixed(4)}`
                                                    : 'No location set'
                                                }
                                            </span>
                                            {service.coverage_area_radius && (
                                                <span className="text-xs text-neutral-500 block">
                                                    Coverage Radius: {service.coverage_area_radius}km
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                             {/* Documents Section */}
                             <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Verification Documents</h3>
                                    <Badge variant="secondary">{parsedDocs.length} Files</Badge>
                                </div>

                                {parsedDocs.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {parsedDocs.map((doc: any, i: number) => (
                                            <button 
                                                key={i}
                                                className="group relative flex flex-col items-center justify-center p-4 border-2 border-dashed border-neutral-200 rounded-xl hover:border-sauti-blue hover:bg-blue-50/50 transition-all text-center"
                                                onClick={() => setSelectedDoc({
                                                    url: doc.url || doc, // Handle both object and string
                                                    name: doc.name || `Document ${i + 1}`
                                                })}
                                            >
                                                <div className="h-10 w-10 mb-2 rounded-full bg-blue-100 flex items-center justify-center text-sauti-blue group-hover:scale-110 transition-transform">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <span className="text-xs font-medium text-neutral-700 truncate w-full px-2">
                                                    {doc.name || `Document ${i + 1}`}
                                                </span>
                                                <span className="text-[10px] text-neutral-400">Click to review</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 bg-neutral-50 rounded-xl border border-neutral-100 text-neutral-400">
                                        <FileText className="h-8 w-8 mb-2 opacity-50" />
                                        <span className="text-sm">No documents uploaded</span>
                                        <p className="text-xs mt-1 text-center max-w-[200px]">
                                            Request documents from the provider to proceed with verification
                                        </p>
                                    </div>
                                )}
                            </section>

                            {/* Audit Trail / History */}
                            {service.reviewed_by && (
                                <section className="space-y-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Review History</h3>
                                    <div className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center
                                                ${service.reviewed_by.action === 'verify' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                                            `}>
                                                {service.reviewed_by.action === 'verify' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {service.reviewed_by.action === 'verify' ? 'Verified' : 'Rejected'} by Admin
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {new Date(service.reviewed_by.date).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        {service.reviewed_by.notes && (
                                            <div className="ml-11 p-3 bg-neutral-50 rounded-lg text-sm text-neutral-700 italic border border-neutral-100">
                                                "{service.reviewed_by.notes}"
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-neutral-200 bg-white space-y-3">
                        {service.profiles && (service.profiles as any).verification_status !== 'verified' && service.verification_status !== 'verified' && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Provider must be verified before service can be approved.</span>
                            </div>
                        )}
                        
                        {service.verification_status !== 'verified' && (
                            <Button 
                                className="w-full bg-sauti-blue hover:bg-sauti-dark text-white shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                                size="lg"
                                onClick={() => onVerify(service.id, "Verified via Report View")}
                                disabled={service.profiles && (service.profiles as any).verification_status !== 'verified'}
                            >
                                <CheckCircle className="mr-2 h-5 w-5" />
                                Verify Service & Documents
                            </Button>
                        )}
                        
                        {service.verification_status === 'verified' && (
                             <Button 
                                variant="outline"
                                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300" 
                                size="lg"
                                onClick={() => onReject(service.id, "Revoked verification")}
                            >
                                <AlertTriangle className="mr-2 h-5 w-5" />
                                Revoke Verification
                            </Button>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" onClick={onClose}>
                                Close
                            </Button>
                            <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                <History className="mr-2 h-4 w-4" />
                                View Full Log
                            </Button>
                        </div>
                    </div>

                </SheetContent>
            </Sheet>

            {/* Nested Document Viewer */}
            {selectedDoc && (
                <DocumentReviewModal
                    isOpen={!!selectedDoc}
                    onClose={() => setSelectedDoc(null)}
                    fileUrl={selectedDoc.url}
                    fileName={selectedDoc.name}
                    onVerify={() => {}} // Could hook up to document specific verification endpoint
                    onReject={() => {}}
                />
            )}
        </>
    );
}
