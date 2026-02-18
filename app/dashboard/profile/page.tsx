"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { AnonymousModeToggle } from "@/components/chat/AnonymousModeToggle";
import { MobileVerificationSection } from "./mobile-verification-section";
import { VerificationSection } from "./verification-section";
import { SupportServicesManager } from "./support-services-manager";
import { PrivacySecuritySettings } from "./privacy-security-settings";
import { CalendarIntegrationSettings } from "./calendar-integration-settings";
import { signOut } from "@/app/(auth)/actions/auth";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { useAccessibility } from "@/components/a11y/AccessibilityProvider";
import {
	User,
	Shield,
	Settings,
	Camera,
	Save,
	LogOut,
	ChevronRight,
	Contrast,
	MousePointer2,
	Type as FontIcon,
	Underline,
	RefreshCw,
	Type,
	Calendar,
	AlertCircle
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { SereneBreadcrumb, SereneSectionHeader } from "../_components/SurvivorDashboardComponents";
import {Alert, AlertDescription, AlertTitle	} from "@/components/ui/alert"

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
	const isProfessional = profile?.user_type === "professional" || profile?.user_type === "ngo";
	const supabase = createClient();
	const router = useRouter();
	const a11y = useAccessibility();

	const [profileData, setProfileData] = useState<ProfileData>({});
	const [formData, setFormData] = useState<Record<string, any>>({});
	const searchParams = useSearchParams();
	const activeSection = searchParams?.get("section") || "account";

	// Data Sync
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
			}

			if (Object.keys(updateData).length === 0) return;

			const { error } = await supabase
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (error) throw error;

			setProfileData((prev) => ({ ...prev, ...updateData }));
			
			// Clear form data for this section so inputs reflect the new saved state
			setFormData(prev => ({
				...prev,
				[section]: {} 
			}));

			dash?.updatePartial({
				profile: {
					...(profile as any),
					...updateData,
					updated_at: new Date().toISOString(),
				} as any,
			});
			toast({
				title: "Success",
				description: "Profile updated successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to update profile",
				variant: "destructive",
			});
		}
	};

	const refreshAllData = useCallback(async () => {
		if (!userId) return;
		
		try {
			const { data: updatedProfile, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();
				
			if (error) throw error;
			
			if (updatedProfile && dash) {
				dash.updatePartial({
					profile: updatedProfile
				});
                
                // Also update local state
                if (updatedProfile) {
                    setProfileData(prev => ({
                        ...prev,
                        isVerified: (updatedProfile as any).verification_status === 'verified',
                        accreditation_files: (updatedProfile as any).accreditation_files_metadata,
                        // Update other fields as needed
                    }));
                }
			}
		} catch (error) {
			console.error("Failed to refresh profile data:", error);
		}
	}, [userId, supabase, dash]);

	const navItems = [
		{ id: 'account', label: 'Account Information', icon: User },
		{ id: 'privacy', label: 'Privacy & Security', icon: Shield },
		{ id: 'accessibility', label: 'Accessibility', icon: Contrast },
		{ id: 'calendar', label: 'Calendar', icon: Calendar },
		{ id: 'settings', label: 'App Settings', icon: Settings },
	];

	if (isProfessional) {
		navItems.splice(1, 0, { id: 'verification', label: 'Verification & Docs', icon: Shield });
		navItems.splice(2, 0, { id: 'services', label: 'My Services', icon: Shield });
	}

	return (
		<div className="h-screen flex flex-col bg-serene-neutral-50/30 overflow-y-auto">
			{/* Fixed Header section */}
			<div className="flex-none px-4 md:px-8 py-3 md:py-4 bg-serene-neutral-50/80 backdrop-blur-md border-b border-serene-neutral-200/50 z-20">
				<div className="max-w-6xl mx-auto w-full">
					<SereneBreadcrumb items={[
						{ label: 'Profile', href: '/dashboard/profile' },
						{ label: activeSection.charAt(0).toUpperCase() + activeSection.slice(1) }
					]} />
					<h1 className="text-xl font-bold text-serene-neutral-900 mt-1">Profile & Settings</h1>
				</div>
			</div>

            {/* Profile Verification Banner - Just below header */}
            {(profile?.verification_status === 'rejected' || (profile as any)?.accreditation_notes) && (
                 <div className="px-4 md:px-8 pt-4">
                     <div className="max-w-6xl mx-auto w-full">
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
                             <div className="bg-red-100 rounded-full p-2 text-red-600 mt-0.5">
                                 <Shield className="h-5 w-5" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-red-900">Verification Rejected</h3>
                                 <p className="text-sm text-red-800 mt-1 whitespace-pre-line">
                                     {profile?.verification_notes || "Please check your documents and resubmit."}
                                 </p>
                             </div>
                        </div>
                     </div>
                 </div>
            )}

			{/* Main Layout - Fixed height container with scrollable content area */}
			<div className="flex-1 w-full">
				<div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
					
					{/* Sidebar Menu - Fixed on desktop */}
					<div className="hidden lg:block lg:col-span-3 py-6">
						<div className="bg-white/95 backdrop-blur-xl rounded-2xl p-3 border border-serene-neutral-100 shadow-sm sticky top-0">
							{navItems.map(item => (
								<button
									key={item.id}
									onClick={() => router.push(`/dashboard/profile?section=${item.id}`)}
									className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
										activeSection === item.id 
											? "bg-serene-blue-50/80 text-serene-blue-700 font-semibold shadow-sm" 
											: "text-serene-neutral-600 hover:bg-serene-neutral-50/80 hover:text-serene-neutral-900"
									}`}
								>
									<item.icon className={`h-4 w-4 ${activeSection === item.id ? "text-serene-blue-600" : "text-serene-neutral-400"}`} />
									<span className="text-sm">{item.label}</span>
									{activeSection === item.id && (
										<div className="ml-auto w-1.5 h-1.5 rounded-full bg-serene-blue-500" />
									)}
								</button>
							))}
						</div>
					</div>

					{/* Content Area - Scrolls with page */}
					<div className="lg:col-span-9 py-6 pb-32">
						
						{/* Mobile Navigation Tabs - Sticky within content on mobile */}
						<div className="lg:hidden mb-6 sticky top-0 z-10 bg-serene-neutral-50/95 backdrop-blur-sm py-2 -mx-4 px-4 border-b border-serene-neutral-200/50">
							<div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
								{navItems.map(item => (
									<button
										key={item.id}
										onClick={() => router.push(`/dashboard/profile?section=${item.id}`)}
										className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
											activeSection === item.id 
												? "bg-serene-blue-600 text-white shadow-md shadow-serene-blue-500/20" 
												: "bg-white text-serene-neutral-600 border border-serene-neutral-200"
										}`}
									>
										<item.icon className="h-4 w-4" />
										{item.label}
									</button>
								))}
							</div>
						</div>

						<div className="space-y-4">
							{/* Header Card - Only shown on Account tab */}
							{activeSection === 'account' && (
								<Card className="rounded-[1.75rem] border-serene-neutral-100 shadow-sm overflow-hidden bg-white">
									<div className="h-28 sm:h-32 bg-gradient-to-br from-serene-blue-50 via-serene-neutral-50 to-serene-blue-50/30 relative overflow-hidden">
										<div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(100,140,180,0.08),transparent_70%)]" />
									</div>
									<div className="px-5 sm:px-8 pb-5 sm:pb-6 relative">
										{/* Avatar */}
										<div className="flex flex-col sm:flex-row sm:items-end gap-4">
											<div className="relative -mt-12 sm:-mt-14 mx-auto sm:mx-0">
												<div className="relative group/avatar">
													<Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-white shadow-lg cursor-pointer transition-transform duration-300 group-hover/avatar:scale-[1.02]">
														<AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
														<AvatarFallback className="bg-gradient-to-br from-serene-blue-500 to-serene-blue-700 text-white text-xl sm:text-2xl font-bold">
															{profile?.first_name?.[0] || "U"}
														</AvatarFallback>
													</Avatar>
													<div className="absolute inset-0 bg-black/10 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
														<Camera className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-md" />
													</div>
												</div>
											</div>
											{/* User info */}
											<div className="flex-1 text-center sm:text-left pb-0">
												<h2 className="text-xl sm:text-2xl font-bold text-serene-neutral-900 tracking-tight">
													{profileData.first_name || profile?.first_name} {profileData.last_name || profile?.last_name}
												</h2>
												<p className="text-serene-neutral-500 text-sm font-medium mt-0.5">
													{profileData.email || profile?.email}
												</p>
												{isProfessional && (
													<div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-serene-blue-50 text-serene-blue-700 rounded-full text-xs font-semibold mt-2">
														<Shield className="h-3 w-3" />
														{profile?.user_type === 'professional' ? 'Service Provider' : 'Organisation'}
													</div>
												)}
											</div>
										</div>
									</div>
								</Card>
							)}

							{/* Section: Account */}
							{activeSection === 'account' && (
								<div className="space-y-6">
									{profile?.verification_status === 'rejected' && (
										<Alert variant="destructive" className="bg-red-50 border-red-100 rounded-2xl p-4">
											<AlertCircle className="h-4 w-4" />
											<AlertTitle>Profile Information Rejected</AlertTitle>
											<AlertDescription className="mt-1">
												Your personal details or identity documents were rejected. Please check the Admin Notes above and update your information.
											</AlertDescription>
										</Alert>
									)}

									<Card className="rounded-[2rem] border-serene-neutral-200/60 shadow-sm bg-white overflow-hidden">
										<CardHeader className="border-b border-serene-neutral-100 pb-4 pt-6 px-6 sm:px-8">
											<CardTitle className="text-lg text-serene-neutral-900">Basic Information</CardTitle>
										</CardHeader>
										<CardContent className="space-y-8 pt-8">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
												<div className="space-y-2">
													<label className="text-sm font-semibold text-serene-neutral-700">First Name</label>
													<Input 
														value={formData.basic?.first_name ?? profileData.first_name ?? ""} 
														onChange={(e) => updateFormData("basic", "first_name", e.target.value)}
														className="rounded-xl border-serene-neutral-300 focus-visible:ring-serene-blue-200 bg-serene-neutral-50/50 h-11"
													/>
												</div>
												<div className="space-y-2">
													<label className="text-sm font-semibold text-serene-neutral-700">Last Name</label>
													<Input 
														value={formData.basic?.last_name ?? profileData.last_name ?? ""} 
														onChange={(e) => updateFormData("basic", "last_name", e.target.value)}
														className="rounded-xl border-serene-neutral-300 focus-visible:ring-serene-blue-200 bg-serene-neutral-50/50 h-11"
													/>
												</div>
											</div>
											
											<div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 sm:mt-0">
												<Button onClick={() => saveSection("basic")} className="w-full sm:w-auto bg-sauti-teal hover:bg-sauti-dark text-white rounded-xl h-11 px-6 shadow-sm">
													<Save className="h-4 w-4 mr-2" /> Save Changes
												</Button>
											</div>
										</CardContent>
									</Card>
								</div>
							)}

							{/* Section: Privacy */}
							{activeSection === 'privacy' && (
								<PrivacySecuritySettings />
							)}

							{/* Section: Accessibility */}
							{activeSection === 'accessibility' && (
								<div className="space-y-6">
									<Card className="rounded-[2rem] border-serene-neutral-200 shadow-sm bg-white overflow-hidden">
										<CardHeader className="border-b border-serene-neutral-100 pb-6">
											<CardTitle className="flex items-center gap-2 text-xl text-serene-neutral-900">
												<Contrast className="h-6 w-6 text-serene-blue-500" />
												Accessibility Settings
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-6 pt-8">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												{[
													{ label: "High Contrast", prop: "highContrast", icon: Contrast },
													{ label: "Reduce Motion", prop: "reduceMotion", icon: MousePointer2 },
													{ label: "Readable Font", prop: "readableFont", icon: FontIcon },
													{ label: "Dyslexic Font", prop: "dyslexic", icon: Type },
													{ label: "Underline Links", prop: "underlineLinks", icon: Underline },
												].map((item: any) => {
													const isOn = !!(a11y as any)[item.prop];
													return (
														<button
															key={item.prop}
															onClick={() => a11y.set({ [item.prop]: !isOn })}
															className={`
																flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all duration-200 group
																${isOn 
																	? "bg-serene-blue-50 border-serene-blue-500 text-serene-blue-700 shadow-sm" 
																	: "bg-white border-serene-neutral-100 text-serene-neutral-600 hover:border-serene-neutral-200 hover:bg-serene-neutral-50"
																}
															`}
														>
															<div className="flex items-center gap-4">
																<div className={`
																	p-2 rounded-xl transition-colors
																	${isOn ? "bg-serene-blue-500 text-white" : "bg-serene-neutral-100 text-serene-neutral-400 group-hover:text-serene-neutral-500"}
																`}>
																	<item.icon className="h-5 w-5" />
																</div>
																<span className="font-bold text-sm">{item.label}</span>
															</div>
															<div className={`
																relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out
																${isOn ? "bg-serene-blue-500" : "bg-serene-neutral-200"}
															`}>
																<span className={`
																	pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
																	${isOn ? "translate-x-5" : "translate-x-0"}
																`} />
															</div>
														</button>
													);
												})}
											</div>

											<div className="pt-6 border-t border-serene-neutral-100">
												<div className="mb-4 flex items-center gap-2 text-serene-neutral-500 font-bold uppercase tracking-widest text-xs">
													<Type className="h-4 w-4" /> Text Scale
												</div>
												<div className="flex flex-wrap gap-3">
													{[100, 112.5, 125, 137.5, 150].map((s) => (
														<button
															key={s}
															onClick={() => a11y.set({ textScale: s })}
															className={`
																flex-1 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all
																${a11y.textScale === s
																	? "bg-serene-blue-500 border-serene-blue-500 text-white shadow-md transform scale-105"
																	: "bg-white border-serene-neutral-100 text-serene-neutral-500 hover:border-serene-neutral-200"
																}
															`}
														>
															{s}%
														</button>
													))}
												</div>
											</div>

											<div className="pt-4">
												<Button 
													onClick={() => a11y.reset()}
													variant="ghost" 
													className="w-full h-12 rounded-xl text-serene-neutral-400 hover:text-red-500 hover:bg-red-50"
												>
													<RefreshCw className="h-4 w-4 mr-2" /> Reset All Settings
												</Button>
											</div>
										</CardContent>
									</Card>
								</div>
							)}

							{/* Section: Professional Verification */}
							{activeSection === 'verification' && isProfessional && (
								<div className="space-y-6">
									{/* Mobile view (< md) */}
									<div className="md:hidden">
										<MobileVerificationSection
											userId={userId || ""}
											userType={(profile?.user_type as any) || "professional"}
											profile={profile}
											onUpdate={refreshAllData}
											onNavigateToServices={() => router.push('/dashboard/profile?section=services')}
											onUploadSuccess={refreshAllData}
										/>
									</div>
									
									{/* Desktop view (>= md) */}
									<div className="hidden md:block">
										<VerificationSection
											userId={userId || ""}
											userType={(profile?.user_type as any) || "professional"}
											profile={profile}
											onUpdate={refreshAllData}
											onNavigateToServices={() => router.push('/dashboard/profile?section=services')}
										/>
									</div>
								</div>
							)}

							{/* Section: Services */}
							{activeSection === 'services' && isProfessional && (
								<div className="space-y-6">
									{dash?.data?.supportServices?.some((s: any) => s.verification_status === 'rejected') && (
										<Alert variant="destructive" className="bg-red-50 border-red-100 rounded-2xl p-4">
											<AlertCircle className="h-4 w-4" />
											<AlertTitle>Action Required on Services</AlertTitle>
											<AlertDescription className="mt-1">
												One or more of your services have been rejected. Please review the specific service details below to fix the issues.
											</AlertDescription>
										</Alert>
									)}

									<SupportServicesManager
										userId={userId || ""}
										userType={profile?.user_type || "professional"}
										verificationStatus={dash?.data?.verification?.overallStatus || "pending"}
										hasAccreditation={!!dash?.data?.verification?.documentsCount}
										hasMatches={false}
										documentsCount={dash?.data?.verification?.documentsCount || 0}
										onDataUpdate={refreshAllData}
									/>
								</div>
							)}

							{/* Section: Calendar Integration */}
							{activeSection === 'calendar' && (
								<CalendarIntegrationSettings
									userId={userId || ""}
									isProfessional={isProfessional}
								/>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
