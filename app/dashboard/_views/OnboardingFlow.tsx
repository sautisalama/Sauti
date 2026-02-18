"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { Database } from "@/types/db-schema";
import { 
	Stethoscope, 
	Brain, 
	Scale, 
	FileText, 
	ShieldCheck, 
	Gavel, 
	HeartHandshake, 
	Building2, 
	Users,
    Shield,
	Check,
	AlertTriangle,
	ArrowRight
} from "lucide-react";
import { 
	Accordion, 
	AccordionContent, 
	AccordionItem, 
	AccordionTrigger 
} from "@/components/ui/accordion";
import { POLICIES, Policy, PolicySection } from "./PolicyContent";
import { cn } from "@/lib/utils";
import { parsePolicies } from "@/lib/user-settings";

interface Step {
	id: string;
	title: string;
	description: string;
}

const steps: Step[] = [
	{
		id: "role",
		title: "Role",
		description: "Choose reflect your role.",
	},
	{
		id: "policies",
		title: "Safety & Legal Policies",
		description: "Review and accept our safety and legal frameworks.",
	},
	{
		id: "about",
		title: "About You",
		description: "Briefly describe your background and mission.",
	},
	{
		id: "services",
		title: "Services",
		description: "List the services you provide to the community.",
	}
];

const titleConfigs: Record<string, { icon: any, color: string, bgColor: string, activeColor: string }> = {
	'Doctor': { icon: Stethoscope, color: 'text-cyan-600', bgColor: 'bg-cyan-50/50', activeColor: 'bg-cyan-600' },
	'Mental health expert': { icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50/50', activeColor: 'bg-purple-600' },
	'Lawyer': { icon: Scale, color: 'text-amber-600', bgColor: 'bg-amber-50/50', activeColor: 'bg-amber-600' },
	'Paralegal': { icon: FileText, color: 'text-emerald-600', bgColor: 'bg-emerald-50/50', activeColor: 'bg-emerald-600' },
	'Human rights defender': { icon: ShieldCheck, color: 'text-indigo-600', bgColor: 'bg-indigo-50/50', activeColor: 'bg-indigo-600' },
	'Law firm': { icon: Gavel, color: 'text-amber-600', bgColor: 'bg-amber-50/50', activeColor: 'bg-amber-600' },
	'Rescue Center': { icon: HeartHandshake, color: 'text-rose-600', bgColor: 'bg-rose-50/50', activeColor: 'bg-rose-600' },
	'Hospital/Clinic': { icon: Building2, color: 'text-cyan-600', bgColor: 'bg-cyan-50/50', activeColor: 'bg-cyan-600' },
	'Local NGO': { icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-50/50', activeColor: 'bg-emerald-600' },
};

export default function OnboardingFlow() {
	const user = useUser();
	const supabase = createClient();
	const [stepIndex, setStepIndex] = useState(0);
	const [saving, setSaving] = useState(false);
	const router = useRouter();

	const [profile, setProfile] = useState<{
		first_name: string;
		last_name: string;
		phone: string;
		professional_title: string;
		bio: string;
		is_public_booking: boolean;
		user_type: Database["public"]["Enums"]["user_type"] | null;
		accepted_policies: string[];
	}>({
		first_name: "",
		last_name: "",
		phone: "",
		professional_title: "",
		bio: "",
		is_public_booking: false,
		user_type: null,
		accepted_policies: [],
	});

	// Track if we've already done the initial check to avoid skipping steps twice if we manually go back
	const [hasResumed, setHasResumed] = useState(false);

	useEffect(() => {
		if (user?.profile && !hasResumed) {
			const policies = parsePolicies(user.profile.policies);
			setProfile({
				first_name: user.profile.first_name || "",
				last_name: user.profile.last_name || "",
				phone: user.profile.phone || "",
				professional_title: user.profile.professional_title || "",
				bio: user.profile.bio || "",
				is_public_booking: Boolean(user.profile.is_public_booking),
				user_type: user.profile.user_type || null,
				accepted_policies: policies.accepted_policies || [],
			});

			// Only resume once on load
			if (user.profile.user_type && stepIndex === 0) {
				const uType = user.profile.user_type;
				const isProfessionalOrNGO = uType === 'professional' || uType === 'ngo';
				const hasAcceptedAll = policies.all_policies_accepted; 

				if (hasAcceptedAll) {
					if (isProfessionalOrNGO) {
						setStepIndex(2); // Skip Role and Policies
					} else {
						// Registered survivors who are here somehow
						setStepIndex(1); 
					}
				} else {
					// Role selected but policies not accepted
					setStepIndex(1);
				}
				setHasResumed(true);
			}
		}
	}, [user?.profile, hasResumed]);

	const isPro =
		profile.user_type === "professional" ||
		profile.user_type === "ngo";

	const filteredSteps = steps.filter((step) => {
		if (!isPro && (step.id === "about" || step.id === "services")) {
			return false;
		}
		return true;
	});

	const isLastStep = stepIndex === filteredSteps.length - 1;

	const next = async () => {
		const current = filteredSteps[stepIndex]?.id;
		try {
			if (!user?.id) return setStepIndex((i) => Math.min(i + 1, filteredSteps.length - 1));
			setSaving(true);
			
			const policyUpdate = {
				accepted_policies: profile.accepted_policies,
				all_policies_accepted: current === 'policies' ? allPoliciesAccepted : parsePolicies(user.profile?.policies).all_policies_accepted,
				policies_accepted_at: current === 'policies' && allPoliciesAccepted ? new Date().toISOString() : parsePolicies(user.profile?.policies).policies_accepted_at
			};

			// Always sync current state to DB on Next
			await supabase
				.from("profiles")
				.update({
					first_name: profile.first_name || null,
					last_name: profile.last_name || null,
					phone: profile.phone || null,
					professional_title: profile.professional_title || null,
					bio: profile.bio || null,
					is_public_booking: profile.is_public_booking,
					user_type: profile.user_type,
					policies: policyUpdate as any
				})
				.eq("id", user.id);

			if (isLastStep) {
				router.refresh();
				return;
			}

		} finally {
			setSaving(false);
			if (!isLastStep) {
				setStepIndex((i) => Math.min(i + 1, filteredSteps.length - 1));
			}
		}
	};

	const back = () => setStepIndex((i) => Math.max(i - 1, 0));

	// Safety: Ensure stepIndex is always within bounds of filteredSteps
	const safeStepIndex = Math.min(stepIndex, Math.max(0, filteredSteps.length - 1));

	// Filter policies based on role
	const getRelevantPolicies = () => {
		const base = POLICIES.filter(p => p.id === 'terms' || p.id === 'privacy');
		if (profile.user_type === 'survivor') return [...base, POLICIES.find(p => p.id === 'survivor_safety')!];
		if (profile.user_type === 'professional') return [...base, POLICIES.find(p => p.id === 'professional_conduct')!];
		if (profile.user_type === 'ngo') return [...base, POLICIES.find(p => p.id === 'professional_conduct')!, POLICIES.find(p => p.id === 'referral_policy')!];
		return base; // Default before role selection
	};

	const relevantPolicies = getRelevantPolicies();
	const allPoliciesAccepted = relevantPolicies.every(p => profile.accepted_policies.includes(p.id));

	const PoliciesStep = (
		<Card className="bg-white border-serene-neutral-100 shadow-premium rounded-[2.5rem] overflow-hidden max-h-full flex flex-col">
			<CardHeader className="text-center pt-5 pb-2 bg-serene-blue-50/20 shrink-0">
				<div className="mx-auto w-12 h-12 bg-serene-blue-100 rounded-full flex items-center justify-center mb-2">
					<Shield className="h-6 w-6 text-serene-blue-600" />
				</div>
				<CardTitle className="text-lg md:text-2xl font-bold text-serene-neutral-900 tracking-tight">
					Legal & Safety Framework
				</CardTitle>
				<p className="text-[10px] md:text-xs font-medium text-serene-neutral-500 max-w-xs mx-auto mt-0.5 px-4 leading-normal">
					Please review and accept our core policies to continue.
				</p>
			</CardHeader>
			<CardContent className="p-3 md:p-6 flex-1 overflow-y-auto no-scrollbar">
				<Accordion type="single" collapsible className="w-full space-y-3">
					{relevantPolicies.map((policy) => {
						const isAccepted = profile.accepted_policies.includes(policy.id);
						return (
							<AccordionItem 
								key={policy.id} 
								value={policy.id} 
								className={cn(
									"border rounded-2xl px-4 transition-all duration-300",
									isAccepted ? "bg-serene-green-50/30 border-serene-green-100" : "bg-white border-serene-neutral-100"
								)}
							>
								<AccordionTrigger className="hover:no-underline py-4">
									<div className="flex items-center gap-3 text-left">
										{isAccepted ? (
											<div className="p-1.5 bg-serene-green-100 rounded-full">
												<Check className="h-3 w-3 text-serene-green-600" />
											</div>
										) : (
											<div className="p-1.5 bg-serene-neutral-100 rounded-full">
												<AlertTriangle className="h-3 w-3 text-serene-neutral-400" />
											</div>
										)}
										<span className={cn(
											"font-bold text-sm tracking-tight",
											isAccepted ? "text-serene-green-900" : "text-serene-neutral-900"
										)}>
											{policy.title}
										</span>
									</div>
								</AccordionTrigger>
								<AccordionContent className="pb-4">
									<div className="space-y-4 max-w-none text-serene-neutral-600 font-medium leading-relaxed mb-4">
										{policy.sections.map((section: PolicySection, idx: number) => (
											<div key={idx} className="space-y-1.5">
												<h4 className="text-xs font-black text-serene-neutral-900 uppercase tracking-wider">{section.title}</h4>
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
												setProfile(p => ({
													...p,
													accepted_policies: [...p.accepted_policies, policy.id]
												}));
											}
										}}
										className={cn(
											"w-full rounded-xl transition-all font-bold uppercase tracking-widest text-[10px]",
											isAccepted 
												? "bg-serene-green-100 text-serene-green-700 hover:bg-serene-green-100 cursor-default" 
												: "bg-serene-blue-600 text-white hover:bg-serene-blue-700 shadow-md"
										)}
									>
										{isAccepted ? "Policy Accepted" : "Read & Accept"}
									</Button>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
				
				{!allPoliciesAccepted && (
					<div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
						<AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
						<p className="text-[10px] font-medium text-amber-800 leading-normal">
							You must read and accept all relevant policies before you can access the dashboard. We take your data and safety seriously.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);

	const Role = (
		<Card className="bg-white border-serene-neutral-100 shadow-premium rounded-[2.5rem] overflow-hidden max-h-full flex flex-col">
			<CardHeader className="text-center pt-5 pb-2 bg-serene-blue-50/20 shrink-0">
				<CardTitle className="text-lg md:text-2xl font-bold text-serene-neutral-900 tracking-tight">
					Choose Your Role
				</CardTitle>
				<p className="text-[10px] md:text-xs font-medium text-serene-neutral-500 max-w-xs mx-auto mt-0.5 px-4 leading-normal">
					Select the role that best describes your needs.
				</p>
			</CardHeader>
			<CardContent className="p-3 md:p-8 flex-1 overflow-y-auto no-scrollbar">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
					{/* Survivor Tile */}
					<div
						className={`cursor-pointer rounded-[1.5rem] border-2 p-3 md:p-6 text-center transition-all duration-300 group relative overflow-hidden bg-white h-full flex flex-col justify-center ${
							profile.user_type === "survivor"
								? "border-serene-blue-500 shadow-xl ring-2 ring-serene-blue-500/10"
								: "border-serene-neutral-100 hover:border-serene-blue-200"
						}`}
						onClick={() => setProfile(p => ({ ...p, user_type: "survivor" }))}
					>
						<div className="flex flex-row sm:flex-col items-center gap-3 sm:gap-4 relative z-10">
							<div className="w-12 sm:w-16 aspect-square relative flex justify-center items-center bg-serene-blue-50 rounded-[1rem] shadow-sm border border-serene-blue-100 transition-all duration-500 group-hover:bg-serene-blue-100/50">
								<Image
									src="/icons/survivor-light.png"
									alt="Survivor"
									className="object-contain p-2"
									height={60}
									width={60}
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-bold text-serene-neutral-900 left sm:text-center group-hover:text-serene-blue-600 transition-colors">
									Survivor
								</h3>
								<p className="text-[10px] sm:text-xs font-medium text-serene-neutral-500 left sm:text-center mt-1 sm:mt-2 leading-tight">
									Report abuse incidents and receive secure confidential support.
								</p>
							</div>
						</div>
					</div>

					{/* Professional Tile */}
					<div
						className={`cursor-pointer rounded-[2.5rem] border-2 p-8 text-center transition-all duration-300 group relative overflow-hidden bg-white h-full flex flex-col justify-center ${
							profile.user_type === "professional"
								? "border-serene-blue-500 shadow-xl ring-2 ring-serene-blue-500/10"
								: "border-serene-neutral-100 hover:border-serene-blue-200 hover:shadow-lg"
						}`}
						onClick={() => setProfile(p => ({ ...p, user_type: "professional" }))}
					>
						<div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-6 relative z-10">
							<div className="w-16 sm:w-24 aspect-square relative flex justify-center items-center bg-serene-blue-50 rounded-[1.5rem] shadow-sm border border-serene-blue-100 transition-all duration-500 group-hover:bg-serene-blue-100/50">
								<Image
									src="/icons/professional-light.png"
									alt="Service Provider"
									height={80}
									width={80}
									className="object-contain p-3"
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-bold text-serene-neutral-900 left sm:text-center group-hover:text-serene-blue-600 transition-colors">
									Professional
								</h3>
								<p className="text-[10px] sm:text-xs font-medium text-serene-neutral-500 left sm:text-center mt-1 sm:mt-2 leading-tight">
									Provide expert support to survivors.
								</p>
							</div>
						</div>
					</div>

					{/* NGO Tile */}
					<div
						className={`cursor-pointer rounded-[1.5rem] border-2 p-3 md:p-6 text-center transition-all duration-300 group relative overflow-hidden bg-white h-full flex flex-col justify-center ${
							profile.user_type === "ngo"
								? "border-serene-blue-500 shadow-xl ring-2 ring-serene-blue-500/10"
								: "border-serene-neutral-100 hover:border-serene-blue-200"
						}`}
						onClick={() => setProfile(p => ({ ...p, user_type: "ngo" }))}
					>
						<div className="flex flex-row sm:flex-col items-center gap-3 sm:gap-4 relative z-10">
							<div className="w-12 sm:w-16 aspect-square relative flex justify-center items-center bg-serene-blue-50 rounded-[1rem] shadow-sm border border-serene-blue-100 transition-all duration-500 group-hover:bg-serene-blue-100/50">
								<Image
									src="/icons/ngo-light.png"
									alt="NGO"
									className="object-contain p-2"
									height={60}
									width={60}
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-bold text-serene-neutral-900 left sm:text-center group-hover:text-serene-blue-600 transition-colors">
									Organisation
								</h3>
								<p className="text-[10px] sm:text-xs font-medium text-serene-neutral-500 left sm:text-center mt-1 sm:mt-2 leading-tight">
									Manage non profit services, multiple professionals and provide support to survivors.
								</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);

	const About = (
		<Card className="bg-white border-serene-neutral-100 shadow-premium rounded-[2.5rem] overflow-hidden max-h-full flex flex-col">
			<CardHeader className="pb-3 text-center pt-6 bg-serene-blue-50/20 shrink-0">
				<CardTitle className="text-xl font-bold text-serene-neutral-900 tracking-tight leading-none">Your Identity</CardTitle>
				<p className="text-xs font-medium text-serene-neutral-500 mt-1">This helps us introduce you</p>
			</CardHeader>
			<CardContent className="space-y-6 p-4 md:p-10 flex-1 overflow-y-auto no-scrollbar">
				<div className="space-y-3">
					<Label className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">Select Your Primary Title</Label>
					<div className="grid grid-cols-2 gap-2">
						{profile.user_type === 'professional' ? (
							['Doctor', 'Mental health expert', 'Lawyer', 'Paralegal', 'Human rights defender'].map((title) => {
								const config = titleConfigs[title];
								const Icon = config?.icon || FileText;
								return (
									<Button
										key={title}
										variant={profile.professional_title === title ? 'default' : 'outline'}
										className={`group rounded-xl px-2 py-3 h-auto transition-all duration-300 flex flex-col items-center gap-1.5 border-2 ${
											profile.professional_title === title 
												? `${config?.activeColor || 'bg-sauti-teal'} text-white border-transparent shadow-lg` 
												: `bg-white border-serene-neutral-100 text-serene-neutral-600 hover:border-serene-blue-200 hover:bg-serene-blue-50/30`
										}`}
										onClick={() => setProfile(p => ({ ...p, professional_title: title }))}
									>
										<div className={`p-1.5 rounded-lg transition-colors ${
											profile.professional_title === title ? 'bg-white/20' : config?.bgColor || 'bg-serene-neutral-50'
										}`}>
											<Icon className={`h-4 w-4 ${profile.professional_title === title ? 'text-white' : config?.color || 'text-serene-neutral-500'}`} />
										</div>
										<span className="font-bold text-sm text-center leading-tight">{title}</span>
									</Button>
								);
							})
						) : (
							['Law firm', 'Rescue Center', 'Hospital/Clinic', 'Local NGO'].map((title) => {
								const config = titleConfigs[title];
								const Icon = config?.icon || Building2;
								return (
									<Button
										key={title}
										variant={profile.professional_title === title ? 'default' : 'outline'}
										className={`group rounded-xl px-2 py-3 h-auto transition-all duration-300 flex flex-col items-center gap-1.5 border-2 ${
											profile.professional_title === title 
												? `${config?.activeColor || 'bg-sauti-teal'} text-white border-transparent shadow-lg` 
												: `bg-white border-serene-neutral-100 text-serene-neutral-600 hover:border-serene-blue-200 hover:bg-serene-blue-50/30`
										}`}
										onClick={() => setProfile(p => ({ ...p, professional_title: title }))}
									>
										<div className={`p-1.5 rounded-lg transition-colors ${
											profile.professional_title === title ? 'bg-white/20' : config?.bgColor || 'bg-serene-neutral-50'
										}`}>
											<Icon className={`h-4 w-4 ${profile.professional_title === title ? 'text-white' : config?.color || 'text-serene-neutral-500'}`} />
										</div>
										<span className="font-bold text-xs text-center leading-tight">{title}</span>
									</Button>
								);
							})
						)}
					</div>
				</div>

				<div className="space-y-2">
					<Label className="text-[10px] font-black text-serene-neutral-600 uppercase tracking-widest px-1">Your Mission Brief</Label>
					<Textarea
						placeholder={profile.user_type === 'professional' ? "I am a dedicated Service Provider with years of experience in..." : "Our Organisation is committed to providing..."}
						rows={2}
						value={profile.bio}
						onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
						className="bg-serene-neutral-50/50 border-serene-neutral-200 rounded-[1.25rem] focus:ring-serene-blue-500/10 focus:border-serene-blue-500 transition-all text-sm p-4 shadow-inner min-h-[100px]"
					/>
				</div>
			</CardContent>
		</Card>
	);

	/* Required steps defined above */

	const Services = (
		<Card className="bg-white border-serene-neutral-100 shadow-premium rounded-[2.5rem] overflow-hidden">
			<CardHeader className="pb-4 text-center pt-8 bg-serene-blue-50/20">
				<CardTitle className="text-2xl font-bold text-serene-neutral-900 tracking-tight">Professional Profile</CardTitle>
				<p className="text-sm font-medium text-serene-neutral-500 mt-1">List your core services for the community</p>
			</CardHeader>
			<CardContent className="p-0">
				<AddSupportServiceForm embedded onSuccess={() => {}} />
			</CardContent>
		</Card>
	);

	/* Removed unused steps */

	const contentMap: Record<string, React.ReactNode> = {
		policies: PoliciesStep,
		role: Role,
		about: About,
		services: Services,
	};

	const currentStepId = filteredSteps[safeStepIndex]?.id || 'role';
	const Current = contentMap[currentStepId];

	return (
		<div className="max-w-4xl mx-auto h-[100dvh] flex flex-col p-3 md:p-8 space-y-2 md:space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
			<div className="space-y-2 shrink-0 px-1 sm:px-0">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-serene-blue-600">
						Setup Step {safeStepIndex + 1} of {filteredSteps.length}
					</h2>
					<Badge variant="outline" className="rounded-full border-serene-blue-200 text-serene-blue-700 bg-white font-black text-[10px] uppercase">
						{filteredSteps[safeStepIndex]?.title || '...'}
					</Badge>
				</div>
				<div className="h-1.5 w-full bg-serene-neutral-100 rounded-full overflow-hidden shadow-inner">
					<div 
						className="h-full bg-gradient-to-r from-serene-blue-400 to-serene-blue-600 transition-all duration-700 ease-out" 
						style={{ width: `${((safeStepIndex + 1) / filteredSteps.length) * 100}%` }}
					/>
				</div>
			</div>

			<div className="flex-1 overflow-hidden flex flex-col items-center justify-center">
				<div className="w-full max-h-full overflow-y-auto no-scrollbar">
					{Current}
				</div>
			</div>

			<div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-serene-neutral-100 bg-white/40 backdrop-blur-sm sticky bottom-0 pb-3 shrink-0 px-2">
				<Button 
					variant="ghost" 
					onClick={back} 
					disabled={safeStepIndex === 0 || saving}
					className="rounded-full px-6 sm:px-8 text-neutral-400 hover:text-sauti-dark hover:bg-neutral-100 transition-colors font-bold text-xs w-full sm:w-auto order-2 sm:order-1"
				>
					Back
				</Button>
				
				<div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
					{currentStepId === 'services' && (
						<Button 
							variant="outline" 
							onClick={() => router.refresh()} 
							className="rounded-full px-6 sm:px-8 border-serene-blue-200 hover:bg-serene-blue-50 text-serene-blue-600 font-bold uppercase tracking-widest text-[10px] h-10 sm:h-12 w-full sm:w-auto"
						>
							Skip for now
						</Button>
					)}
					
					<Button 
						onClick={next} 
						disabled={
							saving || 
							(currentStepId === 'policies' && !allPoliciesAccepted) ||
							(currentStepId === 'role' && !profile.user_type) || 
							(currentStepId === 'about' && (!profile.professional_title || !profile.bio))
						}
						className="bg-serene-blue-600 hover:bg-serene-blue-700 text-white font-black h-11 sm:h-12 px-8 sm:px-12 rounded-full sm:min-w-[200px] shadow-lg shadow-serene-blue-500/20 transition-all active:scale-95 uppercase tracking-[0.1em] text-[11px] sm:text-xs w-full sm:w-auto"
					>
						{saving ? "Saving..." : isLastStep ? "Get Started" : "Continue Setup"}
					</Button>
				</div>
			</div>
		</div>
	);
}
