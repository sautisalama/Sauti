
"use client";

import { useState } from "react";
import { 
	Dialog, 
	DialogContent, 
	DialogHeader, 
	DialogTitle, 
	DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
	Accordion, 
	AccordionContent, 
	AccordionItem, 
	AccordionTrigger 
} from "@/components/ui/accordion";
import { POLICIES, PolicySection } from "../_views/PolicyContent";
import { Shield, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { mergeSettings, type UserSettings } from "@/lib/user-settings";

interface PolicyModalProps {
	userId: string;
	initialPolicies: any;
	onAccepted: () => void;
}

export function PolicyModal({ userId, initialPolicies, onAccepted }: PolicyModalProps) {
	const supabase = createClient();
	const [acceptedPolicies, setAcceptedPolicies] = useState<string[]>(
		initialPolicies?.accepted_policies || []
	);
	const [saving, setSaving] = useState(false);

	// For anonymous survivors, we show Terms, Privacy, and Survivor Safety
	const relevantPolicies = POLICIES.filter(p => 
		['terms', 'privacy', 'survivor_safety'].includes(p.id)
	);

	const allAccepted = relevantPolicies.every(p => acceptedPolicies.includes(p.id));

	const handleAccept = async () => {
		if (!allAccepted) return;
		
		setSaving(true);
		try {
			const policyData = {
				accepted_policies: acceptedPolicies,
				all_policies_accepted: true,
				policies_accepted_at: new Date().toISOString(),
			};

			await supabase
				.from("profiles")
				.update({
					policies: policyData as any,
				})
				.eq("id", userId);
			
			onAccepted();
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={true}>
			<DialogContent 
				className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-0 rounded-[2.5rem] shadow-2xl bg-white"
				onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader className="p-8 pb-4 text-center bg-serene-blue-50/20 shrink-0">
					<div className="mx-auto w-12 h-12 bg-serene-blue-100 rounded-full flex items-center justify-center mb-4">
						<Shield className="h-6 w-6 text-serene-blue-600" />
					</div>
					<DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
						Security & Privacy Agreement
					</DialogTitle>
					<DialogDescription className="text-sm font-medium text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
						To ensure your safety and the security of your data, please review and accept our core platform policies.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
					<Accordion type="single" collapsible className="w-full space-y-4">
						{relevantPolicies.map((policy) => {
							const isAccepted = acceptedPolicies.includes(policy.id);
							return (
								<AccordionItem 
									key={policy.id} 
									value={policy.id} 
									className={cn(
										"border rounded-[1.5rem] px-5 transition-all duration-300",
										isAccepted ? "bg-emerald-50/30 border-emerald-100" : "bg-white border-slate-100"
									)}
								>
									<AccordionTrigger className="hover:no-underline py-5">
										<div className="flex items-center gap-4 text-left">
											{isAccepted ? (
												<div className="p-2 bg-emerald-100 rounded-full">
													<Check className="h-4 w-4 text-emerald-600" />
												</div>
											) : (
												<div className="p-2 bg-slate-100 rounded-full">
													<AlertTriangle className="h-4 w-4 text-slate-400" />
												</div>
											)}
											<span className={cn(
												"font-bold text-base tracking-tight",
												isAccepted ? "text-emerald-900" : "text-slate-900"
											)}>
												{policy.title}
											</span>
										</div>
									</AccordionTrigger>
									<AccordionContent className="pb-6">
										<div className="space-y-5 text-slate-600 font-medium leading-relaxed mb-6">
											{policy.sections.map((section: PolicySection, idx: number) => (
												<div key={idx} className="space-y-2">
													<h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">{section.title}</h4>
													{section.content.map((p, pIdx) => (
														<p key={pIdx} className="text-sm">{p}</p>
													))}
												</div>
											))}
										</div>
										<Button
											size="sm"
											onClick={() => {
												if (!isAccepted) {
													setAcceptedPolicies(prev => [...prev, policy.id]);
												}
											}}
											className={cn(
												"w-full rounded-xl transition-all font-bold uppercase tracking-widest text-[11px] h-10",
												isAccepted 
													? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default shadow-none" 
													: "bg-teal-600 text-white hover:bg-teal-700 shadow-md"
											)}
										>
											{isAccepted ? "Policy Accepted" : "Accept Policy"}
										</Button>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>

					{!allAccepted && (
						<div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-[1.5rem] flex items-start gap-4">
							<AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
							<p className="text-xs font-medium text-amber-800 leading-relaxed">
								You must accept all policies before you can access your dashboard. Your safety and privacy are our highest priorities.
							</p>
						</div>
					)}
				</div>

				<div className="p-8 pt-4 border-t border-slate-50 bg-white/80 backdrop-blur-sm shrink-0">
					<Button
						onClick={handleAccept}
						disabled={!allAccepted || saving}
						className="w-full bg-slate-900 hover:bg-black text-white font-black h-14 rounded-2xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-[0.1em] text-xs disabled:opacity-50"
					>
						{saving ? "Securing Session..." : "Enter Support Space"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
