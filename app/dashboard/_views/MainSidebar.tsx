"use client";

import {
	Calendar,
	FileText,
	HelpCircle,
	LogOut,
	MessageCircle,
	Settings,
	LayoutDashboard,
	Info,
	AlertTriangle,
	HeartHandshake,
	User,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/actions/auth";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
	{
		name: "Dashboard",
		icon: "/icons/dashboard.svg",
		href: "/",
		current: true,
	},
	{
		name: "Incidences",
		icon: "/icons/incidences.svg",
		href: "/incidences",
	},
	{
		name: "Sessions",
		icon: "/icons/sessions.svg",
		href: "/sessions",
	},
	{
		name: "Resources",
		icon: "/icons/resources.svg",
		href: "/resources",
	},
	{
		name: "Messages",
		icon: "/icons/messages.svg",
		href: "/messages",
	},
];

export function MainSidebar() {
	const pathname = usePathname();
	const [isVisible, setIsVisible] = useState(true);
	const [lastScrollY, setLastScrollY] = useState(0);

	useEffect(() => {
		const controlNavbar = () => {
			if (typeof window !== undefined) {
				// Show navbar at the top of the page
				if (window.scrollY === 0) {
					setIsVisible(true);
					return;
				}

				// Hide/show based on scroll direction
				if (window.scrollY > lastScrollY) {
					// scrolling down
					setIsVisible(false);
				} else {
					// scrolling up
					setIsVisible(true);
				}

				setLastScrollY(window.scrollY);
			}
		};

		window.addEventListener("scroll", controlNavbar);

		return () => {
			window.removeEventListener("scroll", controlNavbar);
		};
	}, [lastScrollY]);

	return (
		<>
			{/* Desktop Sidebar */}
			<div className="hidden md:flex h-screen w-[72px] flex-col items-center justify-between bg-[#1A3434] py-8">
				<div className="flex flex-col items-center gap-8">
					<Image
						src="/small-logo.png"
						alt="Logo"
						width={30}
						height={30}
						className="w-7 h-10 mx-6"
					/>

					<nav className="flex flex-col items-center gap-6">
						<Link
							href="/dashboard"
							className={`flex flex-col items-center gap-1 transition-colors hover:text-[#f8941c] mx-8 ${
								pathname === "/dashboard" ? "text-[#f8941c]" : "text-white"
							}`}
						>
							<LayoutDashboard className="h-6 w-6" />
							<span className="text-xs">Dashboard</span>
						</Link>
						{/* <Link
							href="/incidents"
							className={`flex flex-col items-center gap-1 transition-colors hover:text-[#f8941c] mx-8 ${
								pathname === "/incidents" ? "text-[#f8941c]" : "text-white"
							}`}
						>
							<AlertTriangle className="h-6 w-6" />
							<span className="text-xs">Incidences</span>
						</Link> */}
						{/* <Link
							href="/dashboard/sessions"
							className={`flex flex-col items-center gap-1 transition-colors hover:text-[#f8941c] mx-8 ${
								pathname.includes("/sessions") ? "text-[#f8941c]" : "text-white"
							}`}
						>
							<Calendar className="h-6 w-6" />
							<span className="text-xs">Sessions</span>
						</Link> */}
						<Link
							href="/dashboard/resources"
							className={`flex flex-col items-center gap-1 transition-colors hover:text-[#f8941c] mx-8 ${
								pathname.includes("/resources") ? "text-[#f8941c]" : "text-white"
							}`}
						>
							<FileText className="h-6 w-6" />
							<span className="text-xs">Resources</span>
						</Link>
						<Link
							href="/dashboard/chat"
							className={`flex flex-col items-center gap-1 transition-colors hover:text-[#f8941c] mx-8 ${
								pathname.includes("/chat") ? "text-[#f8941c]" : "text-white"
							}`}
						>
							<MessageCircle className="h-6 w-6" />
							<span className="text-xs">Messages</span>
						</Link>
					</nav>
				</div>

				<div className="flex flex-col items-center gap-4">
					<Avatar className="h-8 w-8 mx-6">
						<AvatarImage src="https://github.com/shadcn.png" alt="User" />
						<AvatarFallback>
							<User className="h-4 w-4" />
						</AvatarFallback>
					</Avatar>
					{/* <Button
						variant="ghost"
						size="icon"
						className="text-white hover:text-[#f8941c] transition-colors mx-6"
					>
						<Settings className="h-5 w-5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="text-white hover:text-[#f8941c] transition-colors mx-6"
					>
						<Info className="h-5 w-5" />
					</Button> */}
					<form action={signOut}>
						<Button
							variant="ghost"
							size="icon"
							className="text-white hover:text-[#f8941c] transition-colors mx-6"
						>
							<LogOut className="h-5 w-5" />
						</Button>
					</form>
				</div>
			</div>

			{/* Mobile Top Bar */}
			<div
				className={`md:hidden fixed top-0 left-0 right-0 bg-[#1A3434] z-50 transition-transform duration-300 ${
					isVisible ? "transform translate-y-0" : "transform -translate-y-full"
				}`}
			>
				<div className="flex items-center justify-between px-4 py-3">
					<Image
						src="/small-logo.png"
						alt="Logo"
						width={24}
						height={24}
						className="w-6 h-8"
					/>
					<div className="flex items-center gap-3">
						<Avatar className="h-8 w-8">
							<AvatarImage src="https://github.com/shadcn.png" alt="User" />
							<AvatarFallback>
								<User className="h-4 w-4" />
							</AvatarFallback>
						</Avatar>
						<form action={signOut}>
							<Button
								variant="ghost"
								size="icon"
								className="text-white hover:text-[#f8941c]"
							>
								<LogOut className="h-5 w-5" />
							</Button>
						</form>
					</div>
				</div>
			</div>

			{/* Mobile Bottom Navigation - Always visible */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1A3434] border-t border-[#2A4444] z-50">
				<nav className="flex items-center justify-around px-4 py-2">
					<Link
						href="/dashboard"
						className={`flex flex-col items-center gap-1 py-2 ${
							pathname === "/dashboard" ? "text-[#f8941c]" : "text-white"
						}`}
					>
						<LayoutDashboard className="h-5 w-5" />
						<span className="text-xs">Dashboard</span>
					</Link>
					<Link
						href="/dashboard/resources"
						className={`flex flex-col items-center gap-1 py-2 ${
							pathname.includes("/resources") ? "text-[#f8941c]" : "text-white"
						}`}
					>
						<FileText className="h-5 w-5" />
						<span className="text-xs">Resources</span>
					</Link>
					<Link
						href="/dashboard/chat"
						className={`flex flex-col items-center gap-1 py-2 ${
							pathname.includes("/chat") ? "text-[#f8941c]" : "text-white"
						}`}
					>
						<MessageCircle className="h-5 w-5" />
						<span className="text-xs">Messages</span>
					</Link>
				</nav>
			</div>
		</>
	);
}
