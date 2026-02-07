"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { AnonymousModeToggle } from "@/components/chat/AnonymousModeToggle";
import { MobileVerificationSection } from "./mobile-verification-section";
import { SupportServicesManager } from "./support-services-manager";
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
	Type
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { SereneBreadcrumb, SereneSectionHeader } from "../_components/SurvivorDashboardComponents";

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
		// Trigger dashboard refresh logic if needed
	}, [userId]);

	const navItems = [
		{ id: 'account', label: 'Account Information', icon: User },
		{ id: 'privacy', label: 'Privacy & Security', icon: Shield },
		{ id: 'accessibility', label: 'Accessibility', icon: Contrast },
		{ id: 'settings', label: 'App Settings', icon: Settings },
	];

	if (isProfessional) {
		navItems.splice(1, 0, { id: 'verification', label: 'Verification & Docs', icon: Shield });
		navItems.splice(2, 0, { id: 'services', label: 'My Services', icon: Shield });
	}

	return (
		<div className="min-h-screen bg-serene-neutral-50/50 pb-20 pt-2"> {/* Reduced top padding, softer bg */}
			{/* Breadcrumb Header */}
			<div className="px-4 md:px-8 py-4"> {/* Compact header padding */}
				<SereneBreadcrumb items={[
					{ label: 'Profile', href: '/dashboard/profile' },
					{ label: activeSection.charAt(0).toUpperCase() + activeSection.slice(1) }
				]} />
				<SereneSectionHeader 
					title="Profile & Settings" 
					description="Manage your account, privacy, and preferences"
					className="mt-2 text-2xl" // Smaller margin
				/>
			</div>

			<div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Sidebar Menu - Hidden on mobile, shows as horizontal tabs */}
				<div className="hidden lg:block lg:col-span-3 space-y-2 sticky top-6 h-fit">
					<div className="bg-white/80 backdrop-blur-xl rounded-2xl p-2 border border-serene-neutral-200/60 shadow-sm">
					{navItems.map(item => (
						<button
							key={item.id}
							onClick={() => router.push(`/dashboard/profile?section=${item.id}`)}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
								activeSection === item.id 
									? "bg-serene-blue-50 text-serene-blue-700 font-bold shadow-sm" 
									: "text-serene-neutral-600 hover:bg-serene-neutral-50 hover:text-serene-blue-600"
							}`}
						>
							<item.icon className={`h-4.5 w-4.5 ${activeSection === item.id ? "text-serene-blue-600" : "text-serene-neutral-400"}`} />
							<span className="text-sm tracking-wide">{item.label}</span>
							{activeSection === item.id && (
								<div className="ml-auto w-1 h-1 rounded-full bg-serene-blue-500" />
							)}
						</button>
					))}
					</div>
					
					<div className="pt-2">
						<button 
							onClick={() => signOut()}
							className="w-full flex items-center gap-3 px-6 py-3.5 rounded-2xl text-red-600 hover:bg-red-50/80 border border-transparent hover:border-red-100 transition-all font-medium text-sm"
						>
							<LogOut className="h-4.5 w-4.5" />
							<span>Sign Out</span>
						</button>
					</div>
				</div>

	

				{/* Mobile Navigation Tabs */}
				<div className="lg:hidden col-span-1 -mt-2 mb-4">
					<div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
						{navItems.map(item => (
							<button
								key={item.id}
								onClick={() => router.push(`/dashboard/profile?section=${item.id}`)}
								className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
									activeSection === item.id 
										? "bg-sauti-teal text-white shadow-md" 
										: "bg-white text-serene-neutral-600 border border-serene-neutral-200"
								}`}
							>
								<item.icon className="h-4 w-4" />
								{item.label}
							</button>
						))}
					</div>
				</div>

				{/* Content Area */}
				<div className="lg:col-span-9 space-y-6">
					
					{/* Header Card - Hidden on Accessibility and Settings tabs */}
				{!['accessibility', 'settings'].includes(activeSection) && (
					<Card className="rounded-[2rem] border-serene-neutral-200/60 shadow-sm overflow-hidden bg-white group hover:shadow-md transition-all duration-500">
						<div className="h-24 sm:h-40 bg-gradient-to-r from-sauti-teal/10 via-sauti-teal/5 to-sauti-teal/10 relative overflow-hidden">
							<div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
						</div>
						<div className="px-4 sm:px-8 pb-6 sm:pb-8 relative">
							{/* Avatar - stacked on mobile, positioned on desktop */}
							<div className="flex flex-col sm:flex-row sm:items-end gap-4">
								<div className="relative -mt-12 sm:-mt-16 mx-auto sm:mx-0">
									<div className="relative group/avatar">
										<Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 sm:border-[6px] border-white shadow-lg cursor-pointer transition-transform duration-300 group-hover/avatar:scale-[1.02]">
											<AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
											<AvatarFallback className="bg-gradient-to-br from-sauti-teal to-sauti-dark text-white text-2xl sm:text-3xl font-bold">
												{profile?.first_name?.[0] || "U"}
											</AvatarFallback>
										</Avatar>
										<div className="absolute inset-0 bg-black/10 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[1px]">
											<Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow-md" />
										</div>
									</div>
								</div>
								{/* User info - centered on mobile, beside avatar on desktop */}
								<div className="flex-1 text-center sm:text-left pb-0 sm:pb-2">
									<h2 className="text-xl sm:text-3xl font-bold text-sauti-dark tracking-tight">{profile?.first_name} {profile?.last_name}</h2>
									<p className="text-serene-neutral-500 text-sm sm:text-base font-medium mt-1">{profile?.email}</p>
									{isProfessional && (
										<div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sauti-teal/10 text-sauti-teal rounded-full text-xs font-bold uppercase tracking-wider mt-3">
											<Shield className="h-3 w-3" />
											Professional Support
										</div>
									)}
								</div>
							</div>
						</div>
					</Card>
				)}

					{/* Section: Account */}
					{activeSection === 'account' && (
						<Card className="rounded-[2rem] border-serene-neutral-200/60 shadow-sm bg-white overflow-hidden">
							<CardHeader className="border-b border-serene-neutral-100 pb-6">
								<CardTitle className="text-xl text-serene-neutral-900">Basic Information</CardTitle>
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
								
								<div className="flex justify-end">
									<Button onClick={() => saveSection("basic")} className="bg-sauti-teal hover:bg-sauti-dark text-white rounded-xl h-11 px-6">
										<Save className="h-4 w-4 mr-2" /> Save Changes
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Section: Privacy */}
					{activeSection === 'privacy' && (
						<div className="space-y-6">
							<Card className="rounded-3xl border-serene-neutral-200 shadow-sm bg-white">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Shield className="h-5 w-5 text-serene-blue-500" />
										Anonymous Mode
									</CardTitle>
								</CardHeader>
								<CardContent>
									{userId && profile?.first_name && (
										<AnonymousModeToggle userId={userId} username={profile.first_name} />
									)}
									<p className="mt-4 text-sm text-serene-neutral-500 leading-relaxed">
										Enabling anonymous mode will hide your real name from other users in community spaces and chats.
									</p>
								</CardContent>
							</Card>
						</div>
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
							<MobileVerificationSection
								userId={userId || ""}
								userType={(profile?.user_type as any) || "professional"}
								onUploadSuccess={refreshAllData}
							/>
						</div>
					)}

					{/* Section: Services */}
					{activeSection === 'services' && isProfessional && (
						<SupportServicesManager
							userId={userId || ""}
							userType={profile?.user_type || "professional"}
							verificationStatus={dash?.data?.verification?.overallStatus || "pending"}
							hasAccreditation={!!dash?.data?.verification?.documentsCount}
							hasMatches={false}
							documentsCount={dash?.data?.verification?.documentsCount || 0}
							onDataUpdate={refreshAllData}
						/>
					)}

				</div>
			</div>
		</div>
	);
}
