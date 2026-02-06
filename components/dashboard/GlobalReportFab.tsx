"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { cn } from "@/lib/utils";

interface GlobalReportFabProps {
	userId?: string;
}

export function GlobalReportFab({ userId }: GlobalReportFabProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isExpanded, setIsExpanded] = useState(true);

	// Auto-collapse after 30 seconds
	useEffect(() => {
		const timer = setTimeout(() => {
			setIsExpanded(false);
		}, 30000);

		return () => clearTimeout(timer);
	}, []);

	if (!userId) return null;

	return (
		<div className="fixed bottom-6 right-6 z-50">
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetTrigger asChild>
					<div
						onMouseEnter={() => setIsExpanded(true)}
						onMouseLeave={() => setIsExpanded(false)}
					>
						<Button
							className={cn(
								"h-14 rounded-full bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-xl shadow-serene-blue-200 hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3 font-bold text-lg",
								isExpanded ? "px-8" : "w-14 px-0 justify-center"
							)}
						>
							<Plus className="h-6 w-6" />
							<span
								className={cn(
									"whitespace-nowrap overflow-hidden transition-all duration-300",
									isExpanded ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"
								)}
							>
								New Report
							</span>
						</Button>
					</div>
				</SheetTrigger>
				<SheetContent
					side="right"
					className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 border-0 bg-transparent shadow-2xl overflow-hidden"
				>
					<SheetTitle className="sr-only">New Report Form</SheetTitle>
					<div className="h-full flex flex-col bg-white/95 backdrop-blur-sm">
						<AuthenticatedReportAbuseForm
							onClose={() => setIsOpen(false)}
							userId={userId}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
