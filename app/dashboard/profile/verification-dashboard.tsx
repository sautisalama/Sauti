"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CheckCircle,
	AlertCircle,
	Clock,
	XCircle,
	Eye,
	Download,
	Upload,
	Shield,
	FileText,
	Calendar,
	User,
	Building,
	RefreshCw,
	Info,
	ExternalLink,
	TrendingUp,
	Award,
	Target,
	CheckSquare,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/db-schema";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

interface VerificationMetrics {
	totalDocuments: number;
	verifiedDocuments: number;
	pendingDocuments: number;
	rejectedDocuments: number;
	overallProgress: number;
	verificationScore: number;
	lastActivity: string;
}

interface VerificationDashboardProps {
	userId: string;
	userType: UserType;
	profile: any;
	onUpdate?: () => void;
}

export function VerificationDashboard({
	userId,
	userType,
	profile,
	onUpdate,
}: VerificationDashboardProps) {
	const [metrics, setMetrics] = useState<VerificationMetrics>({
		totalDocuments: 0,
		verifiedDocuments: 0,
		pendingDocuments: 0,
		rejectedDocuments: 0,
		overallProgress: 0,
		verificationScore: 0,
		lastActivity: new Date().toISOString(),
	});
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("overview");
	const [servicesData, setServicesData] = useState<
		Array<{
			verification_status: string | null;
			accreditation_files_metadata: any;
		}>
	>([]);
	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadVerificationMetrics();
	}, [userId, userType]);

	const loadVerificationMetrics = async () => {
		setIsLoading(true);
		try {
			// Load profile verification data
			const { data: profileData } = await supabase
				.from("profiles")
				.select(
					"verification_status, last_verification_check, accreditation_files_metadata"
				)
				.eq("id", userId)
				.single();

			// Load services verification data for NGO users
			if (userType === "ngo") {
				const { data: services } = await supabase
					.from("support_services")
					.select("verification_status, accreditation_files_metadata")
					.eq("user_id", userId);
				setServicesData(services || []);
			} else {
				setServicesData([]);
			}

			// Calculate metrics
			const profileDocs = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata
					: JSON.parse(profileData.accreditation_files_metadata)
				: [];

			const serviceDocs = servicesData.flatMap((service) =>
				service.accreditation_files_metadata
					? Array.isArray(service.accreditation_files_metadata)
						? service.accreditation_files_metadata
						: JSON.parse(service.accreditation_files_metadata)
					: []
			);

			const allDocs = [...profileDocs, ...serviceDocs];
			const verifiedDocs = allDocs.filter(
				(doc) => doc.status === "verified"
			).length;
			const pendingDocs = allDocs.filter(
				(doc) => doc.status === "pending" || doc.status === "under_review"
			).length;
			const rejectedDocs = allDocs.filter(
				(doc) => doc.status === "rejected"
			).length;

			const overallProgress =
				allDocs.length > 0 ? Math.round((verifiedDocs / allDocs.length) * 100) : 0;
			const verificationScore = calculateVerificationScore(
				profileData,
				servicesData,
				allDocs
			);

			setMetrics({
				totalDocuments: allDocs.length,
				verifiedDocuments: verifiedDocs,
				pendingDocuments: pendingDocs,
				rejectedDocuments: rejectedDocs,
				overallProgress,
				verificationScore,
				lastActivity:
					profileData?.last_verification_check || new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error loading verification metrics:", error);
			toast({
				title: "Error",
				description: "Failed to load verification metrics",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const calculateVerificationScore = (
		profileData: any,
		servicesData: any[],
		allDocs: any[]
	) => {
		let score = 0;
		const maxScore = 100;

		// Professional credentials verification (60 points)
		if (allDocs.length > 0) {
			const verifiedRatio =
				allDocs.filter((doc) => doc.status === "verified").length / allDocs.length;
			score += Math.round(verifiedRatio * 60);
		}

		// Service accreditation for NGO users (40 points)
		if (userType === "ngo" && servicesData.length > 0) {
			const verifiedServices = servicesData.filter(
				(service) => service.verification_status === "verified"
			).length;
			const serviceRatio = verifiedServices / servicesData.length;
			score += Math.round(serviceRatio * 40);
		} else if (userType !== "ngo") {
			// For non-NGO users, give full points for services
			score += 40;
		}

		return Math.min(score, maxScore);
	};

	const getScoreColor = (score: number) => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-yellow-600";
		if (score >= 40) return "text-orange-600";
		return "text-red-600";
	};

	const getScoreBadgeColor = (score: number) => {
		if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
		if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
		if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200";
		return "bg-red-100 text-red-800 border-red-200";
	};

	const getScoreLabel = (score: number) => {
		if (score >= 90) return "Excellent";
		if (score >= 80) return "Very Good";
		if (score >= 70) return "Good";
		if (score >= 60) return "Fair";
		if (score >= 40) return "Needs Improvement";
		return "Poor";
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sauti-orange mx-auto"></div>
						<p className="mt-4 text-gray-600">Loading verification dashboard...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">
						Verification Dashboard
					</h2>
					<p className="text-gray-600 mt-1">
						Comprehensive view of your verification status and progress
					</p>
				</div>
				<Button
					variant="outline"
					onClick={loadVerificationMetrics}
					className="gap-2"
				>
					<RefreshCw className="h-4 w-4" />
					Refresh
				</Button>
			</div>

			{/* Key Metrics Cards */}
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Verification Score</p>
								<p
									className={`text-2xl font-bold ${getScoreColor(
										metrics.verificationScore
									)}`}
								>
									{metrics.verificationScore}/100
								</p>
								<Badge className={getScoreBadgeColor(metrics.verificationScore)}>
									{getScoreLabel(metrics.verificationScore)}
								</Badge>
							</div>
							<Award className="h-8 w-8 text-sauti-orange" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Overall Progress</p>
								<p className="text-2xl font-bold text-gray-900">
									{metrics.overallProgress}%
								</p>
								<Progress value={metrics.overallProgress} className="mt-2 h-2" />
							</div>
							<TrendingUp className="h-8 w-8 text-sauti-orange" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Total Documents</p>
								<p className="text-2xl font-bold text-gray-900">
									{metrics.totalDocuments}
								</p>
								<p className="text-xs text-gray-500 mt-1">
									{metrics.verifiedDocuments} verified
								</p>
							</div>
							<FileText className="h-8 w-8 text-sauti-orange" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600">Pending Review</p>
								<p className="text-2xl font-bold text-gray-900">
									{metrics.pendingDocuments}
								</p>
								<p className="text-xs text-gray-500 mt-1">
									{metrics.rejectedDocuments} rejected
								</p>
							</div>
							<Clock className="h-8 w-8 text-sauti-orange" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="overview" className="flex items-center gap-2">
						<Target className="h-4 w-4" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="documents" className="flex items-center gap-2">
						<FileText className="h-4 w-4" />
						Documents
					</TabsTrigger>
					{userType === "ngo" && (
						<TabsTrigger value="services" className="flex items-center gap-2">
							<Building className="h-4 w-4" />
							Services
						</TabsTrigger>
					)}
					<TabsTrigger value="timeline" className="flex items-center gap-2">
						<Calendar className="h-4 w-4" />
						Timeline
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					{/* Verification Status Overview */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Shield className="h-5 w-5 text-sauti-orange" />
								Verification Status Overview
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-3">
									<h4 className="font-semibold">Professional Credentials</h4>
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Verified Credentials</span>
											<span className="font-medium text-green-600">
												{metrics.verifiedDocuments}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Under Review</span>
											<span className="font-medium text-yellow-600">
												{metrics.pendingDocuments}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Rejected</span>
											<span className="font-medium text-red-600">
												{metrics.rejectedDocuments}
											</span>
										</div>
									</div>
								</div>
								<div className="space-y-3">
									<h4 className="font-semibold">Verification Progress</h4>
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Overall Score</span>
											<span
												className={`font-medium ${getScoreColor(
													metrics.verificationScore
												)}`}
											>
												{metrics.verificationScore}/100
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Completion</span>
											<span className="font-medium text-gray-900">
												{metrics.overallProgress}%
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Last Activity</span>
											<span className="font-medium text-gray-600">
												{new Date(metrics.lastActivity).toLocaleDateString()}
											</span>
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckSquare className="h-5 w-5 text-sauti-orange" />
								Quick Actions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-3 md:grid-cols-2">
								<Button variant="outline" className="justify-start gap-2">
									<Upload className="h-4 w-4" />
									Upload Credentials
								</Button>
								{userType === "ngo" && (
									<Button variant="outline" className="justify-start gap-2">
										<Building className="h-4 w-4" />
										Add Support Service
									</Button>
								)}
								<Button variant="outline" className="justify-start gap-2">
									<RefreshCw className="h-4 w-4" />
									Request Review
								</Button>
								<Button variant="outline" className="justify-start gap-2">
									<Info className="h-4 w-4" />
									Verification Guidelines
								</Button>
								<Button variant="outline" className="justify-start gap-2">
									<Download className="h-4 w-4" />
									Download Report
								</Button>
								<Button variant="outline" className="justify-start gap-2">
									<FileText className="h-4 w-4" />
									View All Documents
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="documents" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-sauti-orange" />
								Professional Credentials Status
							</CardTitle>
							<p className="text-sm text-gray-600 mt-2">
								Track the verification status of your professional licenses,
								certifications, and degrees
							</p>
						</CardHeader>
						<CardContent>
							<div className="text-center py-8">
								<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<p className="text-gray-500">
									Professional credentials details will be loaded here
								</p>
								<p className="text-sm text-gray-400 mt-1">
									This will show detailed verification status of your professional
									qualifications
								</p>
								<div className="mt-4">
									<Button className="gap-2">
										<Upload className="h-4 w-4" />
										Upload Professional Credentials
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{userType === "ngo" && (
					<TabsContent value="services" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building className="h-5 w-5 text-sauti-orange" />
									Support Services Accreditation Status
								</CardTitle>
								<p className="text-sm text-gray-600 mt-2">
									Track the accreditation status of your support services and their
									required documents
								</p>
							</CardHeader>
							<CardContent>
								<div className="text-center py-8">
									<Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
									<p className="text-gray-500">
										Support services accreditation details will be loaded here
									</p>
									<p className="text-sm text-gray-400 mt-1">
										This will show detailed accreditation status for each of your support
										services
									</p>
									<div className="mt-4">
										<Button className="gap-2">
											<Building className="h-4 w-4" />
											Add Support Service
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				)}

				<TabsContent value="timeline" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="h-5 w-5 text-sauti-orange" />
								Professional Verification Timeline
							</CardTitle>
							<p className="text-sm text-gray-600 mt-2">
								Track your professional verification journey and credential submission
								history
							</p>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<div className="w-3 h-3 bg-green-500 rounded-full"></div>
									<div>
										<p className="text-sm font-medium">Professional Account Created</p>
										<p className="text-xs text-gray-600">
											{new Date(profile?.created_at || new Date()).toLocaleDateString()}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-3">
									<div className="w-3 h-3 bg-blue-500 rounded-full"></div>
									<div>
										<p className="text-sm font-medium">
											Professional Credentials Uploaded
										</p>
										<p className="text-xs text-gray-600">
											{metrics.totalDocuments} credential document
											{metrics.totalDocuments !== 1 ? "s" : ""} uploaded
										</p>
									</div>
								</div>

								{userType === "ngo" && (
									<div className="flex items-center gap-3">
										<div className="w-3 h-3 bg-purple-500 rounded-full"></div>
										<div>
											<p className="text-sm font-medium">Support Services Registered</p>
											<p className="text-xs text-gray-600">
												{servicesData.length} service{servicesData.length !== 1 ? "s" : ""}{" "}
												registered with accreditation requirements
											</p>
										</div>
									</div>
								)}

								<div className="flex items-center gap-3">
									<div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
									<div>
										<p className="text-sm font-medium">Last Verification Review</p>
										<p className="text-xs text-gray-600">
											{new Date(metrics.lastActivity).toLocaleDateString()}
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
