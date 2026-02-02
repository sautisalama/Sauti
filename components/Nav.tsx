"use client";
import Link from "next/link";
import {
	Menu,
	Package2,
	Megaphone,
	Home,
	Cloud,
	LayoutDashboard,
	LogIn,
	UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import ReportAbuseForm from "./ReportAbuseForm";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PWAInstallPrompt, type PWAInstallHandlers } from "./PWAInstallPrompt";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Nav() {
	const pathname = usePathname();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const supabase = createClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pwaHandlers, setPwaHandlers] = useState<PWAInstallHandlers | null>(
		null
	);
	const url = process.env.NEXT_PUBLIC_APP_URL!;

	// Mobile sub-menu states
	const [showPrograms, setShowPrograms] = useState(false);
	const [showLearn, setShowLearn] = useState(false);
	const [showInvolved, setShowInvolved] = useState(false);

	useEffect(() => {
		const checkAuth = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setIsAuthenticated(!!session);
		};

		checkAuth();

		// Set up auth state change listener
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setIsAuthenticated(!!session);
		});

		return () => subscription.unsubscribe();
	}, [supabase]);

	// Helper function to determine if link is active
	const isActive = (path: string) => pathname === path;

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-20 md:h-24 flex items-center">
			<div className="container w-full max-w-[100vw] flex items-center justify-between px-6 md:px-12 relative">
				{/* Extreme Left: Logo */}
				<Link href="/" className="flex items-center gap-2 shrink-0">
					<Image src="/logo.webp" alt="logo" width={200} height={60} className="w-auto h-12 md:h-16" />
					<span className="sr-only">Sauti Salama</span>
				</Link>

				{/* Center: Menu Items */}
				<nav className="hidden lg:flex items-center gap-6 text-sm font-bold absolute left-1/2 -translate-x-1/2">
					<Link
						href="/"
						className={`px-3 py-1.5 rounded-full transition-colors ${
							isActive("/") 
								? "bg-sauti-teal text-white" 
								: "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Home
					</Link>
					<Link
						href="/about"
						className={`px-3 py-1.5 rounded-full transition-colors ${
							isActive("/about") 
								? "bg-sauti-teal text-white" 
								: "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Our Story
					</Link>
					
					<div className="group relative">
						<Link 
							href="/programs"
							className={`px-3 py-1.5 rounded-full transition-colors outline-none ${
								pathname === "/programs" 
									? "bg-sauti-teal text-white" 
									: "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
							}`}
						>
							Programs
						</Link>
						<div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
							<div className="rounded-2xl p-2 min-w-[220px] bg-white border-2 border-gray-100 shadow-2xl">
								<Link href="/programs/access-to-care" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Access to Care</Link>
								<Link href="/programs/prevention" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Prevention</Link>
								<Link href="/programs/legal-access" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Legal Access</Link>
								<Link href="/programs/feminist-tech" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Feminist Tech</Link>
								<Link href="/learn" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Capacity Building</Link>
							</div>
						</div>
					</div>

					<Link
						href="/impact"
						className={`px-3 py-1.5 rounded-full transition-colors ${
							pathname.startsWith("/impact") 
								? "bg-sauti-teal text-white" 
								: "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Our Impact
					</Link>
					
					<div className="group relative">
						<Link 
                            href="/learn"
                            className={`px-3 py-1.5 rounded-full transition-colors outline-none cursor-pointer ${
                                pathname.startsWith("/learn") 
                                    ? "bg-sauti-teal text-white" 
                                    : "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
                            }`}
                        >
							Learn
						</Link>
						<div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
							<div className="rounded-2xl p-2 min-w-[200px] bg-white border-2 border-gray-100 shadow-2xl">
								<Link href="/learn?type=courses" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Courses</Link>
								<Link href="/learn?type=resources" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Resources</Link>
							</div>
						</div>
					</div>

					<div className="group relative">
						<Link 
							href="/volunteer"
							className={`px-3 py-1.5 rounded-full transition-colors outline-none cursor-pointer ${
								pathname === "/volunteer" 
									? "bg-sauti-teal text-white" 
									: "text-muted-foreground hover:text-sauti-teal underline-offset-4 hover:underline"
							}`}
						>
							Get Involved
						</Link>
						<div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
							<div className="rounded-2xl p-2 min-w-[220px] bg-white border-2 border-gray-100 shadow-2xl">
								<Link href="/volunteer#professionals" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">For Professionals</Link>
								<Link href="/volunteer#mapping" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Resource Mapping</Link>
								<Link href="/volunteer#community" className="block rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue">Community Action</Link>
							</div>
						</div>
					</div>
				</nav>

				{/* Extreme Right: Buttons (Desktop) & Hamburger (Mobile) */}
				<div className="flex items-center gap-4 shrink-0">
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger asChild>
							<Button 
								className="hidden lg:flex rounded-full bg-sauti-yellow text-sauti-dark hover:bg-sauti-yellow/90 items-center gap-2 font-bold px-8 h-12"
							>
								<Megaphone className="h-5 w-5" /> Report Abuse
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px]">
							<ReportAbuseForm />
						</DialogContent>
					</Dialog>

					{isAuthenticated ? (
						<Link href="/dashboard" className="hidden lg:block">
							<Button variant="outline" className="rounded-full border-2 border-sauti-blue text-sauti-blue font-black px-8 h-12 shadow-sm hover:bg-sauti-blue hover:text-white transition-all">Dashboard</Button>
						</Link>
					) : (
						<Link href={`${url}/signin`} className="hidden lg:block">
							<Button className="rounded-full bg-sauti-teal text-white font-black px-8 h-12 shadow-sm hover:shadow-lg hover:bg-sauti-teal/90 transition-all">Log In</Button>
						</Link>
					)}

					{/* Hamburger Menu for Mobile */}
					<Sheet>
						<SheetTrigger asChild>
							<Button variant="outline" size="icon" className="lg:hidden h-12 w-12 rounded-full border-2 border-sauti-blue text-sauti-blue hover:bg-sauti-blue hover:text-white transition-all">
								<Menu className="h-6 w-6" />
								<span className="sr-only">Open menu</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-full sm:w-full h-full p-0 border-none">
							<div className="flex flex-col h-full bg-white overflow-y-auto">
								<div className="p-8 space-y-10">
									{/* Mobile Header */}
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4">
											<Image src="/logo.webp" alt="logo" width={60} height={60} className="h-12 w-auto" />
											<div>
												<p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Navigation</p>
												<p className="text-xl font-black text-sauti-blue">Sauti Salama</p>
											</div>
										</div>
									</div>

									{/* Mobile Nav Links */}
									<nav className="grid gap-4">
										<Link
											href="/"
											className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-lg font-black transition-all ${
												isActive("/") ? "bg-sauti-blue text-white shadow-lg shadow-sauti-blue/20" : "hover:bg-gray-50 text-gray-700"
											}`}
										>
											<Home className="h-6 w-6" />
											<span>Home</span>
										</Link>

										<Link
											href="/about"
											className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-lg font-black transition-all ${
												isActive("/about") ? "bg-sauti-blue text-white shadow-lg shadow-sauti-blue/20" : "hover:bg-gray-50 text-gray-700"
											}`}
										>
											<UsersRound className="h-6 w-6" />
											<span>Our Story</span>
										</Link>

										{/* Programs */}
										<div className="space-y-2">
											<button
												onClick={() => setShowPrograms(!showPrograms)}
												className={`flex w-full items-center justify-between rounded-2xl px-5 py-4 text-lg font-black transition-all ${
													pathname.startsWith("/programs") ? "bg-gray-100 text-sauti-blue" : "hover:bg-gray-50 text-gray-700"
												}`}
											>
												<div className="flex items-center gap-4">
													<Package2 className="h-6 w-6" />
													<span>Programs</span>
												</div>
												{showPrograms ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
											</button>
											{showPrograms && (
												<div className="ml-8 grid gap-2 border-l-4 border-sauti-yellow/30 pl-4 py-2">
													<Link href="/programs" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">All Programs</Link>
													<Link href="/programs/access-to-care" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Access to Care</Link>
													<Link href="/programs/prevention" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Prevention</Link>
													<Link href="/programs/legal-access" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Legal Access</Link>
													<Link href="/programs/feminist-tech" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Feminist Tech</Link>
												</div>
											)}
										</div>

										<Link
											href="/impact"
											className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-lg font-black transition-all ${
												pathname.startsWith("/impact") ? "bg-sauti-blue text-white shadow-lg shadow-sauti-blue/20" : "hover:bg-gray-50 text-gray-700"
											}`}
										>
											<LayoutDashboard className="h-6 w-6" />
											<span>Our Impact</span>
										</Link>

										{/* Learn */}
										<div className="space-y-2">
											<button
												onClick={() => setShowLearn(!showLearn)}
												className={`flex w-full items-center justify-between rounded-2xl px-5 py-4 text-lg font-black transition-all ${
													pathname.startsWith("/learn") ? "bg-gray-100 text-sauti-blue" : "hover:bg-gray-50 text-gray-700"
												}`}
											>
												<div className="flex items-center gap-4">
													<Megaphone className="h-6 w-6" />
													<span>Learn</span>
												</div>
												{showLearn ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
											</button>
											{showLearn && (
												<div className="ml-8 grid gap-2 border-l-4 border-sauti-yellow/30 pl-4 py-2">
													<Link href="/learn" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Learning Hub</Link>
													<Link href="/learn?type=courses" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Courses</Link>
													<Link href="/learn?type=resources" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Resources</Link>
												</div>
											)}
										</div>

										{/* Involvement */}
										<div className="space-y-2">
											<button
												onClick={() => setShowInvolved(!showInvolved)}
												className={`flex w-full items-center justify-between rounded-2xl px-5 py-4 text-lg font-black transition-all ${
													pathname.startsWith("/volunteer") ? "bg-gray-100 text-sauti-blue" : "hover:bg-gray-50 text-gray-700"
												}`}
											>
												<div className="flex items-center gap-4">
													<Cloud className="h-6 w-6" />
													<span>Get Involved</span>
												</div>
												{showInvolved ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
											</button>
											{showInvolved && (
												<div className="ml-8 grid gap-2 border-l-4 border-sauti-yellow/30 pl-4 py-2">
													<Link href="/volunteer" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Overview</Link>
													<Link href="/volunteer#professionals" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">For Professionals</Link>
													<Link href="/volunteer#mapping" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Resource Mapping</Link>
													<Link href="/volunteer#community" className="text-gray-600 py-2 font-bold hover:text-sauti-blue">Community Action</Link>
												</div>
											)}
										</div>
									</nav>

									{/* Mobile CTAs */}
									<div className="pt-8 border-t border-gray-100 flex flex-col gap-4">
										<Button
											className="w-full h-16 rounded-2xl text-xl font-black bg-sauti-yellow text-sauti-dark shadow-xl hover:bg-sauti-yellow/90 flex items-center justify-center gap-3 transition-all active:scale-95"
											onClick={() => {
												setDialogOpen(true);
											}}
										>
											<Megaphone className="h-6 w-6" /> Report Abuse
										</Button>

										{isAuthenticated ? (
											<Link href="/dashboard" className="w-full">
												<Button variant="outline" className="w-full h-16 rounded-2xl text-xl font-black border-2 border-sauti-blue text-sauti-blue active:scale-95 transition-all">
													Dashboard
												</Button>
											</Link>
										) : (
											<Link href={`${url}/signin`} className="w-full">
												<Button className="w-full h-16 rounded-2xl text-xl font-black bg-sauti-blue text-white active:scale-95 transition-all">
													Log In
												</Button>
											</Link>
										)}

										{pwaHandlers?.showInstallPrompt && (
											<Button
												variant="ghost"
												onClick={pwaHandlers.handleInstallClick}
												className="w-full h-14 rounded-2xl text-base font-bold text-gray-500 border-2 border-dashed border-gray-200"
											>
												<Package2 className="h-5 w-5 mr-2" /> Install Sauti App
											</Button>
										)}
									</div>
								</div>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
			<PWAInstallPrompt onHandlersReady={setPwaHandlers} />
		</header>
	);
}
