"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AnonymousModeToggle } from "@/components/chat/AnonymousModeToggle";
import { ProfessionalDocumentsForm } from "./professional-documents";
import { signOut } from "@/app/(auth)/actions/auth";
import { createClient } from "@/utils/supabase/client";
import {
	CheckCircle,
	AlertCircle,
	User,
	Shield,
	Building,
	Settings,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

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
	const user = useUser();
	const { toast } = useToast();
	const isProfessional =
		user?.profile?.user_type === "professional" ||
		user?.profile?.user_type === "ngo";
	const supabase = createClient();

	const [profileData, setProfileData] = useState<ProfileData>({});
	const [isLoading, setIsLoading] = useState(true);
	const [formData, setFormData] = useState<Record<string, any>>({});

	// Load profile data
	useEffect(() => {
		if (user?.profile) {
			setProfileData({
				bio: user.profile.bio || "",
				phone: user.profile.phone || "",
				professional_title: user.profile.professional_title || "",
				first_name: user.profile.first_name || "",
				last_name: user.profile.last_name || "",
				email: user.profile.email || "",
				isVerified: user.profile.isVerified || false,
				accreditation_files: user.profile.accreditation_files || null,
				accreditation_member_number:
					user.profile.accreditation_member_number || null,
				settings: user.profile.settings || {},
			});
			setIsLoading(false);
		}
	}, [user]);

	const updateFormData = (section: string, field: string, value: any) => {
		setFormData((prev) => ({
			...prev,
			[section]: {
				...prev[section],
				[field]: value,
			},
		}));
	};

	const saveSection = async (section: string) => {
		try {
			if (!user?.id) return;

			const sectionData = formData[section] || {};
			let updateData: any = {};

			switch (section) {
				case "basic":
					updateData = {
						first_name: sectionData.first_name || profileData.first_name,
						last_name: sectionData.last_name || profileData.last_name,
						email: sectionData.email || profileData.email,
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
					updateData = {
						accreditation_files:
							sectionData.accreditation_files || profileData.accreditation_files,
						accreditation_member_number:
							sectionData.accreditation_member_number ||
							profileData.accreditation_member_number,
					};
					break;
				case "privacy":
					updateData = {
						settings: {
							...profileData.settings,
							...sectionData,
						},
					};
					break;
			}

			const { error } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", user.id);

			if (error) throw error;

			// Update local state
			setProfileData((prev) => ({ ...prev, ...updateData }));
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
			case "basic":
				return !!(
					profileData.first_name &&
					profileData.last_name &&
					profileData.email
				);
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
			case "privacy":
				return true; // Privacy settings are always considered "complete"
			default:
				return false;
		}
	};

	const getCompletionPercentage = () => {
		const sections = ["basic", "professional", "verification", "privacy"];
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
											: user?.profile?.avatar_url || ""
									}
								/>
								<AvatarFallback className="bg-sauti-orange text-white">
									{user?.profile?.first_name?.[0]?.toUpperCase() ||
										user?.email?.[0]?.toUpperCase() ||
										"U"}
								</AvatarFallback>
							</Avatar>
							<div>
								<h1 className="text-2xl font-bold">
									{user?.profile?.first_name || user?.email || "User"}
								</h1>
								<div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
									{user?.profile?.user_type !== "survivor" && (
										<Badge variant="secondary" className="capitalize">
											{user?.profile?.user_type || "member"}
										</Badge>
									)}
									{profileData.isVerified && (
										<Badge variant="default" className="bg-green-100 text-green-800">
											<CheckCircle className="h-3 w-3 mr-1" />
											Verified
										</Badge>
									)}
									<span className="text-gray-500">
										{getCompletionPercentage()}% Complete
									</span>
								</div>
							</div>
						</div>
						<form action={signOut}>
							<Button type="submit" variant="outline">
								Log out
							</Button>
						</form>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-4xl mx-auto px-4 py-6">
				<Accordion type="multiple" className="space-y-4">
					{/* Basic Information */}
					<AccordionItem value="basic" className="border rounded-lg">
						<Card>
							<AccordionTrigger className="px-6 py-4 hover:no-underline">
								<div className="flex items-center gap-3 text-left">
									<User className="h-5 w-5 text-sauti-orange" />
									<div>
										<CardTitle className="text-lg">Basic Information</CardTitle>
										<p className="text-sm text-gray-600 mt-1">
											{getVerificationStatus("basic")
												? "Complete - Your basic information is verified"
												: "Incomplete - Please fill in your basic information for verification"}
										</p>
									</div>
									{getVerificationStatus("basic") ? (
										<CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
									) : (
										<AlertCircle className="h-5 w-5 text-amber-500 ml-auto" />
									)}
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<Input
											placeholder="First Name"
											defaultValue={profileData.first_name || ""}
											onChange={(e) =>
												updateFormData("basic", "first_name", e.target.value)
											}
										/>
										<Input
											placeholder="Last Name"
											defaultValue={profileData.last_name || ""}
											onChange={(e) =>
												updateFormData("basic", "last_name", e.target.value)
											}
										/>
										<Input
											placeholder="Email"
											type="email"
											defaultValue={profileData.email || ""}
											onChange={(e) => updateFormData("basic", "email", e.target.value)}
											className="md:col-span-2"
										/>
									</div>
									<div className="flex justify-end">
										<Button onClick={() => saveSection("basic")}>
											Save Basic Information
										</Button>
									</div>
								</CardContent>
							</AccordionContent>
						</Card>
					</AccordionItem>

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
												{getVerificationStatus("professional")
													? "Complete - Your professional information is verified"
													: "Incomplete - Please fill in your professional details for verification"}
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
												{getVerificationStatus("verification")
													? "Complete - Your verification documents are uploaded"
													: "Incomplete - Please upload your verification documents for account verification"}
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
										<ProfessionalDocumentsForm
											onSave={() => saveSection("verification")}
										/>
									</CardContent>
								</AccordionContent>
							</Card>
						</AccordionItem>
					)}

					{/* Privacy & Identity */}
					<AccordionItem value="privacy" className="border rounded-lg">
						<Card>
							<AccordionTrigger className="px-6 py-4 hover:no-underline">
								<div className="flex items-center gap-3 text-left">
									<Settings className="h-5 w-5 text-sauti-orange" />
									<div>
										<CardTitle className="text-lg">Privacy & Identity</CardTitle>
										<p className="text-sm text-gray-600 mt-1">
											Manage your privacy settings and anonymous mode preferences
										</p>
									</div>
									<CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
								</div>
							</AccordionTrigger>
							<AccordionContent>
								<CardContent className="space-y-4">
									{user?.id && user?.profile?.first_name && (
										<AnonymousModeToggle
											userId={user.id}
											username={user.profile.first_name}
										/>
									)}
									<div className="space-y-4">
										<Textarea
											placeholder="Privacy notes and preferences..."
											rows={3}
											onChange={(e) => updateFormData("privacy", "notes", e.target.value)}
										/>
										<div className="flex justify-end">
											<Button onClick={() => saveSection("privacy")}>
												Save Privacy Settings
											</Button>
										</div>
									</div>
								</CardContent>
							</AccordionContent>
						</Card>
					</AccordionItem>
				</Accordion>

				{/* Verification Status Summary */}
				{!profileData.isVerified && (
					<Card className="border-amber-200 bg-amber-50 mt-6">
						<CardContent className="pt-6">
							<div className="flex items-start gap-3">
								<AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
								<div>
									<h3 className="font-semibold text-amber-800">
										Account Verification Required
									</h3>
									<p className="text-sm text-amber-700 mt-1">
										Complete all required sections above to verify your account.
										Verification helps build trust and enables access to additional
										features.
									</p>
									<div className="mt-3">
										<div className="flex items-center gap-2 text-sm text-amber-700">
											<span>Profile Completion:</span>
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
				)}
			</div>
		</div>
	);
}
