"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, Check, Key } from "lucide-react";
import { UpgradeAccountDialog } from "./UpgradeAccountDialog";

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
			{/* Compact, non-intrusive banner */}
			<div className="mb-8">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 pr-4 bg-amber-50/50 border border-amber-100/60 rounded-2xl backdrop-blur-sm">
					<div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
						<div className="h-10 w-10 shrink-0 bg-white rounded-xl flex items-center justify-center shadow-sm border border-amber-100 text-amber-500">
							<Key className="h-5 w-5" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-0.5">
								Temporary Session
							</p>
							<div className="flex items-center gap-2 text-xs text-amber-700/80">
								<span className="shrink-0 opacity-70">Login Key:</span>
								<code className="font-mono bg-white px-2 py-0.5 rounded border border-amber-100 text-amber-800 select-all truncate max-w-[180px] sm:max-w-none">
									{userEmail}
								</code>
								<button 
									onClick={handleCopy} 
									className="p-1 hover:bg-amber-100 rounded-md transition-colors text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
									aria-label="Copy login key"
								>
									{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
								</button>
							</div>
						</div>
					</div>

					<Button 
						onClick={() => setOpen(true)}
						size="sm"
						variant="ghost"
						className="w-full sm:w-auto whitespace-nowrap bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 hover:border-amber-300 text-xs font-bold h-9 rounded-xl shadow-sm px-4 transition-all"
					>
						Move to permanent Account <ArrowRight className="h-3 w-3 ml-1.5 opacity-60" />
					</Button>
				</div>
			</div>

			<UpgradeAccountDialog 
				open={open} 
				onOpenChange={setOpen} 
				userEmail={userEmail}
			/>
		</>
	);
}
