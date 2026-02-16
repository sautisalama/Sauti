"use client";

import { useState } from "react";
import Image from "next/image";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, ZoomIn, ZoomOut, Download, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DocumentReviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	fileUrl: string;
	fileName: string;
	fileType?: string; // 'image' | 'pdf' | 'other'
	onVerify: (notes: string) => void;
	onReject: (notes: string) => void;
    initialNotes?: string;
    initialStatus?: 'verified' | 'rejected' | 'pending';
}

export function DocumentReviewModal({
	isOpen,
	onClose,
	fileUrl,
	fileName,
	fileType = "image",
	onVerify,
	onReject,
    initialNotes = "",
    initialStatus = 'pending'
}: DocumentReviewModalProps) {
	const [notes, setNotes] = useState(initialNotes);
	const [scale, setScale] = useState(1);
    const [status, setStatus] = useState<typeof initialStatus>(initialStatus);

    const isPdf = fileUrl.toLowerCase().endsWith(".pdf") || fileType === 'pdf';
    const isImage = !isPdf; // Simplified logic, refine if needed

    const handleAction = (action: 'verify' | 'reject') => {
        if (action === 'verify') {
            setStatus('verified');
            onVerify(notes);
        } else {
            setStatus('rejected');
            onReject(notes);
        }
    };

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 overflow-hidden flex flex-col md:flex-row bg-serene-neutral-950/95 backdrop-blur-2xl border-serene-neutral-800 text-white">
				
                {/* Left Side: Document Viewer */}
				<div className="flex-1 bg-black/50 relative overflow-hidden flex items-center justify-center p-4">
                    {/* Toolbar */}
                    <div className="absolute top-4 left-4 z-10 flex gap-2 bg-black/40 p-2 rounded-full backdrop-blur-md">
                        <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.25, 3))} className="text-white hover:bg-white/20 rounded-full h-8 w-8">
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.25, 0.5))} className="text-white hover:bg-white/20 rounded-full h-8 w-8">
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20 rounded-full h-8 w-8">
                            <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>

                    {isImage ? (
                        <div 
                            className="relative transition-transform duration-200 ease-out"
                            style={{ transform: `scale(${scale})` }}
                        >
                            {/* Using standard img for easier scaling/handling in this context than Next/Image with layout fill */}
                            <img 
                                src={fileUrl} 
                                alt={fileName} 
                                className="max-w-full max-h-[85vh] object-contain shadow-2xl"
                            />
                        </div>
                    ) : (
                        <iframe 
                            src={`${fileUrl}#toolbar=0`} 
                            className="w-full h-full rounded-lg shadow-2xl bg-white" 
                            title="Document Viewer"
                        />
                    )}
				</div>

				{/* Right Side: Controls */}
				<div className="w-full md:w-[400px] border-l border-white/10 flex flex-col bg-serene-neutral-900">
                    <DialogHeader className="p-6 border-b border-white/10">
                        <DialogTitle className="text-xl font-semibold break-words">{fileName}</DialogTitle>
                        <DialogDescription className="text-serene-neutral-400">
                            Reviewing document details
                        </DialogDescription>
                        <div className="pt-2">
                            {status === 'verified' && <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Verified</Badge>}
                            {status === 'rejected' && <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Rejected</Badge>}
                            {status === 'pending' && <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">Pending Review</Badge>}
                        </div>
                    </DialogHeader>

					<div className="flex-1 p-6 space-y-6 overflow-y-auto">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-serene-neutral-300">Remark / Notes</label>
                            <Textarea 
                                placeholder="Add notes specific to this document..." 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sauti-blue"
                            />
                            <p className="text-xs text-serene-neutral-500">
                                These notes will be saved with the document verification record.
                            </p>
                        </div>
                        
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                            <div className="flex gap-2 text-blue-400 mb-2">
                                <AlertCircle className="h-5 w-5" />
                                <h4 className="font-semibold text-sm">Review Guidelines</h4>
                            </div>
                            <ul className="list-disc list-inside text-xs text-blue-200/70 space-y-1">
                                <li>Ensure text is legible</li>
                                <li>Verify dates are current</li>
                                <li>Check for official stamps/signatures</li>
                                <li>Confirm name matches profile</li>
                            </ul>
                        </div>
					</div>
                    
                    <div className="p-6 border-t border-white/10 bg-black/20 space-y-3">
                        <Button 
                            className="w-full bg-green-600 hover:bg-green-500 text-white"
                            onClick={() => handleAction('verify')}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Document
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-500 hover:text-red-400 border border-red-600/20 hover:border-red-600/50"
                            onClick={() => handleAction('reject')}
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Document
                        </Button>
                    </div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
