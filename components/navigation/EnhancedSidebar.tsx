"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
	const user = useUser();
	const dash = useDashboardData();
    
    // Hydration fix:
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

	const rawIsCollapsed = dash?.isSidebarCollapsed ?? defaultCollapsed;
    const isCollapsed = mounted ? rawIsCollapsed : false; // Default expanded on server to match desktop usually
    const setIsCollapsed = dash?.setIsSidebarCollapsed ?? (() => {});
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [notifications, setNotifications] = useState(0);
	const [casesCount, setCasesCount] = useState<number>(0);
	const [isAdminMode, setIsAdminMode] = useState(false);
	const supabase = useMemo(() => createClient(), []);
	const role = (dash?.data?.userType as any) ?? user?.profile?.user_type;


	// Auto-collapse on mobile screen sizes
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

	// Listen for Admin Mode changes
	useEffect(() => {
		const checkAdminMode = () => {
			const mode = localStorage.getItem("adminMode") === "true";
			setIsAdminMode(mode);
		};

		// Initial check
		checkAdminMode();

		// Listen for custom event from RoleSwitcher
		window.addEventListener("adminModeChanged", checkAdminMode);
		
		// Also listen for storage events (if changed in another tab)
		window.addEventListener("storage", checkAdminMode);

		return () => {
			window.removeEventListener("adminModeChanged", checkAdminMode);
			window.removeEventListener("storage", checkAdminMode);
		};
	}, []);

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
				if (ids.length === 0) {
					if (!cancelled) setCasesCount(0);
					return;
				}
				const { count } = await supabase
					.from("matched_services")
					.select("id", { count: "exact", head: true })
					.in("service_id", ids);
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
					id: "verifications",
					label: "Verifications",
					icon: Shield,
					href: "/dashboard/admin/verifications",
					section: "main",
					badge: dash?.data?.verification?.pendingCount || undefined
				},
				{
					id: "content",
					label: "Content Management",
					icon: FileText,
					href: "/dashboard/admin/content",
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
					id: "users",
					label: "User Management",
					icon: Users,
					href: "/dashboard/admin/users",
					section: "secondary",
					separator: true
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/profile?tab=settings",
					section: "footer",
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
					id: "appointments",
					label: "Appointments",
					icon: Calendar,
					href: "/dashboard/appointments",
					section: "main",
				},
			];
			return [
				...survivorMain,
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/profile?tab=settings",
					section: "footer",
				},
			];
		}

		if (role === "professional" || role === "ngo") {
			const proMain: SidebarItem[] = [
				...baseItems,
				{
					id: "cases",
					label: "Case Management",
					icon: ClipboardList,
					href: "/dashboard/cases",
					badge: casesCount > 0 ? casesCount : undefined,
					section: "main",
				},
				{
					id: "reports",
					label: "My reports",
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
			];
			return [
				...proMain,
				{
					id: "services",
					label: "My Services",
					icon: Plus,
					href: "/dashboard/services",
					section: "secondary",
					separator: true,
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/profile?tab=settings",
					section: "footer",
				},
			];
		}

		return [
			...baseItems,
			{
				id: "settings",
				label: "Settings",
				icon: Settings,
				href: "/dashboard/settings",
				section: "footer",
			},
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
		return pathname?.startsWith(item.href);
	};

	const SidebarItemComponent = ({ item }: { item: SidebarItem }) => {
		const Icon = item.icon;
		const active = isActive(item);

		const content = (
			<div
				className={cn(
					"flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 mx-3 my-1", // Increased margin x, added margin y
					"group cursor-pointer select-none ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-serene-blue-400 focus-visible:ring-offset-2",
					active
						? "bg-serene-blue-50 text-serene-blue-700 font-bold shadow-none" // Softer active state
						: "text-serene-neutral-500 hover:bg-serene-neutral-50 hover:text-serene-blue-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
				)}
			>
				<div className="relative flex items-center justify-center">
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
								"absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[9px] font-bold shadow-sm",
								"bg-serene-red-500 text-white border border-white dark:border-neutral-950 min-w-[16px]" // Red for urgency/notification typically more standard, but using brand red if available or error red
							)}
						>
							{item.badge > 99 ? "99" : item.badge}
						</Badge>
					)}
				</div>

				{!isCollapsed && (
					<span
						className={cn(
							"flex-1 text-sm tracking-wide transition-colors",
							active
								? "text-serene-blue-900 font-bold"
								: "text-serene-neutral-600 font-medium group-hover:text-serene-blue-800"
						)}
					>
						{item.label}
					</span>
				)}
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
					"hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:overflow-y-auto flex-col h-screen transition-all duration-500 ease-spring",
					"bg-white/90 backdrop-blur-2xl border-r border-serene-neutral-200/40 shadow-[1px_0_20px_rgba(0,0,0,0.02)]", // Softer border, glass effect
					isCollapsed ? "w-20 items-center" : "w-72", // Collapsed centers items
					className
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
					{!isCollapsed && (
						<Link href="/dashboard" className="flex items-center gap-3">
							<Image
								src="/small-logo.png"
								alt="Sauti Salama"
								width={32}
								height={32}
								className="rounded-lg"
							/>
							<div>
								<h2 className="text-lg font-bold text-sauti-blue">Sauti Salama</h2>
								<p className="text-xs text-neutral-500">Safe Voice Platform</p>
							</div>
						</Link>
					)}

					{isCollapsed && (
						<Link href="/dashboard" className="flex justify-center w-full">
							<Image
								src="/logo.webp"
								alt="Sauti Salama"
								width={32}
								height={32}
								className="rounded-lg"
							/>
						</Link>
					)}

					{!isCollapsed && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsCollapsed(true)}
							className="h-8 w-8 text-neutral-500 hover:text-sauti-orange"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Collapsed expand button */}
				{isCollapsed && (
					<div className="px-2 py-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsCollapsed(false)}
							className="w-full h-10 text-neutral-500 hover:text-sauti-teal hover:bg-neutral-50"
						>
							<ChevronRight className="h-5 w-5" />
						</Button>
					</div>
				)}

				{/* User Info - Wrapped with Dropdown */}
				<div className="border-b border-neutral-200 dark:border-neutral-800">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<div
								className={cn(
									"flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors",
									isCollapsed && "justify-center px-0"
								)}
							>
								<Avatar className="h-10 w-10 border border-neutral-200 dark:border-neutral-700">
									<AvatarImage
										src={
											typeof window !== "undefined" &&
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

								{!isCollapsed && (
									<div className="flex-1 min-w-0 text-left">
										<p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
											{dash?.data?.profile?.first_name || user?.email || "User"}
										</p>
										{role !== "survivor" && (
											<p className="text-xs text-neutral-500 truncate capitalize">
												{role || "Member"}
											</p>
										)}
									</div>
								)}

								{!isCollapsed && (
									<div className="text-neutral-400">
										<ChevronRight className="h-4 w-4 rotate-90" />
									</div>
								)}
							</div>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align={isCollapsed ? "center" : "end"}
							side={isCollapsed ? "right" : "bottom"}
							className="w-56 bg-white border-neutral-200"
							sideOffset={isCollapsed ? 10 : 8}
						>
							<DropdownMenuLabel>My Account</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/dashboard/profile" className="cursor-pointer">
									<User className="mr-2 h-4 w-4" />
									<span>Profile</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link
									href="/dashboard/profile?tab=settings"
									className="cursor-pointer"
								>
									<Settings className="mr-2 h-4 w-4" />
									<span>Settings</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-error-600 focus:text-error-600 focus:bg-error-50 cursor-pointer"
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
				{!isCollapsed && (
					<div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
						<RoleSwitcher />
					</div>
				)}

				{/* Navigation */}
				<div className="flex-1 flex flex-col justify-between px-2 py-4">
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

					{/* Footer Navigation */}
					<div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-1">
						{footerItems.map((item) => (
							<SidebarItemComponent key={item.id} item={item} />
						))}

						{/* Sign Out - Moved to Dropdown, kept generically here if needed or removed to avoid duplicate */}
						{/* Keeping it here too for visibility if Sidebar is open? 
                            User didn't explicitly say remove it from footer, but it IS in the dropdown now.
                            Let's keep it here for now as a quick exit. */}
						<form action={signOut}>
							<Button
								variant="ghost"
								className={cn(
									"w-full justify-start text-neutral-600 hover:text-error-600 hover:bg-error-50",
									isCollapsed && "justify-center"
								)}
							>
								<LogOut className="h-4 w-4" />
								{!isCollapsed && <span className="ml-3">Sign Out</span>}
							</Button>
						</form>
					</div>
				</div>
			</div>

			{/* Report Dialog */}
			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent className="sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>Report Incident</DialogTitle>
						<DialogDescription>
							Your safety and privacy are our priority. All information will be kept
							confidential.
						</DialogDescription>
					</DialogHeader>
					<ReportAbuseForm onClose={() => setReportDialogOpen(false)} />
				</DialogContent>
			</Dialog>
		</>
	);
}
