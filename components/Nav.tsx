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
	Heart,
	Shield,
	Scale,
	Cpu,
	GraduationCap,
	BookOpen,
	Users,
	Map,
	Handshake,
	Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
		<header className="sticky top-0 z-50 w-full border-b-2 border-gray-100 bg-white/98 backdrop-blur h-20 md:h-24 flex items-center shadow-sm">
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
								: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Home
					</Link>
					<Link
						href="/about"
						className={`px-3 py-1.5 rounded-full transition-colors ${
							isActive("/about") 
								? "bg-sauti-teal text-white" 
								: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Our Story
					</Link>
					
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button 
								className={`px-3 py-1.5 rounded-full transition-colors outline-none flex items-center gap-1 ${
									pathname.startsWith("/programs") 
										? "bg-sauti-teal text-white" 
										: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
								}`}
							>
								Programs <ChevronDown className="h-3 w-3" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="rounded-2xl p-2 min-w-[260px] bg-white border-2 border-gray-100 shadow-2xl z-50">
							<DropdownMenuItem asChild>
								<Link href="/programs" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Package2 className="h-5 w-5 text-sauti-teal" />
									<span>All Programs</span>
								</Link>
							</DropdownMenuItem>
							<div className="h-px bg-gray-100 my-1 mx-2" />
							<DropdownMenuItem asChild>
								<Link href="/programs/access-to-care" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Heart className="h-5 w-5 text-pink-500" />
									<span>Access to Care</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/programs/prevention" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Shield className="h-5 w-5 text-sauti-teal" />
									<span>Prevention</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/programs/legal-access" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Scale className="h-5 w-5 text-amber-600" />
									<span>Legal Access</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/programs/feminist-tech" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Cpu className="h-5 w-5 text-indigo-500" />
									<span>Feminist Tech</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/learn" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<GraduationCap className="h-5 w-5 text-sauti-blue" />
									<span>Capacity Building</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Link
						href="/impact"
						className={`px-3 py-1.5 rounded-full transition-colors ${
							pathname.startsWith("/impact") 
								? "bg-sauti-teal text-white" 
								: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
						}`}
					>
						Our Impact
					</Link>
					
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button 
								className={`px-3 py-1.5 rounded-full transition-colors outline-none flex items-center gap-1 ${
									pathname.startsWith("/learn") 
										? "bg-sauti-teal text-white" 
										: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
								}`}
							>
								Learn <ChevronDown className="h-3 w-3" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="rounded-2xl p-2 min-w-[200px] bg-white border-2 border-gray-100 shadow-2xl z-50">
							<DropdownMenuItem asChild>
								<Link href="/learn" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Info className="h-5 w-5 text-sauti-teal" />
									<span>Learning Hub</span>
								</Link>
							</DropdownMenuItem>
							<div className="h-px bg-gray-100 my-1 mx-2" />
							<DropdownMenuItem asChild>
								<Link href="/learn?type=courses" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<GraduationCap className="h-5 w-5 text-amber-600" />
									<span>Courses</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/learn?type=resources" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<BookOpen className="h-5 w-5 text-indigo-500" />
									<span>Resources</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button 
								className={`px-3 py-1.5 rounded-full transition-colors outline-none flex items-center gap-1 ${
									pathname.startsWith("/volunteer") 
										? "bg-sauti-teal text-white" 
										: "text-gray-900 hover:text-sauti-teal underline-offset-4 hover:underline"
								}`}
							>
								Get Involved <ChevronDown className="h-3 w-3" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="rounded-2xl p-2 min-w-[240px] bg-white border-2 border-gray-100 shadow-2xl z-50">
							<DropdownMenuItem asChild>
								<Link href="/volunteer" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Cloud className="h-5 w-5 text-sauti-teal" />
									<span>Overview</span>
								</Link>
							</DropdownMenuItem>
							<div className="h-px bg-gray-100 my-1 mx-2" />
							<DropdownMenuItem asChild>
								<Link href="/volunteer#professionals" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Users className="h-5 w-5 text-sauti-teal" />
									<span>For Professionals</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/volunteer#mapping" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Map className="h-5 w-5 text-amber-600" />
									<span>Resource Mapping</span>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/volunteer#community" className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 font-bold text-sauti-blue cursor-pointer outline-none transition-colors group">
									<Handshake className="h-5 w-5 text-indigo-500" />
									<span>Community Action</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
						<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px] h-[90vh] min-h-[600px]">
							<DialogTitle className="sr-only">Report Abuse</DialogTitle>
							<DialogDescription className="sr-only">
								Submit a report about an incident. Your information is secure and encrypted.
							</DialogDescription>
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
							<SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
							<SheetDescription className="sr-only">Navigation links and actions</SheetDescription>
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
												<div className="ml-6 grid gap-1 border-l-2 border-sauti-yellow/20 pl-2 mt-2">
													<Link 
														href="/programs" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/programs") ? "bg-sauti-teal/10 text-sauti-teal" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Package2 className="h-4 w-4" />
														<span>All Programs</span>
													</Link>
													<Link 
														href="/programs/access-to-care" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/programs/access-to-care") ? "bg-pink-50 text-pink-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Heart className="h-4 w-4 text-pink-500" />
														<span>Access to Care</span>
													</Link>
													<Link 
														href="/programs/prevention" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/programs/prevention") ? "bg-sauti-teal/5 text-sauti-teal" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Shield className="h-4 w-4 text-sauti-teal" />
														<span>Prevention</span>
													</Link>
													<Link 
														href="/programs/legal-access" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/programs/legal-access") ? "bg-amber-50 text-amber-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Scale className="h-4 w-4 text-amber-600" />
														<span>Legal Access</span>
													</Link>
													<Link 
														href="/programs/feminist-tech" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/programs/feminist-tech") ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Cpu className="h-4 w-4 text-indigo-500" />
														<span>Feminist Tech</span>
													</Link>
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
												<div className="ml-6 grid gap-1 border-l-2 border-sauti-yellow/20 pl-2 mt-2">
													<Link 
														href="/learn" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/learn") ? "bg-sauti-teal/10 text-sauti-teal" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Info className="h-4 w-4 text-sauti-teal" />
														<span>Learning Hub</span>
													</Link>
													<Link 
														href="/learn?type=courses" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															pathname === "/learn" && pathname.includes("type=courses") ? "bg-amber-50 text-amber-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<GraduationCap className="h-4 w-4 text-amber-600" />
														<span>Courses</span>
													</Link>
													<Link 
														href="/learn?type=resources" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															pathname === "/learn" && pathname.includes("type=resources") ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<BookOpen className="h-4 w-4 text-indigo-500" />
														<span>Resources</span>
													</Link>
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
												<div className="ml-6 grid gap-1 border-l-2 border-sauti-yellow/20 pl-2 mt-2">
													<Link 
														href="/volunteer" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															isActive("/volunteer") ? "bg-sauti-teal/10 text-sauti-teal" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Cloud className="h-4 w-4 text-sauti-teal" />
														<span>Overview</span>
													</Link>
													<Link 
														href="/volunteer#professionals" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															pathname.includes("#professionals") ? "bg-sauti-teal/5 text-sauti-teal" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Users className="h-4 w-4 text-sauti-teal" />
														<span>For Professionals</span>
													</Link>
													<Link 
														href="/volunteer#mapping" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															pathname.includes("#mapping") ? "bg-amber-50 text-amber-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Map className="h-4 w-4 text-amber-600" />
														<span>Resource Mapping</span>
													</Link>
													<Link 
														href="/volunteer#community" 
														className={`flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
															pathname.includes("#community") ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50 hover:text-sauti-blue"
														}`}
													>
														<Handshake className="h-4 w-4 text-indigo-500" />
														<span>Community Action</span>
													</Link>
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
