"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	CheckCircle,
	AlertCircle,
	Clock,
	Building,
	FileCheck,
	Users,
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
			title: "Add Accreditation",
			description: "Upload your professional documents",
			icon: FileCheck,
			completed: hasAccreditation,
			active: !hasAccreditation,
		},
		{
			id: "services",
			title: "Add Support Services",
			description: "Create your support service profile",
			icon: Building,
			completed: hasSupportServices,
			active: hasAccreditation && !hasSupportServices,
		},
		{
			id: "verification",
			title: "Get Verified",
			description: "Complete verification process",
			icon: CheckCircle,
			completed: verificationStatus === "verified",
			active:
				hasAccreditation && hasSupportServices && verificationStatus !== "verified",
		},
		{
			id: "matching",
			title: "Get Matched",
			description: "Start helping survivors",
			icon: Users,
			completed: hasMatches,
			active: verificationStatus === "verified" && !hasMatches,
		},
	];

	const getStepIcon = (step: (typeof steps)[0]) => {
		const Icon = step.icon;
		if (step.completed) {
			return <CheckCircle className="h-5 w-5 text-green-600" />;
		}
		if (step.active) {
			return <Clock className="h-5 w-5 text-sauti-orange" />;
		}
		return <AlertCircle className="h-5 w-5 text-gray-400" />;
	};

	const getStepColor = (step: (typeof steps)[0]) => {
		if (step.completed) {
			return "bg-green-50 border-green-200";
		}
		if (step.active) {
			return "bg-orange-50 border-orange-200";
		}
		return "bg-gray-50 border-gray-200";
	};

	const getStepTextColor = (step: (typeof steps)[0]) => {
		if (step.completed) {
			return "text-green-800";
		}
		if (step.active) {
			return "text-orange-800";
		}
		return "text-gray-600";
	};

	const completedSteps = steps.filter((step) => step.completed).length;
	const progressPercentage = (completedSteps / steps.length) * 100;

	return (
		<Card className="mb-4">
			<CardContent className="p-3">
				<div className="space-y-3">
					{/* Progress Header */}
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold text-gray-900">
								Verification Progress
							</h3>
							<p className="text-xs text-gray-600">
								Complete all steps to start helping survivors
							</p>
						</div>
						<Badge variant="outline" className="text-xs">
							{completedSteps}/{steps.length} Complete
						</Badge>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 rounded-full h-1.5">
						<div
							className="bg-gradient-to-r from-sauti-orange to-green-500 h-1.5 rounded-full transition-all duration-500"
							style={{ width: `${progressPercentage}%` }}
						/>
					</div>

					{/* Steps */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
						{steps.map((step, index) => (
							<div
								key={step.id}
								className={`p-2 rounded-md border transition-all duration-200 ${getStepColor(
									step
								)}`}
							>
								<div className="flex items-center gap-2">
									<div className="flex-shrink-0">{getStepIcon(step)}</div>
									<div className="min-w-0 flex-1">
										<h4 className={`text-xs font-medium ${getStepTextColor(step)}`}>
											{step.title}
										</h4>
										<p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
											{step.description}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>

					{/* Status Message */}
					{verificationStatus === "verified" && hasMatches && (
						<div className="flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-200">
							<CheckCircle className="h-4 w-4 text-green-600" />
							<div>
								<p className="text-xs font-medium text-green-800">
									Congratulations! You're fully verified and helping survivors.
								</p>
							</div>
						</div>
					)}

					{verificationStatus === "under_review" && (
						<div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md border border-yellow-200">
							<Clock className="h-4 w-4 text-yellow-600" />
							<div>
								<p className="text-xs font-medium text-yellow-800">
									Your verification is under review.
								</p>
							</div>
						</div>
					)}

					{verificationStatus === "rejected" && (
						<div className="flex items-center gap-2 p-2 bg-red-50 rounded-md border border-red-200">
							<AlertCircle className="h-4 w-4 text-red-600" />
							<div>
								<p className="text-xs font-medium text-red-800">
									Verification needs attention.
								</p>
							</div>
						</div>
					)}

					{/* Verification Notes */}
					{verificationNotes && (
						<div className="flex items-start gap-2 p-2 bg-blue-50 rounded-md border border-blue-200">
							<AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-xs font-medium text-blue-800">
									<strong>Verification Notes:</strong>
								</p>
								<p className="text-xs text-blue-700 mt-1">{verificationNotes}</p>
							</div>
						</div>
					)}

					{/* Progress Summary */}
					<div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-md p-2">
						<div className="flex items-center gap-2 sm:gap-4">
							<span className="hidden sm:inline">
								{documentsCount} document{documentsCount !== 1 ? "s" : ""} uploaded
							</span>
							<span className="sm:hidden">
								{documentsCount} doc{documentsCount !== 1 ? "s" : ""}
							</span>
							{servicesCount > 0 && (
								<span className="hidden sm:inline">
									{servicesCount} service{servicesCount !== 1 ? "s" : ""} registered
								</span>
							)}
							{servicesCount > 0 && (
								<span className="sm:hidden">
									{servicesCount} svc{servicesCount !== 1 ? "s" : ""}
								</span>
							)}
						</div>
						<span className="font-medium">{Math.round(progressPercentage)}%</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
