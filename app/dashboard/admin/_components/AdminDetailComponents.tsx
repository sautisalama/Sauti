"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DocumentPreviewCard } from "./DocumentPreviewCard";
import { Building2, User, MapPin, Briefcase, FileText, CheckCircle, XCircle, AlertTriangle, ShieldCheck, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

// Types
export type AccreditationDocument = {
    url: string;
    name: string;
    type: string;
    title?: string;
    fileName?: string;
    file_name?: string;
    status?: string;
    notes?: string;
    docNumber?: string;
    issuer?: string;
    reviewed_at?: string;
    reviewed_by?: string;
    docType?: string;
};

// Premium InfoBlock Component
export function InfoBlock({
	label,
	value,
	fullWidth = false,
	icon,
    variant = "default",
}: {
	label: string;
	value: any;
	fullWidth?: boolean;
	icon?: React.ReactNode;
    variant?: "default" | "inline";
}) {
    if (variant === "inline") {
        return (
            <div className={cn("flex flex-col gap-1", fullWidth ? "col-span-full" : "col-span-1")}>
                <div className="flex items-center gap-1.5 mb-0.5">
                    {icon && <div className="text-sauti-blue">{icon}</div>}
                    <span className="text-[11px] font-bold text-serene-neutral-500 uppercase tracking-widest">
                        {label}
                    </span>
                </div>
                <div className="text-sm font-medium text-serene-neutral-900 break-words leading-relaxed">
                    {value || <span className="text-serene-neutral-400 italic font-normal text-xs">Not provided</span>}
                </div>
            </div>
        );
    }

	return (
		<div
			className={cn(
				"group bg-white rounded-xl p-4 border border-serene-neutral-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-serene-blue-200 flex flex-col justify-center",
				fullWidth ? "col-span-full" : "col-span-1"
			)}
		>
			<div className="flex items-center gap-1.5 mb-1">
				{icon && (
					<div className="text-sauti-blue group-hover:text-sauti-teal transition-colors">
						{icon}
					</div>
				)}
				<span className="text-[10px] font-bold text-sauti-dark/60 uppercase tracking-wider group-hover:text-sauti-dark/80 transition-colors">
					{label}
				</span>
			</div>
			<div className="text-sm font-medium text-sauti-dark break-words leading-snug">
				{value || (
					<span className="text-serene-neutral-400 italic font-normal text-xs">
						Not provided
					</span>
				)}
			</div>
		</div>
	);
}

// Premium DocumentsGrid Component
export function DocumentsGrid({
	documents,
	onView,
}: {
	documents: AccreditationDocument[];
	onView: (doc: AccreditationDocument) => void;
}) {
	if (!documents || documents.length === 0) {
		return (
			<div className="p-6 text-center bg-serene-neutral-50/30 rounded-xl border border-dashed border-serene-neutral-200">
				<div className="h-10 w-10 rounded-full bg-sauti-blue/10 flex items-center justify-center mx-auto mb-2">
                    <FileText className="h-5 w-5 text-sauti-blue" />
                </div>
				<p className="text-xs text-serene-neutral-500 font-medium">
					No documents attached.
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
			{documents.map((doc, idx) => (
				<DocumentPreviewCard
					key={idx}
					document={doc}
					onClick={() => onView(doc)}
				/>
			))}
		</div>
	);
}

// Type for DocumentPreviewCardProps to avoid circular dependency if needed, 
// strictly it uses AccreditationDocument but we need to ensure DocumentPreviewCard is updated too.
// Wait, DocumentPreviewCard is imported in the original file. 
// I need to update DocumentPreviewCard.tsx separately or if it is inside this file?
// Looking at the view_file output from step 486, DocumentPreviewCard is imported from "./DocumentPreviewCard".
// So I should update `app/dashboard/admin/_components/DocumentPreviewCard.tsx`.
// This file `AdminDetailComponents.tsx` only contains InfoBlock, DocumentsGrid, ActionButtons, VerificationStatusBadge, DetailHeader.
// I will update DocumentsGrid here if needed, but the logic seems fine. 
// I need to update `DocumentPreviewCard.tsx` instead. 

// Actually, I will update DocumentPreviewCard.tsx in the NEXT step. 
// For this step I will just confirm I don't need to change `DocumentsGrid` drastically, 
// apart from maybe passing more info, but `AccreditationDocument` type update from step 529 covers it.
// So I will skip changes to `AdminDetailComponents.tsx` for now regarding the card logic, 
// and proceed to update `DocumentPreviewCard.tsx`.

// Wait, the user prompt asked me to update `AdminDetailComponents.tsx` to handle document type display.
// I already updated the TYPE in step 529. 
// `DocumentsGrid` just maps and renders `DocumentPreviewCard`. so `DocumentPreviewCard` does the heavy lifting.
// I will actually cancel this replacement and move to `DocumentPreviewCard.tsx`.

// Premium ActionButtons Component
export function ActionButtons({ 
    status, 
    onAction, 
    size = "default",
    className
}: { 
    status: string, 
    onAction: (action: 'verify' | 'reject' | 'ban') => void, 
    size?: "default" | "sm",
    className?: string
}) {
    const isSmall = size === "sm";
    const isVerified = status === 'verified';
    const isRejected = status === 'rejected';

    return (
        <div className={cn("flex items-center gap-3", className)}>
             {!isRejected && (
                <Button 
                    variant="outline" 
                    size={isSmall ? "sm" : "default"}
                    onClick={() => onAction('reject')}
                    className={cn(
                        "text-serene-neutral-500 hover:text-red-600 hover:bg-red-50 border-serene-neutral-200 hover:border-red-200 transition-all shadow-sm",
                        isSmall ? "h-8 px-3 text-xs" : "h-10 px-4"
                    )}
                >
                    Reject
                </Button>
             )}
             
            <Button 
                size={isSmall ? "sm" : "default"}
                onClick={() => onAction('verify')}
                className={cn(
                    "shadow-md transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
                    isVerified 
                        ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 shadow-none cursor-default hover:scale-100" 
                        : "bg-serene-blue-600 hover:bg-serene-blue-700 text-white",
                    isSmall ? "h-8 px-3 text-xs" : "h-10 px-4 min-w-[100px]"
                )}
                disabled={isVerified}
            >
                {isVerified ? (
                    <span className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" /> Verified
                    </span>
                ) : (
                    "Verify"
                )}
            </Button>
        </div>
    );
}

// Detail Header Badge Helper
export function VerificationStatusBadge({ status }: { status: string }) {
    return (
        <span className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border shadow-sm transition-colors",
            status === 'verified' ? "bg-green-50 text-green-700 border-green-200" :
            status === 'rejected' ? "bg-red-50 text-red-700 border-red-200" :
            status === 'under_review' ? "bg-blue-50 text-blue-700 border-blue-200" :
            "bg-amber-50 text-amber-700 border-amber-200"
        )}>
            {status === 'verified' ? <CheckCircle className="h-3.5 w-3.5" /> :
             status === 'rejected' ? <XCircle className="h-3.5 w-3.5" /> :
             status === 'under_review' ? <ShieldCheck className="h-3.5 w-3.5" /> :
             <AlertTriangle className="h-3.5 w-3.5" />}
            <span className="capitalize">{status?.replace('_', ' ') || 'Pending'}</span>
        </span>
    );
}

// Header Component
export function DetailHeader({ 
    title, 
    type, 
    backUrl, 
    status, 
    onAction, 
    meta = [] 
}: { 
    title: string, 
    type?: string, 
    backUrl: string, 
    status: string, 
    onAction: (action: 'verify' | 'reject' | 'ban') => void,
    meta?: React.ReactNode[]
}) {
    const router = useRouter();

    return (
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-5">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => router.push(backUrl)}
                    className="rounded-full h-10 w-10 bg-white shadow-sm border border-serene-neutral-200 hover:bg-serene-neutral-50 transition-colors mt-1"
                >
                    <ArrowLeft className="h-5 w-5 text-serene-neutral-600" />
                </Button>
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl font-bold text-serene-neutral-900 tracking-tight">
                            {title}
                        </h1>
                        {type && (
                            <Badge variant="secondary" className="text-sm font-normal bg-serene-neutral-100 text-serene-neutral-600 capitalize px-2.5 py-0.5">
                                {type}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-serene-neutral-500 text-sm mt-3 font-medium">
                        {meta.map((item, index) => (
                             <div key={index} className="flex items-center gap-1.5">
                                {item}
                             </div>
                        ))}
                        <div className="h-1 w-1 rounded-full bg-serene-neutral-300"></div>
                        <VerificationStatusBadge status={status} />
                    </div>
                </div>
            </div>
            
            <ActionButtons 
                status={status} 
                onAction={onAction}
                className="self-end md:self-auto"
            />
        </div>
    );
}
