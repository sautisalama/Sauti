"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AnonymousModeToggle } from "@/components/chat/AnonymousModeToggle";
import { ProfessionalDocumentsForm } from "./professional-documents";
import { EnhancedProfessionalDocumentsForm } from "./enhanced-professional-documents";
import { VerificationWrapper } from "./verification-wrapper";
import { SupportServicesManager } from "./support-services-manager";
import { signOut } from "@/app/(auth)/actions/auth";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import {
	CheckCircle,
	AlertCircle,
	User,
	Shield,
	Building,
	Settings,
	Accessibility,
	FileCheck,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";

interface ProfileData {
	bio?: string;
	phone?: string;
	professional_title?: string;
	first_name?: string;
	last_name?: string;
	email?: string;
	isVerified?: boolean;
	accreditation_files?: any;
	accreditation_member_number?: any;
	settings?: any;
}

export default function ProfilePage() {
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const { toast } = useToast();
	const isProfessional =
		profile?.user_type === "professional" || profile?.user_type === "ngo";
	const supabase = createClient();

	const [profileData, setProfileData] = useState<ProfileData>({});
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [activeTab, setActiveTab] = useState("profile");
	const searchParams = useSearchParams();
	// Remove local state - use dashboard data provider instead

	// Respect ?tab=verification to open the verification tab directly
	useEffect(() => {
		const tab = searchParams?.get("tab");
		if (tab === "verification") {
			setActiveTab("verification");
		}
	}, [searchParams]);

	// Load profile data
	useEffect(() => {
		if (profile) {
			setProfileData({
				bio: profile.bio || "",
				phone: profile.phone || "",
				professional_title: profile.professional_title || "",
				first_name: profile.first_name || "",
				last_name: profile.last_name || "",
				email: profile.email || "",
				isVerified: (profile as any).isVerified || false,
				accreditation_files: (profile as any).accreditation_files || null,
				accreditation_member_number:
					(profile as any).accreditation_member_number || null,
				settings: (profile as any).settings || {},
			});
		}
	}, [profile]);

	// Get data from dashboard provider
	const userServices = dash?.data?.supportServices || [];
	const hasMatches = (dash?.data?.matchedServices?.length || 0) > 0;

	// Data is already loaded by dashboard provider - no need for additional loading

	const updateFormData = (section: string, field: string, value: any) => {
		setFormData((prev) => ({
			...prev,
			[section]: {
				...prev[section],
				[field]: value,
			},
		}));
	};

	const saveVerificationDocuments = async (documents: any[]) => {
		try {
			if (!userId) return;

			const { error } = await supabase
				.from("profiles")
				.update({
					accreditation_files: documents,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) throw error;

			// Update local state and provider cache
			setProfileData((prev) => ({
				...prev,
				accreditation_files: documents,
			}));
			dash?.updatePartial({
				profile: {
					...(profile as any),
					accreditation_files: documents,
					updated_at: new Date().toISOString(),
				} as any,
			});

			toast({
				title: "Success",
				description: "Verification documents saved successfully",
			});
		} catch (error) {
			console.error("Error saving verification documents:", error);
			toast({
				title: "Error",
				description: "Failed to save verification documents",
				variant: "destructive",
			});
		}
	};

	const saveSection = async (section: string) => {
		try {
			if (!userId) return;

			const sectionData = formData[section] || {};
			let updateData: any = {};

			switch (section) {
				case "basic":
					updateData = {
						first_name: sectionData.first_name || profileData.first_name,
						last_name: sectionData.last_name || profileData.last_name,
					};
					break;
				case "professional":
					updateData = {
						bio: sectionData.bio || profileData.bio,
						professional_title:
							sectionData.professional_title || profileData.professional_title,
						phone: sectionData.phone || profileData.phone,
					};
					break;
				case "verification":
					// This will be handled by the ProfessionalDocumentsForm component
					// The form will call onSave after uploading files
					return;
			}

			const { error } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (error) throw error;

			// Update local state and provider cache
			setProfileData((prev) => ({ ...prev, ...updateData }));
			dash?.updatePartial({
				profile: {
					...(profile as any),
					...updateData,
					updated_at: new Date().toISOString(),
				} as any,
			});
			toast({
				title: "Saved",
				description: `${section} information updated successfully`,
			});
		} catch (error) {
			toast({
				title: "Error",
				description: `Failed to save ${section} information`,
				variant: "destructive",
			});
		}
	};

	const getVerificationStatus = (section: string) => {
		switch (section) {
			case "professional":
				return !!(
					profileData.bio &&
					profileData.professional_title &&
					profileData.phone
				);
			case "verification":
				return !!(
					profileData.accreditation_files && profileData.accreditation_member_number
				);
			default:
				return false;
		}
	};

	// Check if user has uploaded documents in both verify and services tabs
	const hasDocumentsInBothTabs = useCallback(async () => {
		if (!userId) return false;

		try {
			// Check for professional credentials (verify tab)
			const { data: profileData } = await supabase
				.from("profiles")
				.select("accreditation_files_metadata")
				.eq("id", userId)
				.single();

			const hasProfessionalDocs = profileData?.accreditation_files_metadata
				? Array.isArray(profileData.accreditation_files_metadata)
					? profileData.accreditation_files_metadata.length > 0
					: JSON.parse(profileData.accreditation_files_metadata).length > 0
				: false;

			// Check for service accreditation documents (services tab)
			const { data: services } = await supabase
				.from("support_services")
				.select("accreditation_files_metadata")
				.eq("user_id", userId);

			const hasServiceDocs =
				services?.some((service) => {
					const docs = service.accreditation_files_metadata
						? Array.isArray(service.accreditation_files_metadata)
							? service.accreditation_files_metadata
							: JSON.parse(service.accreditation_files_metadata)
						: [];
					return docs.length > 0;
				}) || false;

			return hasProfessionalDocs && hasServiceDocs;
		} catch (error) {
			console.error("Error checking documents in both tabs:", error);
			return false;
		}
	}, [userId, supabase]);

	// Refresh data using dashboard provider
	const refreshAllData = useCallback(async () => {
		if (!userId) return;
		try {
			// Refresh verification data in provider
			const { data } = await supabase
				.from("profiles")
				.select(
					"verification_status, last_verification_check, accreditation_files_metadata"
				)
				.eq("id", userId)
				.single();
			const docs = data?.accreditation_files_metadata
				? Array.isArray(data.accreditation_files_metadata)
					? data.accreditation_files_metadata
					: JSON.parse(data.accreditation_files_metadata)
				: [];
			dash?.updatePartial({
				verification: {
					overallStatus: data?.verification_status || "pending",
					lastChecked: data?.last_verification_check || null,
					documentsCount: (docs || []).length,
				},
			});
		} catch (error) {
			console.error("Error refreshing data:", error);
		}
	}, [userId, supabase, dash]);

	// Update verification status when user has documents in both tabs
	useEffect(() => {
		const checkAndUpdateStatus = async () => {
			const hasBoth = await hasDocumentsInBothTabs();
			if (hasBoth && profile?.verification_status === "pending") {
				// Update verification status to "under_review" when user has documents in both tabs
				try {
					await supabase
						.from("profiles")
						.update({
							verification_status: "under_review",
							last_verification_check: new Date().toISOString(),
						})
						.eq("id", userId);

					// Update local state
					dash?.updatePartial({
						profile: {
							...(profile as any),
							verification_status: "under_review",
							last_verification_check: new Date().toISOString(),
						} as any,
					});
				} catch (error) {
					console.error("Error updating verification status:", error);
				}
			}
		};

		checkAndUpdateStatus();
	}, [
		hasDocumentsInBothTabs,
		profile?.verification_status,
		userId,
		supabase,
		dash,
		profile,
	]);

	const getCompletionPercentage = () => {
		const sections = ["professional", "verification"];
		const completedSections = sections.filter((section) =>
			getVerificationStatus(section)
		);
		return Math.round((completedSections.length / sections.length) * 100);
	};

	return (
		<div className="min-h-screen bg-gray-50 overflow-x-hidden">
			{/* Header - Mobile Only */}
			<div className="sm:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Avatar className="h-10 w-10">
							<AvatarImage src={profile?.avatar_url || ""} />
							<AvatarFallback className="bg-sauti-orange text-white">
								{profile?.first_name?.[0] || "U"}
							</AvatarFallback>
						</Avatar>
						<div>
							<h1 className="font-semibold text-gray-900">{profile?.first_name}</h1>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => signOut()}
						className="text-red-600 border-red-200 hover:bg-red-50"
					>
						Sign Out
					</Button>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-3 sm:px-4 pt-16 sm:pt-4 pb-4 sm:py-6 overflow-x-hidden">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList
						className={`grid w-full mb-4 sm:mb-6 ${
							isProfessional ? "grid-cols-4" : "grid-cols-2"
						}`}
					>
						<TabsTrigger
							value="profile"
							className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
						>
							<User className="h-3 w-3 sm:h-4 sm:w-4" />
							<span className="hidden xs:inline">Profile</span>
							<span className="xs:hidden">Profile</span>
						</TabsTrigger>
						{isProfessional && (
							<TabsTrigger
								value="verification"
								className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
							>
								<FileCheck className="h-3 w-3 sm:h-4 sm:w-4" />
								<span className="hidden xs:inline">Verification</span>
								<span className="xs:hidden">Verify</span>
							</TabsTrigger>
						)}
						{isProfessional && (
							<TabsTrigger
								value="services"
								className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
							>
								<Building className="h-3 w-3 sm:h-4 sm:w-4" />
								<span className="hidden xs:inline">Services</span>
								<span className="xs:hidden">Services</span>
							</TabsTrigger>
						)}
						<TabsTrigger
							value="settings"
							className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
						>
							<Settings className="h-3 w-3 sm:h-4 sm:w-4" />
							<span className="hidden xs:inline">Settings</span>
							<span className="xs:hidden">Settings</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="profile" className="space-y-3 sm:space-y-4">
						{/* Basic Information Display */}
						<Card>
							<CardHeader className="pb-3 sm:pb-6">
								<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
									<User className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
									Basic Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 sm:space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
									<div>
										<label className="text-xs sm:text-sm font-medium text-gray-600">
											First Name
										</label>
										<Input
											placeholder="First Name"
											value={formData.basic?.first_name ?? profileData.first_name ?? ""}
											onChange={(e) =>
												updateFormData("basic", "first_name", e.target.value)
											}
											className="mt-1 text-sm sm:text-base"
										/>
									</div>
									<div>
										<label className="text-xs sm:text-sm font-medium text-gray-600">
											Last Name
										</label>
										<Input
											placeholder="Last Name"
											value={formData.basic?.last_name ?? profileData.last_name ?? ""}
											onChange={(e) =>
												updateFormData("basic", "last_name", e.target.value)
											}
											className="mt-1 text-sm sm:text-base"
										/>
									</div>
								</div>
								<div>
									<label className="text-xs sm:text-sm font-medium text-gray-600">
										Email
									</label>
									<p className="text-sm sm:text-lg font-medium text-gray-900 mt-1 break-all">
										{profileData.email || "Not provided"}
									</p>
									<p className="text-xs text-gray-500">Email cannot be changed</p>
								</div>
								<div className="flex justify-end">
									<Button
										onClick={() => saveSection("basic")}
										size="sm"
										className="text-xs sm:text-sm"
									>
										Save Basic Information
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Anonymous Mode & Privacy */}
						<Card>
							<CardHeader className="pb-3 sm:pb-6">
								<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
									<Shield className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
									Privacy & Identity
								</CardTitle>
							</CardHeader>
							<CardContent>
								{userId && profile?.first_name && (
									<AnonymousModeToggle userId={userId} username={profile.first_name} />
								)}
							</CardContent>
						</Card>

						{/* Profile Completion Status */}
						<Card className="border-amber-200 bg-amber-50">
							<CardContent className="pt-4 sm:pt-6">
								<div className="flex items-start gap-2 sm:gap-3">
									<AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mt-0.5 flex-shrink-0" />
									<div className="flex-1 min-w-0">
										<h3 className="font-semibold text-amber-800 text-sm sm:text-base">
											Profile Completion Status
										</h3>
										<p className="text-xs sm:text-sm text-amber-700 mt-1">
											Complete your profile to access all features and improve your
											verification status.
										</p>
										<div className="mt-3">
											<div className="flex items-center gap-2 text-xs sm:text-sm text-amber-700">
												<span className="flex-shrink-0">Progress:</span>
												<div className="flex-1 bg-amber-200 rounded-full h-2 min-w-0">
													<div
														className="bg-amber-600 h-2 rounded-full transition-all duration-300"
														style={{ width: `${getCompletionPercentage()}%` }}
													></div>
												</div>
												<span className="flex-shrink-0 text-xs">
													{getCompletionPercentage()}%
												</span>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Verification Tab - Only for Professionals and NGOs */}
					{isProfessional && (
						<TabsContent value="verification" className="space-y-3 sm:space-y-4">
							<VerificationWrapper
								userId={userId || ""}
								userType={
									(profile?.user_type as "professional" | "ngo" | "survivor") ||
									"professional"
								}
								profile={profile}
								onUpdate={refreshAllData}
								onNavigateToServices={() => setActiveTab("services")}
							/>
						</TabsContent>
					)}

					{/* Services Tab - Only for Professionals and NGOs */}
					{isProfessional && (
						<TabsContent value="services" className="space-y-3 sm:space-y-4">
							<SupportServicesManager
								userId={userId || ""}
								userType={profile?.user_type || "professional"}
								verificationStatus={
									dash?.data?.verification?.overallStatus || "pending"
								}
								hasAccreditation={!!dash?.data?.verification?.documentsCount}
								hasMatches={hasMatches}
								verificationNotes={profile?.verification_notes || undefined}
								documentsCount={dash?.data?.verification?.documentsCount || 0}
								onDataUpdate={refreshAllData}
							/>
						</TabsContent>
					)}

					<TabsContent value="settings" className="space-y-3 sm:space-y-4">
						<Card>
							<CardHeader className="pb-3 sm:pb-6">
								<CardTitle className="flex items-center gap-2 text-base sm:text-lg">
									<Accessibility className="h-4 w-4 sm:h-5 sm:w-5 text-sauti-orange" />
									Accessibility Settings
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4 sm:space-y-6">
								<div className="space-y-3 sm:space-y-4">
									<h4 className="font-medium text-sm sm:text-base">
										Display Preferences
									</h4>
									<div className="space-y-3">
										<div className="flex items-start justify-between gap-2 sm:gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm sm:text-base">
													High Contrast Mode
												</p>
												<p className="text-xs sm:text-sm text-gray-600">
													Increase contrast for better visibility
												</p>
											</div>
											<input type="checkbox" className="rounded flex-shrink-0 mt-1" />
										</div>
										<div className="flex items-start justify-between gap-2 sm:gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm sm:text-base">Large Text</p>
												<p className="text-xs sm:text-sm text-gray-600">
													Increase text size for better readability
												</p>
											</div>
											<input type="checkbox" className="rounded flex-shrink-0 mt-1" />
										</div>
										<div className="flex items-start justify-between gap-2 sm:gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm sm:text-base">Reduced Motion</p>
												<p className="text-xs sm:text-sm text-gray-600">
													Minimize animations and transitions
												</p>
											</div>
											<input type="checkbox" className="rounded flex-shrink-0 mt-1" />
										</div>
									</div>
								</div>

								<div className="space-y-3 sm:space-y-4">
									<h4 className="font-medium text-sm sm:text-base">
										Notification Preferences
									</h4>
									<div className="space-y-3">
										<div className="flex items-start justify-between gap-2 sm:gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm sm:text-base">
													Email Notifications
												</p>
												<p className="text-xs sm:text-sm text-gray-600">
													Receive updates via email
												</p>
											</div>
											<input
												type="checkbox"
												className="rounded flex-shrink-0 mt-1"
												defaultChecked
											/>
										</div>
										<div className="flex items-start justify-between gap-2 sm:gap-3">
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm sm:text-base">
													SMS Notifications
												</p>
												<p className="text-xs sm:text-sm text-gray-600">
													Receive updates via SMS
												</p>
											</div>
											<input type="checkbox" className="rounded flex-shrink-0 mt-1" />
										</div>
									</div>
								</div>

								<div className="flex justify-end">
									<Button
										onClick={() => saveSection("settings")}
										size="sm"
										className="text-xs sm:text-sm"
									>
										Save Settings
									</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
