"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Download, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DocumentViewer({ isOpen, onClose, document, onSaveReview }: {
    isOpen: boolean;
    onClose: () => void;
    document: any;
    onSaveReview: (doc: any, status: 'verified' | 'rejected', notes: string) => void;
}) {
    const [notes, setNotes] = useState("");
    
    if (!document) return null;

    const isImage = document.type?.startsWith("image/") || document.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = document.type === "application/pdf" || document.url?.endsWith(".pdf");

    const handleSave = (status: 'verified' | 'rejected') => {
        onSaveReview(document, status, notes);
        setNotes("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl h-[90vh] flex p-0 overflow-hidden gap-0 border-0 rounded-3xl shadow-2xl bg-serene-neutral-50/50 backdrop-blur-sm">
                <DialogTitle className="sr-only">Review {document.name}</DialogTitle>
                {/* Document View Area */}
                <div className="flex-1 bg-serene-neutral-100/50 relative flex flex-col p-2">
                    <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm mb-2 mx-2 mt-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-10 w-10 rounded-full bg-serene-blue-50 text-serene-blue-600 flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5" />
                            </div>
                            <h3 className="font-bold text-serene-neutral-900 truncate max-w-md">{document.name}</h3>
                        </div>
                        <Button variant="outline" size="sm" asChild className="rounded-xl border-serene-neutral-200 text-serene-neutral-600 hover:text-serene-blue-600 hover:border-serene-blue-200 bg-white">
                            <a href={document.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open External
                            </a>
                        </Button>
                    </div>
                    
                    <div className="flex-1 overflow-auto flex items-center justify-center p-4 rounded-2xl border border-serene-neutral-200/50 bg-white/50 mx-2 mb-2 shadow-inner">
                         {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                                src={document.url} 
                                alt={document.name}
                                className="object-contain max-w-full max-h-full shadow-lg rounded-lg bg-white"
                            />
                        ) : isPdf ? (
                            <iframe 
                                src={`${document.url}#toolbar=0`} 
                                className="w-full h-full shadow-lg rounded-lg bg-white"
                                title={document.name}
                            />
                        ) : (
                            <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-serene-neutral-100">
                                <div className="h-20 w-20 mx-auto bg-serene-neutral-50 rounded-full flex items-center justify-center mb-6">
                                    <FileText className="h-10 w-10 text-serene-neutral-300" />
                                </div>
                                <p className="mb-6 text-serene-neutral-600 font-medium">Preview not available for this file type.</p>
                                <Button variant="outline" asChild className="rounded-xl border-serene-neutral-200 text-serene-neutral-700">
                                    <a href={document.url} download>
                                        <Download className="h-4 w-4 mr-2" />
                                        Download File
                                    </a>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Review Sidebar */}
                <div className="w-80 bg-white border-l border-serene-neutral-100 flex flex-col shrink-0">
                    <div className="p-6 border-b border-serene-neutral-50">
                        <h4 className="font-bold text-lg text-serene-neutral-900">Document Review</h4>
                        <p className="text-xs text-serene-neutral-400 mt-1">Verify document authenticity</p>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col gap-6">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-serene-neutral-700">Audit Remarks</label>
                            <textarea
                                className="w-full min-h-[150px] p-4 text-sm bg-serene-neutral-50 border border-serene-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-serene-blue-400/20 focus:border-serene-blue-400 transition-all resize-none placeholder:text-serene-neutral-400"
                                placeholder="Enter your observations or reasons for rejection..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <div className="mt-auto space-y-3">
                            <Button 
                                className="w-full justify-start bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-100 rounded-xl h-12 font-medium"
                                onClick={() => handleSave('verified')}
                            >
                                <CheckCircle className="h-5 w-5 mr-3" />
                                Approve Document
                            </Button>
                            <Button 
                                className="w-full justify-start bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 rounded-xl h-12 font-medium" 
                                variant="outline"
                                onClick={() => handleSave('rejected')}
                            >
                                <XCircle className="h-5 w-5 mr-3" />
                                Reject Document
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
