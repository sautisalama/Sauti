"use client";

import { Badge } from "@/components/ui/badge";
import {
	CheckCircle,
	AlertCircle,
	Clock,
	Briefcase,
	FileCheck,
	Users,
	Shield,
	Sparkles,
} from "lucide-react";

interface VerificationProgressBarProps {
	hasAccreditation: boolean;
	hasSupportServices: boolean;
	verificationStatus: string;
	hasMatches: boolean;
	verificationNotes?: string;
	documentsCount?: number;
	servicesCount?: number;
}

export function VerificationProgressBar({
	hasAccreditation,
	hasSupportServices,
	verificationStatus,
	hasMatches,
	verificationNotes,
	documentsCount = 0,
	servicesCount = 0,
}: VerificationProgressBarProps) {
	const steps = [
		{
			id: "accreditation",
			title: "Documents",
			description: "Upload credentials",
			icon: FileCheck,
			completed: hasAccreditation,
			active: !hasAccreditation,
		},
		{
			id: "services",
			title: "Service",
			description: "Register your service",
			icon: Briefcase,
			completed: hasSupportServices,
			active: hasAccreditation && !hasSupportServices,
		},
		{
			id: "verification",
			title: "Verification",
			description: "Get verified",
			icon: Shield,
			completed: verificationStatus === "verified",
			active:
				hasAccreditation && hasSupportServices && verificationStatus !== "verified",
		},
		{
			id: "matching",
			title: "Matching",
			description: "Help survivors",
			icon: Users,
			completed: hasMatches,
			active: verificationStatus === "verified" && !hasMatches,
		},
	];

	const completedSteps = steps.filter((step) => step.completed).length;
	const progressPercentage = (completedSteps / steps.length) * 100;

	// Fully verified and matched
	if (verificationStatus === "verified" && hasMatches) {
		return (
			<div className="bg-gradient-to-r from-serene-green-50 via-white to-sauti-teal-light/30 rounded-2xl p-5 border border-serene-green-200">
				<div className="flex items-center gap-3">
					<div className="p-2.5 rounded-xl bg-serene-green-100">
						<Sparkles className="h-5 w-5 text-serene-green-600" />
					</div>
					<div className="flex-1">
						<h3 className="text-base font-bold text-serene-green-900">
							Fully Verified & Active
						</h3>
						<p className="text-sm text-serene-green-700">
							You're helping survivors! {documentsCount} docs • {servicesCount} service{servicesCount !== 1 ? "s" : ""}
						</p>
					</div>
					<Badge className="bg-serene-green-100 text-serene-green-700 border-serene-green-200">
						<CheckCircle className="h-3 w-3 mr-1" />
						Complete
					</Badge>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-gradient-to-r from-serene-blue-50 via-white to-sauti-teal-light/20 rounded-2xl border border-serene-neutral-200 overflow-hidden">
			{/* Header */}
			<div className="px-5 py-4 border-b border-serene-neutral-100">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-sauti-teal/10">
							<Shield className="h-5 w-5 text-sauti-teal" />
						</div>
						<div>
							<h3 className="text-base font-bold text-serene-neutral-900">
								Verification Progress
							</h3>
							<p className="text-sm text-serene-neutral-600">
								{completedSteps === 0 
									? "Complete all steps to start helping survivors"
									: `${completedSteps} of ${steps.length} steps completed`}
							</p>
						</div>
					</div>
					<div className="text-right">
						<span className="text-xl font-bold text-sauti-teal">
							{Math.round(progressPercentage)}%
						</span>
					</div>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="px-5 py-3 bg-serene-neutral-50/50">
				<div className="w-full bg-serene-neutral-200 rounded-full h-2">
					<div
						className="bg-gradient-to-r from-sauti-teal to-serene-green-500 h-2 rounded-full transition-all duration-700 ease-out"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
			</div>

			{/* Steps */}
			<div className="px-5 py-4">
				<div className="flex items-center justify-between">
					{steps.map((step, index) => {
						const Icon = step.icon;
						const isCompleted = step.completed;
						const isActive = step.active;
						
						return (
							<div key={step.id} className="flex items-center">
								{/* Step */}
								<div className="flex flex-col items-center">
									<div
										className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
											isCompleted
												? "bg-serene-green-100 ring-2 ring-serene-green-200"
												: isActive
												? "bg-sauti-teal/10 ring-2 ring-sauti-teal/30"
												: "bg-serene-neutral-100"
										}`}
									>
										{isCompleted ? (
											<CheckCircle className="h-5 w-5 text-serene-green-600" />
										) : isActive ? (
											<Icon className="h-5 w-5 text-sauti-teal" />
										) : (
											<Icon className="h-5 w-5 text-serene-neutral-400" />
										)}
									</div>
									<span
										className={`text-xs font-medium mt-2 ${
											isCompleted
												? "text-serene-green-700"
												: isActive
												? "text-sauti-teal"
												: "text-serene-neutral-500"
										}`}
									>
										{step.title}
									</span>
								</div>
								
								{/* Connector */}
								{index < steps.length - 1 && (
									<div
										className={`w-12 sm:w-16 h-0.5 mx-2 ${
											isCompleted
												? "bg-serene-green-300"
												: "bg-serene-neutral-200"
										}`}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Status Messages */}
			{(verificationStatus === "pending" || !verificationStatus) && (
				<div className="px-5 pb-4">
					<div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100/50 shadow-sm">
						<AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-bold text-blue-900 leading-none mb-1">Verification Pending</p>
							<p className="text-xs font-medium text-blue-800/80 leading-relaxed">
								Please complete your verification documents to proceed.
							</p>
						</div>
					</div>
				</div>
			)}

			{verificationStatus === "under_review" && (
				<div className="px-5 pb-4">
					<div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100/50 shadow-sm">
						<Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-bold text-amber-900 leading-none mb-1">Your documents are under review</p>
							<p className="text-xs font-medium text-amber-800/80 leading-relaxed">
								We'll notify you once verified. This usually takes 24-48 hours.
							</p>
						</div>
					</div>
				</div>
			)}

			{verificationStatus === "rejected" && (
				<div className="px-5 pb-4">
					<div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100/50 shadow-sm">
						<AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-bold text-red-900 leading-none mb-1">Action Required</p>
							<p className="text-xs font-medium text-red-800/80 leading-relaxed">
								Verification needs attention. Please check the admin notes below and re-upload the necessary documents.
							</p>
						</div>
					</div>
				</div>
			)}

			{verificationNotes && (
				<div className="px-5 pb-4">
					<div className="flex items-start gap-2 p-3 bg-serene-blue-50 rounded-xl border border-serene-blue-200">
						<AlertCircle className="h-4 w-4 text-serene-blue-600 mt-0.5 flex-shrink-0" />
						<div>
							<span className="text-xs font-bold text-serene-blue-800 uppercase tracking-wide">
								Admin Notes
							</span>
							<p className="text-sm text-serene-blue-700 mt-1">{verificationNotes}</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
