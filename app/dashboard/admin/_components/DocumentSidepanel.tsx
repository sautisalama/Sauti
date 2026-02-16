"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Download, ExternalLink, FileText, Calendar, User, Building2, Hash, AlertCircle, Eye, Info, MoreVertical } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DocumentSidepanelProps = {
    isOpen: boolean;
    onClose: () => void;
    document: {
        url: string;
        name: string;
        type: string;
        status?: string;
        notes?: string;
        reviewed_at?: string;
        docNumber?: string;
        issuer?: string;
        [key: string]: any;
    } | null;
    contextData?: any; 
    contextType?: 'profile' | 'service';
    onSaveReview: (doc: any, status: 'verified' | 'rejected', notes: string) => void;
};

export function DocumentSidepanel({ isOpen, onClose, document, contextData, contextType, onSaveReview }: DocumentSidepanelProps) {
    const [notes, setNotes] = useState(document?.notes || "");
    
    // Reset notes when document changes
    useEffect(() => {
        setNotes(document?.notes || "");
    }, [document]);

    if (!document) return null;

    const isImage = document.type?.startsWith("image/") || document.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = document.type === "application/pdf" || document.url?.endsWith(".pdf");

    const handleSave = (status: 'verified' | 'rejected') => {
        onSaveReview(document, status, notes);
        if (status === 'verified') setNotes(""); // Clear notes if verified? Or keep? User said "saved in tables".
        onClose();
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            {/* Widen the sheet to 'sm:max-w-4xl' for better full-width viewing, remove glass effects */}
            <SheetContent side="right" className="w-full sm:max-w-[1000px] p-0 flex flex-col gap-0 border-l border-serene-neutral-200 shadow-xl bg-white z-[100]">
                
                {/* Header - Clean White */}
                <div className="px-6 py-4 border-b border-serene-neutral-200 bg-white flex items-center justify-between shrink-0">
                    <div className="space-y-1">
                        <SheetTitle className="text-lg font-bold text-serene-neutral-900 flex items-center gap-2">
                             {document.name || document.title || "Untitled Document"}
                             {document.status && (
                                <Badge variant="secondary" className={cn(
                                    "ml-2 text-xs font-semibold capitalize rounded-md",
                                    document.status === 'verified' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                                    document.status === 'rejected' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                    "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                )}>
                                    {document.status?.replace('_', ' ')}
                                </Badge>
                             )}
                        </SheetTitle>
                        <SheetDescription className="text-xs text-serene-neutral-500 font-medium tracking-wide uppercase">
                            {contextType === 'profile' ? "Identity Verification" : "Service Accreditation"}
                        </SheetDescription>
                    </div>
                    <div className="flex gap-2">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <MoreVertical className="h-4 w-4 text-serene-neutral-600" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <a href={document.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Open in new tab
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={document.url} download className="cursor-pointer">
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-serene-neutral-100">
                            <XCircle className="h-5 w-5 text-serene-neutral-400" />
                        </Button>
                    </div>
                </div>

                {/* Main Content - Two Column Layout */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    
                    {/* Left: Document Viewer (Full Width on Mobile, 65% on Desktop) */}
                    {/* Added min-h-[50vh] for mobile to ensure visibility */}
                    <div className="h-[50vh] lg:h-auto lg:flex-1 lg:basis-[65%] bg-serene-neutral-200/50 relative overflow-hidden flex flex-col border-b lg:border-b-0 lg:border-r border-serene-neutral-200">
                        {isImage ? (
                            <div className="w-full h-full p-4 flex items-center justify-center overflow-auto bg-checkerboard">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                    src={document.url} 
                                    alt={document.name}
                                    className="max-w-full max-h-full object-contain shadow-sm rounded bg-white"
                                />
                            </div>
                        ) : isPdf ? (
                            <iframe 
                                src={`${document.url}#toolbar=0&view=FitH`} 
                                className="w-full h-full block"
                                title="PDF Viewer"
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="h-20 w-20 rounded-2xl bg-white border border-serene-neutral-200 flex items-center justify-center mb-4 shadow-sm">
                                    <FileText className="h-10 w-10 text-serene-neutral-300" />
                                </div>
                                <h3 className="font-semibold text-serene-neutral-900 mb-1">Preview Unavailable</h3>
                                <p className="text-sm text-serene-neutral-500 mb-6 max-w-xs mx-auto">
                                    This file type cannot be previewed directly. Please download to view.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right: Verification Details & Cross-Check (35% on Desktop) */}
                    {/* Right: Verification Details & Cross-Check (35% on Desktop) */}
                    <div className="flex-1 lg:flex-none lg:basis-[35%] bg-white flex flex-col overflow-y-auto w-full lg:w-auto">
                        <div className="p-6 space-y-8">

                             {/* 1. Document Metadata (From Upload Form) */}
                             <div className="space-y-4">
                                <h4 className="text-xs font-bold text-serene-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5" />
                                    Submitted Details
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-serene-neutral-500">Document Name</Label>
                                        <div className="text-sm font-medium text-serene-neutral-900 bg-serene-neutral-50 p-2.5 rounded-md border border-serene-neutral-100">
                                            {document.name || document.title}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                         <Label className="text-xs font-medium text-serene-neutral-500">Reference / Doc Number</Label>
                                         <div className="text-sm font-medium text-serene-neutral-900 bg-serene-neutral-50 p-2.5 rounded-md border border-serene-neutral-100">
                                            {document.docNumber || document.doc_number || "Not provided"}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                         <Label className="text-xs font-medium text-serene-neutral-500">Issuing Authority</Label>
                                         <div className="text-sm font-medium text-serene-neutral-900 bg-serene-neutral-50 p-2.5 rounded-md border border-serene-neutral-100">
                                            {document.issuer || document.issuing_authority || "Not provided"}
                                        </div>
                                    </div>
                                </div>
                             </div>

                             <div className="h-px bg-serene-neutral-100 w-full" />

                             {/* 2. Verify Against (Profile/Service Context) */}
                             <div className="space-y-4">
                                <h4 className="text-xs font-bold text-serene-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Verify Against
                                </h4>
                                <div className="bg-serene-blue-50/50 rounded-xl border border-serene-blue-100/50 p-4 space-y-4">
                                    {contextType === 'profile' ? (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-serene-neutral-500">Full Name</span>
                                                <span className="text-sm font-medium text-serene-neutral-900 text-right">{contextData?.first_name} {contextData?.last_name}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-serene-neutral-500">Professional Title</span>
                                                <span className="text-sm font-medium text-serene-neutral-900 text-right">{contextData?.professional_title || '-'}</span>
                                            </div>
                                             <div className="flex justify-between items-center">
                                                <span className="text-xs text-serene-neutral-500">Email</span>
                                                <span className="text-sm font-medium text-serene-neutral-900 text-right">{contextData?.email}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-serene-neutral-500">Service Name</span>
                                                <span className="text-sm font-medium text-serene-neutral-900 text-right">{contextData?.name}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-serene-neutral-500">Type</span>
                                                <span className="text-sm font-medium text-serene-neutral-900 text-right">{Array.isArray(contextData?.service_types) ? contextData?.service_types[0] : contextData?.service_types}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                             </div>

                             <div className="h-px bg-serene-neutral-100 w-full" />

                             {/* 3. Decision & Notes */}
                             <div className="space-y-4">
                                <h4 className="text-xs font-bold text-serene-neutral-400 uppercase tracking-widest">Admin Decision</h4>
                                <div className="space-y-3">
                                    <Label className="text-xs text-serene-neutral-600">Verification Notes</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add remarks (e.g., 'Valid until 2025', 'Blurred image')..."
                                        className="min-h-[100px] resize-none bg-white border-serene-neutral-200 focus:border-serene-blue-500 focus:ring-serene-blue-500/20"
                                    />
                                    <p className="text-[10px] text-serene-neutral-400">Notes will be saved to the database.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Button 
                                        className="bg-green-600 hover:bg-green-700 text-white shadow-sm w-full"
                                        onClick={() => handleSave('verified')}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        className="border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 w-full"
                                        onClick={() => handleSave('rejected')}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject
                                    </Button>
                                </div>
                             </div>

                        </div>
                    </div>

                </div>
            </SheetContent>
        </Sheet>
    );
}
