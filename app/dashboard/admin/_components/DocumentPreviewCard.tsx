"use client";

import { FileText, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentPreviewCardProps = {
    document: {
        url: string;
        name: string;
        type: string;
        status?: string;
        title?: string; // Optional title from metadata
    };
    onClick: () => void;
};

export function DocumentPreviewCard({ document, onClick }: DocumentPreviewCardProps) {
    const isImage = document.type?.startsWith("image/") || document.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const displayName = document.title || document.name || "Untitled";

    return (
        <div 
            onClick={onClick}
            className="group relative aspect-[3/4] rounded-xl border border-transparent bg-white shadow-sm hover:shadow-premium hover:border-sauti-teal/20 transition-all cursor-pointer overflow-hidden flex flex-col hover:-translate-y-1 duration-300"
        >
            {/* Thumbnail Area */}
            <div className={cn(
                "flex-1 w-full relative overflow-hidden flex items-center justify-center transition-colors",
                isImage ? "bg-serene-neutral-50" : "bg-sauti-teal-light/20"
            )}>
                {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                        src={document.url} 
                        alt={displayName}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    // Simulated PDF Page
                    <div className="w-[60%] h-[80%] bg-white shadow-card border border-serene-neutral-200 rounded-[4px] p-3 flex flex-col gap-2 transform transition-transform duration-300 group-hover:-translate-y-1 relative">
                        {/* Decorative Corner Fold (CSS trick or simple overlay) */}
                        <div className="absolute top-0 right-0 p-1">
                            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-serene-neutral-100/50 shadow-sm" />
                        </div>

                        {/* Header Lines */}
                        <div className="h-1.5 w-[40%] bg-sauti-teal/20 rounded-sm mb-1" />
                        <div className="h-px w-full bg-serene-neutral-100" />
                        {/* Body Lines */}
                        <div className="space-y-1.5 mt-1 opacity-60">
                            <div className="h-1 w-full bg-serene-neutral-100 rounded-sm" />
                            <div className="h-1 w-[90%] bg-serene-neutral-100 rounded-sm" />
                            <div className="h-1 w-[95%] bg-serene-neutral-100 rounded-sm" />
                            <div className="h-1 w-[60%] bg-serene-neutral-100 rounded-sm" />
                        </div>
                        <div className="space-y-1.5 mt-2 opacity-60">
                             <div className="h-1 w-full bg-serene-neutral-100 rounded-sm" />
                             <div className="h-1 w-[80%] bg-serene-neutral-100 rounded-sm" />
                        </div>
                         {/* PDF Icon Badge */}
                        <div className="mt-auto self-end">
                             <div className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tighter border border-red-100/50">PDF</div>
                        </div>
                    </div>
                )}
                
                {/* Overlay on Hover */}
                <div className="absolute inset-0 bg-serene-neutral-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-serene-neutral-700 shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        Preview
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="h-14 bg-white border-t border-serene-neutral-100 px-3 py-2 flex items-center justify-between shrink-0">
                <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-serene-neutral-900 truncate" title={displayName}>
                        {displayName}
                    </p>
                    <p className="text-[10px] text-serene-neutral-400 capitalize truncate">
                         {document.type?.split('/').pop()?.toUpperCase() || 'FILE'}
                    </p>
                </div>
                <div>
                     {document.status === 'verified' && <CheckCircle className="h-4 w-4 text-green-500" />}
                     {document.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                     {/* If no status, show nothing or pending icon? User prefers minimal. */}
                </div>
            </div>
            
            {/* Status Stripe (Optional, for quick scanning) */}
            {document.status === 'verified' && <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />}
            {document.status === 'rejected' && <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />}
        </div>
    );
}
