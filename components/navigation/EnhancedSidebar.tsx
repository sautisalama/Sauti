"use client";

import { useState, useEffect } from "react";
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
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/(auth)/actions/auth";
import ReportAbuseForm from "@/components/ReportAbuseForm";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

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
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [notifications, setNotifications] = useState(0);
	const [casesCount, setCasesCount] = useState<number>(0);
	const supabase = createClient();

	// Auto-collapse on mobile screen sizes
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth < 1024) {
				setIsCollapsed(true);
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

useEffect(() => {
		// Prefer provider data when available to avoid extra fetches
		if (dash?.data && typeof dash.data.casesCount === 'number') {
			setCasesCount(dash.data.casesCount);
			return;
		}
		const loadCases = async () => {
			try {
				if (
					user?.profile?.user_type !== "professional" &&
					user?.profile?.user_type !== "ngo"
				) {
					setCasesCount(0);
					return;
				}
				const uid = user?.id;
				if (!uid) return;
				const { data: services } = await supabase
					.from("support_services")
					.select("id")
					.eq("user_id", uid);
				const ids = (services || []).map((s: any) => s.id);
				if (ids.length === 0) {
					setCasesCount(0);
					return;
				}
				const { count } = await supabase
					.from("matched_services")
					.select("id", { count: "exact", head: true })
					.in("service_id", ids);
				setCasesCount(count || 0);
			} catch {
				// ignore
			}
		};
		loadCases();
	}, [dash?.data, user?.id, user?.profile?.user_type, supabase]);

	const getSidebarItems = (): SidebarItem[] => {
		const isDashboard = pathname?.startsWith("/dashboard");

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
					id: "report",
					label: "Report Incident",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
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

		const baseItems: SidebarItem[] = [
			{
				id: "overview",
				label: "Overview",
				icon: LayoutDashboard,
				href: "/dashboard",
				section: "main",
			},
		];

		if (user?.profile?.user_type === "survivor") {
			const survivorMain: SidebarItem[] = [
				...baseItems,
				{
					id: "chat",
					label: "Messages",
					icon: MessageCircle,
					href: "/dashboard/chat",
					badge: dash?.data?.unreadChatCount || 0,
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
				{
					id: "community",
					label: "Community",
					icon: Users,
					href: "/dashboard/community",
					section: "main",
				},
			];
			return [
				...survivorMain,
				{
					id: "report",
					label: "Report Incident",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
					section: "secondary",
					separator: true,
				},
				{
					id: "profile",
					label: "Profile",
					icon: User,
					href: "/dashboard/profile",
					section: "secondary",
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/settings",
					section: "footer",
				},
			];
			return [
				...baseItems,
				{
					id: "appointments",
					label: "Appointments",
					icon: Calendar,
					href: "/dashboard/appointments",
					section: "main",
				},
				{
					id: "community",
					label: "Community",
					icon: Users,
					href: "/dashboard/community",
					section: "main",
				},
				{
					id: "report",
					label: "Report Incident",
					icon: Megaphone,
					onClick: () => setReportDialogOpen(true),
					section: "secondary",
					separator: true,
				},
				{
					id: "profile",
					label: "Profile",
					icon: User,
					href: "/dashboard/profile",
					section: "secondary",
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/settings",
					section: "footer",
				},
			];
		}

		if (
			user?.profile?.user_type === "professional" ||
			user?.profile?.user_type === "ngo"
		) {
			const proMain: SidebarItem[] = [
				...baseItems,
				{
					id: "cases",
					label: "Case Management",
					icon: ClipboardList,
					href: "/dashboard/cases",
					badge: casesCount || 0,
					section: "main",
				},
				{
					id: "appointments",
					label: "Schedule",
					icon: Calendar,
					href: "/dashboard/appointments",
					section: "main",
				},
				{
					id: "chat",
					label: "Messages",
					icon: MessageCircle,
					href: "/dashboard/chat",
					badge: dash?.data?.unreadChatCount || 0,
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
					id: "profile",
					label: "Professional Profile",
					icon: User,
					href: "/dashboard/profile",
					section: "secondary",
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/settings",
					section: "footer",
				},
			];
			return [
				...baseItems,
				{
					id: "cases",
					label: "Case Management",
					icon: ClipboardList,
					href: "/dashboard/cases",
					badge: 7,
					section: "main",
				},
				{
					id: "appointments",
					label: "Schedule",
					icon: Calendar,
					href: "/dashboard/appointments",
					section: "main",
				},
				{
					id: "services",
					label: "My Services",
					icon: Plus,
					href: "/dashboard/services",
					section: "secondary",
					separator: true,
				},
				{
					id: "profile",
					label: "Professional Profile",
					icon: User,
					href: "/dashboard/profile",
					section: "secondary",
				},
				{
					id: "settings",
					label: "Settings",
					icon: Settings,
					href: "/dashboard/settings",
					section: "footer",
				},
			];
		}

		return [
			...baseItems,
			{
				id: "profile",
				label: "Profile",
				icon: User,
				href: "/dashboard/profile",
				section: "secondary",
				separator: true,
			},
			{
				id: "settings",
				label: "Settings",
				icon: Settings,
				href: "/dashboard/settings",
				section: "footer",
			},
		];
	};

	const sidebarItems = getSidebarItems();

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
					"flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
					"hover:bg-white/10 dark:hover:bg-white/5",
					"group cursor-pointer",
					active &&
						"bg-sauti-orange/10 text-sauti-orange border-r-2 border-sauti-orange"
				)}
			>
				<div className="relative flex items-center justify-center">
					<Icon
						className={cn(
							"h-5 w-5 transition-colors",
							active
								? "text-sauti-orange"
								: "text-neutral-600 dark:text-neutral-400 group-hover:text-sauti-orange"
						)}
					/>
					{item.badge && item.badge > 0 && (
						<Badge
							className={cn(
								"absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[9px]",
								"bg-error-500 text-white border-0 min-w-[16px]"
							)}
						>
							{item.badge > 99 ? "99" : item.badge}
						</Badge>
					)}
				</div>

				{!isCollapsed && (
					<span
						className={cn(
							"flex-1 text-sm font-medium transition-colors",
							active
								? "text-sauti-orange"
								: "text-neutral-700 dark:text-neutral-300 group-hover:text-sauti-orange"
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

	return (
		<>
			<div
				className={cn(
					"hidden lg:flex flex-col h-screen bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300",
					isCollapsed ? "w-20" : "w-72",
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
							className="w-full h-8 text-neutral-500 hover:text-sauti-orange"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				)}

				{/* User Info */}
				<div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
					<div
						className={cn("flex items-center gap-3", isCollapsed && "justify-center")}
					>
						<Avatar className="h-10 w-10">
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

						{!isCollapsed && (
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
									{user?.profile?.first_name || user?.email || "User"}
								</p>
								{user?.profile?.user_type !== "survivor" && (
									<p className="text-xs text-neutral-500 truncate capitalize">
										{user?.profile?.user_type || "Member"}
									</p>
								)}
							</div>
						)}

						{!isCollapsed && notifications > 0 && (
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<div className="relative">
									<Bell className="h-4 w-4" />
									<Badge className="absolute -top-1 -right-1 h-3 w-3 p-0 bg-error-500">
										<span className="sr-only">{notifications} notifications</span>
									</Badge>
								</div>
							</Button>
						)}
					</div>
				</div>

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

						{/* Sign Out */}
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
