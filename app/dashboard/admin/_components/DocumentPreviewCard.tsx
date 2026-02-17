// ... imports
import { FileText, CheckCircle, XCircle, Eye, AlertCircle, CreditCard, Award, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentPreviewCardProps = {
    document: {
        url: string;
        name: string;
        type: string;
        status?: string; // Type 'string' is too loose, but matches usage
        title?: string;
        fileName?: string;
        file_name?: string;
        docType?: string;
        issuer?: string;
        docNumber?: string;
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

    // Icon based on docType
    const getIcon = () => {
        switch(document.docType) {
            case 'Identity': return <CreditCard className="h-6 w-6" />;
            case 'License': return <Award className="h-6 w-6" />;
            case 'Certificate': return <ScrollText className="h-6 w-6" />;
            default: return <FileText className="h-6 w-6" />;
        }
    };

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
                             {getIcon()}
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
			<div className="h-auto min-h-[64px] bg-white border-t border-serene-neutral-100 px-4 py-3 flex flex-col justify-center shrink-0">
                <div className="flex items-start justify-between w-full mb-1">
                     <p
						className="text-xs font-bold text-sauti-dark truncate flex-1 pr-2"
						title={displayName}
					>
						{displayName}
					</p>
                    {document.status === "verified" && (
						<CheckCircle className="h-4 w-4 text-sauti-teal shrink-0" />
					)}
					{document.status === "rejected" && (
						<XCircle className="h-4 w-4 text-sauti-red shrink-0" />
					)}
                </div>
               
                {/* Secondary Info (Type/Issuer) */}
                <div className="text-[10px] text-serene-neutral-500 font-medium truncate">
                     {document.docType ? (
                         <span className="capitalize text-sauti-blue/80">{document.docType}</span>
                     ) : (
                         <span className="capitalize">{document.type?.split("/").pop()?.toUpperCase() || "FILE"}</span>
                     )}
                     {document.issuer && (
                         <span className="text-serene-neutral-400"> • {document.issuer}</span>
                     )}
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
