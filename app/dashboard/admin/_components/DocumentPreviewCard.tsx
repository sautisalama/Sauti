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

export function DocumentPreviewCard({
	document,
	onClick,
}: DocumentPreviewCardProps) {
	const isImage =
		document.type?.startsWith("image/") ||
		document.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
	const displayName = document.title || document.name || (document as any).fileName || (document as any).file_name || "Untitled";

	return (
		<div
			onClick={onClick}
			className="group relative aspect-[3/4] rounded-2xl border border-serene-neutral-200 bg-white shadow-sm hover:shadow-md hover:border-sauti-teal/30 transition-all cursor-pointer overflow-hidden flex flex-col duration-300"
		>
			{/* Thumbnail Area */}
			<div
				className={cn(
					"flex-1 w-full relative overflow-hidden flex items-center justify-center transition-colors",
					isImage ? "bg-serene-neutral-50" : "bg-sauti-teal-light/20"
				)}
			>
				{isImage ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={document.url}
						alt={displayName}
						className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
					/>
				) : (
					// Updated PDF/File UI: Soft background + centered icon
					<div className="w-full h-full bg-serene-neutral-50 flex flex-col items-center justify-center p-4">
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-serene-neutral-200 flex items-center justify-center text-sauti-teal mb-2 group-hover:scale-110 transition-transform duration-300">
                             <FileText className="h-6 w-6" />
                        </div>
                        <div className="bg-sauti-red-light text-sauti-red px-2 py-0.5 rounded text-[10px] font-bold tracking-tight border border-sauti-red/20 shadow-sm uppercase">
								PDF
						</div>
					</div>
				)}

				{/* Overlay on Hover */}
				<div className="absolute inset-0 bg-sauti-dark/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
					<div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-bold text-sauti-dark shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
						Preview
					</div>
				</div>
			</div>

			{/* Footer Info */}
			<div className="h-16 bg-white border-t border-serene-neutral-100 px-4 py-3 flex items-center justify-between shrink-0 min-h-[44px]">
				<div className="min-w-0 pr-2">
					<p
						className="text-xs font-bold text-sauti-dark truncate"
						title={displayName}
					>
						{displayName}
					</p>
					<p className="text-[10px] text-serene-neutral-500 capitalize truncate font-medium">
						{document.type?.split("/").pop()?.toUpperCase() || "FILE"}
					</p>
				</div>
				<div>
					{document.status === "verified" && (
						<CheckCircle className="h-5 w-5 text-sauti-teal" />
					)}
					{document.status === "rejected" && (
						<XCircle className="h-5 w-5 text-sauti-red" />
					)}
					{/* If no status, show nothing or pending icon? User prefers minimal. */}
				</div>
			</div>

			{/* Status Stripe (Optional, for quick scanning) */}
			{document.status === "verified" && (
				<div className="absolute top-0 left-0 right-0 h-1 bg-sauti-teal" />
			)}
			{document.status === "rejected" && (
				<div className="absolute top-0 left-0 right-0 h-1 bg-sauti-red" />
			)}
		</div>
	);
}
