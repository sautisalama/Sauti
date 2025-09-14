"use client";

import { useState, useEffect } from "react";
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
import { VerificationSection } from "./verification-section";
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
	const [isLoading, setIsLoading] = useState(true);
	const [formData, setFormData] = useState<Record<string, any>>({});
	const [activeTab, setActiveTab] = useState("profile");
	const [userServices, setUserServices] = useState<any[]>([]);

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
			setIsLoading(false);
		}
	}, [profile]);

	// Load user services for NGO users
	useEffect(() => {
		if (profile?.user_type === "ngo" && userId) {
			loadUserServices();
		}
	}, [profile?.user_type, userId]);

	const loadUserServices = async () => {
		try {
			const { data, error } = await supabase
				.from("support_services")
				.select("id, name, service_types")
				.eq("user_id", userId);

			if (error) throw error;
			setUserServices(data || []);
		} catch (error) {
			console.error("Error loading services:", error);
		}
	};

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

	const getCompletionPercentage = () => {
		const sections = ["professional", "verification"];
		const completedSections = sections.filter((section) =>
			getVerificationStatus(section)
		);
		return Math.round((completedSections.length / sections.length) * 100);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sauti-orange mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<div className="bg-white border-b sticky top-0 z-50">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Avatar className="h-16 w-16">
								<AvatarImage
									src={
										typeof window !== "undefined" &&
										window.localStorage.getItem("ss_anon_mode") === "1"
											? "/anon.svg"
											: profile?.avatar_url || ""
									}
								/>
								<AvatarFallback className="bg-sauti-orange text-white">
									{profile?.first_name?.[0]?.toUpperCase() ||
										profile?.email?.[0]?.toUpperCase() ||
										"U"}
								</AvatarFallback>
							</Avatar>
							<div>
								<h1 className="text-2xl font-bold">
									{profile?.first_name || profile?.email || "User"}
								</h1>
								<div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
									{profile?.user_type !== "survivor" && (
										<Badge variant="secondary" className="capitalize">
											{profile?.user_type || "member"}
										</Badge>
									)}
									{profileData.isVerified && (
										<Badge variant="default" className="bg-green-100 text-green-800">
											<CheckCircle className="h-3 w-3 mr-1" />
											Verified
										</Badge>
									)}
								</div>
							</div>
						</div>
						<form action={signOut}>
							<Button type="submit" variant="outline">
								Sign out
							</Button>
						</form>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-4xl mx-auto px-4 py-6">
				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="grid w-full grid-cols-3 mb-6">
						<TabsTrigger value="profile" className="flex items-center gap-2">
							<User className="h-4 w-4" />
							Profile
						</TabsTrigger>
						{isProfessional && (
							<TabsTrigger value="verification" className="flex items-center gap-2">
								<FileCheck className="h-4 w-4" />
								Verification
							</TabsTrigger>
						)}
						<TabsTrigger value="settings" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Settings
						</TabsTrigger>
					</TabsList>

					<TabsContent value="profile" className="space-y-4">
						{/* Basic Information Display */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5 text-sauti-orange" />
									Basic Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium text-gray-600">
											First Name
										</label>
										<Input
											placeholder="First Name"
											value={profileData.first_name || ""}
											onChange={(e) =>
												updateFormData("basic", "first_name", e.target.value)
											}
											className="mt-1"
										/>
									</div>
									<div>
										<label className="text-sm font-medium text-gray-600">Last Name</label>
										<Input
											placeholder="Last Name"
											value={profileData.last_name || ""}
											onChange={(e) =>
												updateFormData("basic", "last_name", e.target.value)
											}
											className="mt-1"
										/>
									</div>
								</div>
								<div>
									<label className="text-sm font-medium text-gray-600">Email</label>
									<p className="text-lg font-medium text-gray-900 mt-1">
										{profileData.email || "Not provided"}
									</p>
									<p className="text-xs text-gray-500">Email cannot be changed</p>
								</div>
								<div className="flex justify-end">
									<Button onClick={() => saveSection("basic")}>
										Save Basic Information
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Anonymous Mode & Privacy */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="h-5 w-5 text-sauti-orange" />
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
							<CardContent className="pt-6">
								<div className="flex items-start gap-3">
									<AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
									<div className="flex-1">
										<h3 className="font-semibold text-amber-800">
											Profile Completion Status
										</h3>
										<p className="text-sm text-amber-700 mt-1">
											Complete your profile to access all features and improve your
											verification status.
										</p>
										<div className="mt-3">
											<div className="flex items-center gap-2 text-sm text-amber-700">
												<span>Overall Progress:</span>
												<div className="flex-1 bg-amber-200 rounded-full h-2">
													<div
														className="bg-amber-600 h-2 rounded-full transition-all duration-300"
														style={{ width: `${getCompletionPercentage()}%` }}
													></div>
												</div>
												<span>{getCompletionPercentage()}%</span>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						<Accordion type="multiple" className="space-y-4">
							{/* Professional Information (for professionals only) */}
							{isProfessional && (
								<AccordionItem value="professional" className="border rounded-lg">
									<Card>
										<AccordionTrigger className="px-6 py-4 hover:no-underline">
											<div className="flex items-center gap-3 text-left">
												<Building className="h-5 w-5 text-sauti-orange" />
												<div>
													<CardTitle className="text-lg">Professional Information</CardTitle>
													<p className="text-sm text-gray-600 mt-1">
														Manage your professional details and credentials
													</p>
												</div>
												{getVerificationStatus("professional") ? (
													<CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
												) : (
													<AlertCircle className="h-5 w-5 text-amber-500 ml-auto" />
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent>
											<CardContent className="space-y-4">
												<div className="space-y-4">
													<Input
														placeholder="Professional Title"
														defaultValue={profileData.professional_title || ""}
														onChange={(e) =>
															updateFormData(
																"professional",
																"professional_title",
																e.target.value
															)
														}
													/>
													<Input
														placeholder="Phone Number"
														defaultValue={profileData.phone || ""}
														onChange={(e) =>
															updateFormData("professional", "phone", e.target.value)
														}
													/>
													<Textarea
														placeholder="Professional Bio - Describe your expertise, specialties, and languages..."
														rows={4}
														defaultValue={profileData.bio || ""}
														onChange={(e) =>
															updateFormData("professional", "bio", e.target.value)
														}
													/>
												</div>
												<div className="flex justify-end">
													<Button onClick={() => saveSection("professional")}>
														Save Professional Information
													</Button>
												</div>
											</CardContent>
										</AccordionContent>
									</Card>
								</AccordionItem>
							)}

							{/* Verification Documents (for professionals only) */}
							{isProfessional && (
								<AccordionItem value="verification" className="border rounded-lg">
									<Card>
										<AccordionTrigger className="px-6 py-4 hover:no-underline">
											<div className="flex items-center gap-3 text-left">
												<Shield className="h-5 w-5 text-sauti-orange" />
												<div>
													<CardTitle className="text-lg">Verification Documents</CardTitle>
													<p className="text-sm text-gray-600 mt-1">
														Upload your professional credentials and verification documents
													</p>
												</div>
												{getVerificationStatus("verification") ? (
													<CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
												) : (
													<AlertCircle className="h-5 w-5 text-amber-500 ml-auto" />
												)}
											</div>
										</AccordionTrigger>
										<AccordionContent>
											<CardContent className="space-y-4">
												{profile?.user_type === "ngo" ? (
													<EnhancedProfessionalDocumentsForm
														onSave={() => saveSection("verification")}
														onSaveDocuments={saveVerificationDocuments}
														initialData={{
															accreditation_files: profileData.accreditation_files,
															accreditation_member_number:
																profileData.accreditation_member_number,
														}}
														userId={userId || ""}
														userType={profile?.user_type || "professional"}
														existingServices={userServices}
													/>
												) : (
													<ProfessionalDocumentsForm
														onSave={() => saveSection("verification")}
														onSaveDocuments={saveVerificationDocuments}
														initialData={{
															accreditation_files: profileData.accreditation_files,
															accreditation_member_number:
																profileData.accreditation_member_number,
														}}
													/>
												)}
											</CardContent>
										</AccordionContent>
									</Card>
								</AccordionItem>
							)}
						</Accordion>
					</TabsContent>

					{/* Verification Tab - Only for Professionals and NGOs */}
					{isProfessional && (
						<TabsContent value="verification" className="space-y-4">
							<VerificationSection
								userId={userId || ""}
								userType={profile?.user_type || "professional"}
								profile={profile}
								onUpdate={() => {
									// Refresh profile data when verification is updated
									window.location.reload();
								}}
							/>
						</TabsContent>
					)}

					<TabsContent value="settings" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Accessibility className="h-5 w-5 text-sauti-orange" />
									Accessibility Settings
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-4">
									<h4 className="font-medium">Display Preferences</h4>
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">High Contrast Mode</p>
												<p className="text-sm text-gray-600">
													Increase contrast for better visibility
												</p>
											</div>
											<input type="checkbox" className="rounded" />
										</div>
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">Large Text</p>
												<p className="text-sm text-gray-600">
													Increase text size for better readability
												</p>
											</div>
											<input type="checkbox" className="rounded" />
										</div>
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">Reduced Motion</p>
												<p className="text-sm text-gray-600">
													Minimize animations and transitions
												</p>
											</div>
											<input type="checkbox" className="rounded" />
										</div>
									</div>
								</div>

								<div className="space-y-4">
									<h4 className="font-medium">Privacy & Identity</h4>
									{userId && profile?.first_name && (
										<AnonymousModeToggle userId={userId} username={profile.first_name} />
									)}
								</div>

								<div className="space-y-4">
									<h4 className="font-medium">Notification Preferences</h4>
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">Email Notifications</p>
												<p className="text-sm text-gray-600">Receive updates via email</p>
											</div>
											<input type="checkbox" className="rounded" defaultChecked />
										</div>
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium">SMS Notifications</p>
												<p className="text-sm text-gray-600">Receive updates via SMS</p>
											</div>
											<input type="checkbox" className="rounded" />
										</div>
									</div>
								</div>

								<div className="flex justify-end">
									<Button onClick={() => saveSection("settings")}>Save Settings</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
