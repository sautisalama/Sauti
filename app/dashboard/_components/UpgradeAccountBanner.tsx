"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, Check, Key, AlertTriangle } from "lucide-react";
import { UpgradeAccountDialog } from "./UpgradeAccountDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface UpgradeAccountBannerProps {
	userEmail: string;
}

export function UpgradeAccountBanner({ userEmail }: UpgradeAccountBannerProps) {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(userEmail);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<div className="mb-8">
				<Alert className={cn(
					"border-0 shadow-sm rounded-2xl p-5 sm:p-6 transition-all duration-300",
					"bg-amber-50 text-amber-900"
				)}>
					<div className="flex flex-col sm:flex-row gap-4 sm:items-center">
						<div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-amber-100 text-amber-600">
							<AlertTriangle className="h-6 w-6" />
						</div>
						<div className="flex-1">
							<AlertTitle className="font-bold text-lg mb-1">Temporary Session</AlertTitle>
							<AlertDescription className="text-sm font-medium opacity-80 whitespace-pre-line">
								Your login key is securely generated. Please save it to access this space again.
								<div className="mt-3 flex items-center gap-2">
									<code className="font-mono bg-white px-3 py-1 rounded-md border border-amber-200 text-amber-800 select-all max-w-[200px] sm:max-w-none truncate font-bold shadow-sm">
										{userEmail}
									</code>
									<button 
										onClick={handleCopy} 
										className="p-1.5 hover:bg-amber-100 rounded-md transition-colors text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
										aria-label="Copy login key"
									>
										{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
									</button>
								</div>
								<div className="flex flex-wrap gap-3 mt-4">
									<button 
										onClick={() => setOpen(true)}
										className="inline-flex items-center text-xs font-bold uppercase tracking-wider hover:underline border-b border-current pb-0.5"
									>
										Move to permanent Account <ArrowRight className="h-3 w-3 ml-1" />
									</button>
								</div>
							</AlertDescription>
						</div>
					</div>
				</Alert>
			</div>

			<UpgradeAccountDialog 
				open={open} 
				onOpenChange={setOpen} 
				userEmail={userEmail}
			/>
		</>
	);
}
