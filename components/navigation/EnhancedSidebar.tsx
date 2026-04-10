"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/logo-small.png";
import { usePathname, useRouter } from "next/navigation";
import {
	LayoutDashboard,
	MessageCircle,
	FileText,
	Calendar,
	ClipboardList,
	User,
	Settings,
	LogOut,
	ChevronLeft,
	ChevronRight,
	Bell,
	Search,
	Plus,
	Home,
	Cloud,
	Users,
	HelpCircle,
	Megaphone,
	Shield,
	BookOpen, 
	Building2,
    Network
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/(auth)/actions/auth";
import ReportAbuseForm from "@/components/ReportAbuseForm";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";

interface SidebarItem {
	id: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	href?: string;
	onClick?: () => void;
	badge?: number;
	section?: "main" | "secondary" | "footer";
	separator?: boolean;
	survivorOnly?: boolean;
	professionalOnly?: boolean;
	showDot?: boolean;
}

interface EnhancedSidebarProps {
	defaultCollapsed?: boolean;
	className?: string;
}

export function EnhancedSidebar({
	defaultCollapsed = false,
	className,
}: EnhancedSidebarProps) {
	const pathname = usePathname();
    const router = useRouter();
	const user = useUser();
	const dash = useDashboardData();
    
    // Hydration fix:
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

	const rawIsCollapsed = dash?.isSidebarCollapsed ?? defaultCollapsed;
    const isCollapsed = mounted ? rawIsCollapsed : false; // Default expanded on server to match desktop usually
    const setIsCollapsed = dash?.setIsSidebarCollapsed ?? (() => {});
	const reportDialogOpen = dash?.isReportDialogOpen || false;
	const setReportDialogOpen = dash?.setIsReportDialogOpen || (() => {});
	const [notifications, setNotifications] = useState(0);
	const [casesCount, setCasesCount] = useState<number>(0);
	const isAdminMode = dash?.isAdminMode || false;
	const supabase = useMemo(() => createClient(), []);
	const userType = dash?.data?.profile?.user_type || user?.profile?.user_type || null;
	const role = isAdminMode ? "admin" : userType;
    
    const profile = dash?.data?.profile || user?.profile;
    const hasAcceptedPolicies = !!(profile?.policies as any)?.all_policies_accepted;
    const needsOnboarding = !profile?.user_type || 
        !hasAcceptedPolicies ||
        ((profile?.user_type === 'professional' || profile?.user_type === 'ngo') && !profile?.professional_title);

    let setupProgress = 25;
    if (needsOnboarding && profile) {
        const isProRole = profile.user_type === 'professional' || profile.user_type === 'ngo';
        const totalSteps = isProRole ? 4 : 2;
        let stepCount = 0;
        if (profile.user_type) stepCount = 1;
        if (profile.user_type && hasAcceptedPolicies) stepCount = 2;
        if (isProRole && hasAcceptedPolicies && profile.professional_title) stepCount = 3;
        
        setupProgress = ((stepCount + 1) / totalSteps) * 100;
    }
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 1024) {
				setIsCollapsed(true);
			} else {
				// Don't force expand unless it was previously expanded? 
				// Actually, auto-collapse on move to mobile is good, but let's keep it simple.
				setIsCollapsed(false);
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [setIsCollapsed]);

	useEffect(() => {
		const checkAdminMode = () => {
            if (isAdminMode && pathname === "/dashboard") {
                 router.push("/dashboard/admin");
            }
		};
		checkAdminMode();
	}, [pathname, router, isAdminMode]);
	useEffect(() => {
		// Prefer provider data when available to avoid extra fetches
		if (typeof dash?.data?.casesCount === "number") {
			setCasesCount(dash.data.casesCount);
			return;
		}
		let cancelled = false;
		const loadCases = async () => {
			try {
				if (role !== "professional" && role !== "ngo") {
					if (!cancelled) setCasesCount(0);
					return;
				}
				const uid = dash?.data?.userId || user?.id;
				if (!uid) return;
				const { data: services } = await supabase
					.from("support_services")
					.select("id")
					.eq("user_id", uid);
				const ids = (services || []).map((s: any) => s.id);

                let query = supabase.from("matched_services").select("id", { count: "exact", head: true });
                
                if (ids.length > 0) {
                    query = query.or(`service_id.in.(${ids.join(',')}),hrd_profile_id.eq.${uid}`);
                } else {
                    query = query.eq("hrd_profile_id", uid);
                }

				const { count } = await query;
				if (!cancelled) setCasesCount(count || 0);
			} catch {
				// ignore
			}
		};
		loadCases();
		return () => {
			cancelled = true;
		};
	}, [dash?.data?.casesCount, dash?.data?.userId, role, user?.id, supabase]);

	const getSidebarItems = useCallback((): SidebarItem[] => {
		const isDashboard = pathname?.startsWith("/dashboard");
		const isAdminRoute = pathname?.startsWith("/dashboard/admin");

        // Onboarding State - Simplified Navigation
        if (needsOnboarding && isDashboard && !isAdminRoute) {
            return [
                {
                    id: "onboarding",
                    label: "Complete Setup",
                    icon: Shield,
                    href: "/dashboard",
                    section: "main",
                }
            ];
        }

		if (!isDashboard) {
			return [
				{ id: "home", label: "Home", icon: Home, href: "/", section: "main" },
				{
					id: "weather",
					label: "Weather Safety",
					icon: Cloud,
					href: "/weather",
					section: "main",
				},
				{
					id: "about",
					label: "About",
					icon: HelpCircle,
					href: "/about",
					section: "main",
				},
				{
					id: "dashboard",
					label: "Dashboard",
					icon: LayoutDashboard,
					href: "/dashboard",
					section: "secondary",
					separator: true,
				},
			];
		}

		// Admin Dashboard Navigation
		if (isAdminRoute || isAdminMode) {
			return [
				{
					id: "overview",
					label: "Overview",
					icon: LayoutDashboard,
					href: "/dashboard/admin",
					section: "main",
				},
				{
					id: "verification",
					label: "Verifications",
					icon: Shield,
					href: "/dashboard/admin/review", // Updated to point to Review page directly
					section: "main",
					badge: dash?.data?.verification?.pendingCount || undefined
				},
				{
					id: "services",
					label: "Services",
					icon: Building2,
					href: "/dashboard/admin/services",
					section: "main",
				},
				{
					id: "professionals",
					label: "Professionals",
					icon: Users,
					href: "/dashboard/admin/professionals",
					section: "main",
				},
				{
					id: "blogs",
					label: "Blogs & Events",
					icon: BookOpen,
					href: "/dashboard/admin/blogs",
					section: "main",
				},
				{
					id: "matching",
					label: "Matching Engine",
					icon: Network,
					href: "/dashboard/admin/matching",
					section: "main",
				},
				{
					id: "chat",
					label: "Messages",
					icon: MessageCircle,
					href: "/dashboard/chat",
					badge:
						typeof dash?.data?.unreadChatCount === "number" &&
						dash.data.unreadChatCount > 0
							? dash.data.unreadChatCount
							: undefined,
					section: "main",
				},
				{
					id: "calendar",
					label: "Calendar",
					icon: Calendar,
					href: "/dashboard/profile?section=calendar", // Link to calendar settings for now
					section: "main",
					showDot: !dash?.data?.profile?.google_calendar_token,
				},
				{
					id: "report",
					label: "Report Abuse",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
					section: "secondary",
					separator: true,
				},
			];
		}

		const baseItems: SidebarItem[] = [
			{
				id: "overview",
				label: "Overview",
				icon: LayoutDashboard,
				href: "/dashboard",
				section: "main",
			},
		];

		if (role === "survivor") {
			const survivorMain: SidebarItem[] = [
				...baseItems,
				{
					id: "reports",
					label: "My Reports",
					icon: ClipboardList,
					href: "/dashboard/reports",
					section: "main",
				},
				{
					id: "chat",
					label: "Messages",
					icon: MessageCircle,
					href: "/dashboard/chat",
					badge:
						typeof dash?.data?.unreadChatCount === "number" &&
						dash.data.unreadChatCount > 0
							? dash.data.unreadChatCount
							: undefined,
					section: "main",
				},
				{
					id: "resources",
					label: "Resources",
					icon: FileText,
					href: "/dashboard/resources",
					section: "main",
				},
				{
					id: "calendar",
					label: "Calendar",
					icon: Calendar,
					href: "/dashboard/profile?section=calendar",
					section: "main",
					showDot: !dash?.data?.profile?.google_calendar_token,
				},
			];
			return [
				...survivorMain,
				{
					id: "report",
					label: "Report Abuse",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
					section: "secondary",
					separator: true,
				},
			];
		}

		if (role === "professional" || role === "ngo") {
			const proMain: SidebarItem[] = [
				...baseItems,
				{
					id: "cases",
					label: "Cases",
					icon: ClipboardList,
					href: "/dashboard/cases",
					badge: casesCount > 0 ? casesCount : undefined,
					section: "main",
				},
				{
					id: "chat",
					label: "Messages",
					icon: MessageCircle,
					href: "/dashboard/chat",
					badge:
						typeof dash?.data?.unreadChatCount === "number" &&
						dash.data.unreadChatCount > 0
							? dash.data.unreadChatCount
							: undefined,
					section: "main",
				},
				{
					id: "resources",
					label: "Resources",
					icon: FileText,
					href: "/dashboard/resources",
					section: "main",
				},
				{
					id: "calendar",
					label: "Calendar",
					icon: Calendar,
					href: "/dashboard/profile?section=calendar",
					section: "main",
					showDot: !dash?.data?.profile?.google_calendar_token,
				},
				{
					id: "services",
					label: "Services",
					icon: Shield,
					href: "/dashboard/profile?section=services",
					section: "main",
				},
			];
			return [
				...proMain,
				{
					id: "report",
					label: "Report Abuse",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
					section: "secondary",
					separator: true,
				},

			];
		}

		return [
			...baseItems,

		];
	}, [pathname, role, casesCount, dash?.data?.unreadChatCount, dash?.data?.verification?.pendingCount]);

	// Compute items once per relevant inputs to avoid recomputing on each render
	const sidebarItems = useMemo(
		() => getSidebarItems(),
		[pathname, role, casesCount, dash?.data?.unreadChatCount, getSidebarItems]
	);

	const isActive = (item: SidebarItem) => {
		if (!item.href) return false;
		if (item.href === "/dashboard") return pathname === "/dashboard";
        
        // Fix for Admin Overview: Only active if exact match, otherwise 'Sub-pages' like 'review' take precedence
        if (item.href === "/dashboard/admin") return pathname === "/dashboard/admin";

        // Handle nested routes / sub-paths (e.g. /dashboard/admin/review should be active for /dashboard/admin/review/123)
		if (item.href !== "/dashboard" && pathname?.startsWith(item.href)) return true;
        return false;
	};

	const SidebarItemComponent = ({ item }: { item: SidebarItem }) => {
		const Icon = item.icon;
		const active = isActive(item);

		const content = (
			<div
				className={cn(
					"flex items-center rounded-2xl transition-all duration-300 my-1 overflow-hidden",
					"group cursor-pointer select-none ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-serene-blue-400 focus-visible:ring-offset-2",
					active
						? "bg-serene-blue-50 text-serene-blue-700 font-bold shadow-none" 
						: "text-serene-neutral-500 hover:bg-serene-neutral-50 hover:text-serene-blue-600 dark:text-neutral-400 dark:hover:bg-neutral-800",
					isCollapsed ? "px-0 w-12 h-12 mx-auto justify-center" : "px-4 py-3.5 mx-3 justify-start"
				)}
			>
				<div className="relative flex-shrink-0 flex items-center justify-center">
					<Icon
						className={cn(
							"h-5 w-5 transition-all duration-300",
							active
								? "text-serene-blue-600 scale-100" // Simple scale
								: "text-serene-neutral-400 group-hover:text-serene-blue-500 group-hover:scale-105"
						)}
					/>
					{item.badge && item.badge > 0 && (
										<Badge
											className={cn(
												"absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[10px] font-black shadow-sm",
												"bg-red-600 text-white border border-white min-w-[18px] ring-2 ring-red-100 animate-in zoom-in duration-300" 
											)}
										>
											{item.badge > 99 ? "99" : item.badge}
										</Badge>
					)}
					{item.showDot && (
						<div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-serene-blue-500 rounded-full border-2 border-white dark:border-neutral-900 animate-pulse" />
					)}
				</div>

				<span
					className={cn(
						"whitespace-nowrap transition-all duration-300 ease-in-out",
						isCollapsed ? "w-0 opacity-0 ml-0 overflow-hidden" : "w-auto opacity-100 ml-3 flex-1",
						active
							? "text-serene-blue-900 font-bold"
							: "font-medium group-hover:text-serene-blue-800"
					)}
				>
					{item.label}
				</span>
			</div>
		);

		if (isCollapsed) {
			return (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							{item.href ? (
								<Link href={item.href}>{content}</Link>
							) : (
								<button onClick={item.onClick}>{content}</button>
							)}
						</TooltipTrigger>
						<TooltipContent side="right">
							<p>{item.label}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			);
		}

		if (item.href) {
			return <Link href={item.href}>{content}</Link>;
		}

		return <button onClick={item.onClick}>{content}</button>;
	};

	const mainItems = sidebarItems.filter((item) => item.section === "main");
	const secondaryItems = sidebarItems.filter(
		(item) => item.section === "secondary"
	);
	const footerItems = sidebarItems.filter((item) => item.section === "footer");

	// Keep notifications in sync with unread chat count from provider
	useEffect(() => {
		if (typeof dash?.data?.unreadChatCount === "number") {
			setNotifications(dash.data.unreadChatCount);
		}
	}, [dash?.data?.unreadChatCount]);

	return (
		<>
			<div
				className={cn(
					"hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:overflow-y-auto flex-col h-screen transition-all duration-300 ease-in-out",
					"bg-white/90 backdrop-blur-2xl border-r border-serene-neutral-200/40 shadow-[1px_0_20px_rgba(0,0,0,0.02)]",
					isCollapsed ? "w-20" : "w-72",
					className
				)}
			>
				{/* Header */}
				<div className={cn(
					"flex items-center p-4 border-b border-neutral-200 dark:border-neutral-800 transition-all duration-300 overflow-hidden",
					isCollapsed ? "justify-center" : "justify-between"
				)}>
					<Link href="/dashboard" className="flex items-center overflow-hidden">
						<Image
							src={logo}
							alt="Sauti Salama"
							priority
							className="rounded-lg h-8 w-auto object-contain flex-shrink-0"
						/>
						<div className={cn(
							"transition-all duration-300 whitespace-nowrap",
							isCollapsed ? "w-0 opacity-0 ml-0 overflow-hidden" : "w-[120px] opacity-100 ml-3"
						)}>
							<h2 className="text-lg font-bold text-sauti-blue">Sauti Salama</h2>
							<p className="text-xs text-neutral-500">Safe Voice Tool</p>
						</div>
					</Link>

					{!needsOnboarding && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsCollapsed(!isCollapsed)}
							className={cn(
								"h-8 w-8 text-neutral-500 hover:bg-neutral-50 hover:text-sauti-orange flex-shrink-0 transition-all duration-300",
								isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100"
							)}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Collapsed expand button overlay */}
				{isCollapsed && !needsOnboarding && (
					<div className="absolute right-0 top-5 translate-x-1/2 z-50">
						<Button
							variant="outline"
							size="icon"
							onClick={() => setIsCollapsed(false)}
							className="h-6 w-6 rounded-full bg-white hover:bg-neutral-50 shadow-sm border-neutral-200 text-neutral-500"
						>
							<ChevronRight className="h-3 w-3" />
						</Button>
					</div>
				)}

				{/* User Info - Wrapped with Dropdown */}
				<div className="border-b border-neutral-200 dark:border-neutral-800 overflow-hidden">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<div
								suppressHydrationWarning
								className={cn(
									"flex items-center py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-300",
									isCollapsed ? "justify-center px-0 gap-0" : "px-4 gap-3"
								)}
							>
								<Avatar className="h-10 w-10 border border-neutral-200 dark:border-neutral-700 flex-shrink-0 transition-transform duration-300">
									<AvatarImage
										src={
											mounted &&
											window.localStorage.getItem("ss_anon_mode") === "1"
												? "/anon.svg"
												: dash?.data?.profile?.avatar_url ||
												  user?.profile?.avatar_url ||
												  ""
										}
										className="object-cover"
									/>
									<AvatarFallback className="bg-sauti-teal text-white font-bold">
										{dash?.data?.profile?.first_name?.[0]?.toUpperCase() ||
											user?.profile?.first_name?.[0]?.toUpperCase() ||
											user?.email?.[0]?.toUpperCase() ||
											"U"}
									</AvatarFallback>
								</Avatar>

								<div className={cn(
									"text-left transition-all duration-300 whitespace-nowrap",
									isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none" : "flex-1 min-w-0 opacity-100 w-auto"
								)}>
									<p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
										{dash?.data?.profile?.first_name || user?.email || "User"}
									</p>
									{role !== "survivor" && (
										<p className="text-xs text-neutral-500 truncate capitalize">
											{role || "Member"}
										</p>
									)}
								</div>

								<div className={cn(
									"text-neutral-400 transition-all duration-300 flex-shrink-0",
									isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-4 opacity-100"
								)}>
									<ChevronRight className="h-4 w-4 rotate-90" />
								</div>
							</div>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align={isCollapsed ? "center" : "end"}
							side={isCollapsed ? "right" : "bottom"}
							className="w-60 mb-2 ml-2 rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
							sideOffset={isCollapsed ? 10 : 8}
						>
							<DropdownMenuLabel className="font-normal p-3">
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium leading-none text-serene-neutral-900">
										{dash?.data?.profile?.first_name || user?.email || "User"}
									</p>
									<p className="text-xs leading-none text-serene-neutral-500 truncate">{user?.email}</p>
								</div>
							</DropdownMenuLabel>
							{!needsOnboarding && (
								<>
									<DropdownMenuSeparator className="bg-serene-neutral-100" />
									<DropdownMenuItem asChild>
										<Link href="/dashboard/profile" className="cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600 m-1">
											<User className="mr-2 h-4 w-4 text-serene-neutral-500" />
											<span>Profile</span>
										</Link>
									</DropdownMenuItem>
									{(role === "professional" || role === "ngo") && (
										<DropdownMenuItem asChild>
											<Link href="/dashboard/profile?section=verification" className="cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600 m-1">
												<Shield className="mr-2 h-4 w-4 text-serene-neutral-500" />
												<span>Verification & Docs</span>
											</Link>
										</DropdownMenuItem>
									)}
								</>
							)}

							<DropdownMenuSeparator className="bg-serene-neutral-100" />
							<DropdownMenuItem
								className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-xl m-1"
								asChild
							>
								<form action={signOut} className="w-full flex">
									<button className="flex w-full items-center">
										<LogOut className="mr-2 h-4 w-4" />
										<span>Sign Out</span>
									</button>
								</form>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Role Switcher */}
				{!isCollapsed && !needsOnboarding && (
					<div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
						<RoleSwitcher />
					</div>
				)}

				{/* Navigation */}
				<div className="flex-1 flex flex-col justify-between px-2 py-4">
                    {needsOnboarding && !isCollapsed ? (
                         <div className="px-3 py-4 space-y-4">
                            <div className="bg-serene-blue-50/50 border border-serene-blue-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-serene-blue-600 flex items-center justify-center shadow-lg shadow-serene-blue-200 transition-transform hover:scale-105">
                                    <Shield className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-serene-neutral-900">Setup in Progress</p>
                                    <p className="text-xs text-serene-neutral-500 mt-2 leading-relaxed">
                                        Please complete your profile to unlock all dashboard features.
                                    </p>
                                </div>
                                <div className="pt-2">
                                     <div className="h-1.5 w-full bg-serene-neutral-100 rounded-full overflow-hidden shadow-inner border border-serene-neutral-200/50">
                                        <div 
											className="h-full bg-gradient-to-r from-serene-blue-400 to-serene-blue-600 transition-all duration-700 ease-out shadow-sm" 
											style={{ width: `${setupProgress}%` }}
										/>
                                     </div>
                                </div>
								<Link href="/dashboard" className="block">
									<Button className="w-full h-9 rounded-xl text-xs font-bold bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-md">
										Continue Setup
									</Button>
								</Link>
                            </div>
                        </div>
                    ) : needsOnboarding && isCollapsed ? (
						<div className="flex flex-col items-center py-6 gap-6">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="h-10 w-10 rounded-xl bg-serene-blue-100 flex items-center justify-center cursor-help">
											<Shield className="h-5 w-5 text-serene-blue-600" />
										</div>
									</TooltipTrigger>
									<TooltipContent side="right">Setup in Progress</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					) : (
					<div className="space-y-1">
						{/* Main Navigation */}
						<div className="space-y-1">
							{mainItems.map((item) => (
								<SidebarItemComponent key={item.id} item={item} />
							))}
						</div>

						{/* Secondary Navigation */}
						{secondaryItems.length > 0 && (
							<div className="pt-6 space-y-1">
								{secondaryItems.some((item) => item.separator) && (
									<div className="px-3 pb-2">
										<div className="h-px bg-neutral-200 dark:bg-neutral-800" />
									</div>
								)}
								{secondaryItems.map((item) => (
									<SidebarItemComponent key={item.id} item={item} />
								))}
							</div>
						)}
					</div>
                    )}

					{/* Footer Navigation */}
					{!needsOnboarding && (
						<div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-1">
							{footerItems.map((item) => (
								<SidebarItemComponent key={item.id} item={item} />
							))}
						</div>
					)}
				</div>
			</div>

		{/* Report Dialog */}
			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent className="p-0 sm:max-w-4xl h-[90vh] max-sm:h-[95vh] overflow-hidden border-none text-left bg-transparent shadow-2xl max-sm:rounded-xl">
					<DialogHeader className="sr-only">
						<DialogTitle>Report Incident</DialogTitle>
						<DialogDescription>Submit an incident report</DialogDescription>
					</DialogHeader>
					<div className="h-full w-full bg-white rounded-xl sm:rounded-2xl overflow-hidden flex flex-col">
					    {/* Header removed from here as forms have their own headers */}
						{dash?.data?.userId ? (
							<AuthenticatedReportAbuseForm 
								userId={dash.data.userId} 
								onClose={() => setReportDialogOpen(false)} 
							/>
						) : (
							<ReportAbuseForm onClose={() => setReportDialogOpen(false)} />
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
