"use client";
import Link from "next/link";
import { CircleUser, Menu, MoveUpRight, Package2, Search } from "lucide-react";
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

export function Nav() {
	const pathname = usePathname();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const supabase = createClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [pwaHandlers, setPwaHandlers] = useState<PWAInstallHandlers | null>(
		null
	);

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
		<header className="sticky top-0 flex flex-col md:flex-row h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
			<nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 container">
				<Link
					href="/"
					className="flex items-center gap-2 text-lg font-semibold md:text-base"
				>
					<Image src="/logo.webp" alt="logo" width={80} height={80} />
					<span className="sr-only">Sauti Salama</span>
				</Link>
				<div className="flex items-center gap-4 max-w-[80%] ml-auto">
					<Link
						href="/"
						className={`transition-colors hover:text-foreground ${
							isActive("/") ? "text-foreground font-semibold" : "text-muted-foreground"
						}`}
					>
						Home
					</Link>
					<Link
						href="/weather"
						className={`transition-colors hover:text-foreground ${
							isActive("/weather")
								? "text-foreground font-semibold"
								: "text-muted-foreground"
						}`}
					>
						Weather Safety Alerts
					</Link>
					{/* <Link href="https://sauti-salama.vercel.app/Report">
						<Button variant="default"> Report Abuse </Button>
					</Link> */}
					{/* Replace the existing Report Abuse button with this: */}
					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger asChild>
							<Button variant="default">Report Abuse</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-4xl">
							<DialogHeader>
								<DialogTitle>Report Abuse</DialogTitle>
								<DialogDescription>
									Please fill out this form to report an incident. All information will
									be kept confidential.
								</DialogDescription>
							</DialogHeader>
							<ReportAbuseForm onClose={() => setDialogOpen(false)} />
						</DialogContent>
					</Dialog>
					{isAuthenticated ? (
						<Link href="/dashboard">
							<Button variant="outline">
								<div className="flex items-center justify-between gap-2">
									Dashboard <MoveUpRight className="h-4 w-4" />
								</div>
							</Button>
						</Link>
					) : (
						<Link href="https://app.sautisalama.org/signin">
							<Button variant="default">
								<div className="flex items-center justify-between gap-2">
									Sign In <MoveUpRight className="h-4 w-4" />
								</div>
							</Button>
						</Link>
					)}
				</div>
			</nav>
			<Sheet>
				<SheetTrigger asChild>
					<div className="md:hidden flex justify-between items-center w-full">
						<Image src="/logo.webp" alt="logo" width={80} height={80} />
						<Button variant="outline" size="icon" className="shrink-0 md:hidden ">
							<Menu className="h-5 w-5" />
							<span className="sr-only">Toggle navigation menu</span>
						</Button>
					</div>
				</SheetTrigger>
				<SheetContent side="right">
					<nav className="grid gap-6 text-lg font-medium">
						<Link href="/" className="flex items-center gap-2 text-lg font-semibold">
							<Image src="/logo.webp" alt="logo" width={80} height={80} />
							<span className="sr-only">Sauti Salama</span>
						</Link>
						<Link
							href="/"
							className={`transition-colors hover:text-foreground ${
								isActive("/")
									? "text-foreground font-semibold"
									: "text-muted-foreground"
							}`}
						>
							Home
						</Link>
						<Link
							href="/weather"
							className={`transition-colors hover:text-foreground ${
								isActive("/weather")
									? "text-foreground font-semibold"
									: "text-muted-foreground"
							}`}
						>
							Weather Safety Alerts
						</Link>
						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="default">Report Abuse</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-4xl">
								<DialogHeader>
									<DialogTitle>Report Abuse</DialogTitle>
									<DialogDescription>
										Please fill out this form to report an incident. All information will
										be kept confidential.
									</DialogDescription>
								</DialogHeader>
								<ReportAbuseForm onClose={() => setDialogOpen(false)} />
							</DialogContent>
						</Dialog>

						{isAuthenticated ? (
							<Link href="/dashboard">
								<Button variant="default">
									<div className="flex items-center justify-between gap-2">
										Dashboard <MoveUpRight className="h-4 w-4" />
									</div>
								</Button>
							</Link>
						) : (
							<Link href="https://app.sautisalama.org/signin">
								<Button variant="default">
									<div className="flex items-center justify-between gap-2">
										Sign In <MoveUpRight className="h-4 w-4" />
									</div>
								</Button>
							</Link>
						)}

						{pwaHandlers?.showInstallPrompt && (
							<Button
								variant="default"
								onClick={pwaHandlers.handleInstallClick}
								className="mt-auto"
							>
								<div className="flex items-center justify-between gap-2">
									Install App <Package2 className="h-4 w-4" />
								</div>
							</Button>
						)}
					</nav>
				</SheetContent>
			</Sheet>

			<PWAInstallPrompt onHandlersReady={setPwaHandlers} />

			{/* <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
				<form className="ml-auto flex-1 sm:flex-initial">
					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search products..."
							className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
						/>
					</div>
				</form>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary" size="icon" className="rounded-full">
							<CircleUser className="h-5 w-5" />
							<span className="sr-only">Toggle user menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>My Account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem>Settings</DropdownMenuItem>
						<DropdownMenuItem>Support</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem>Logout</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div> */}
		</header>
	);
}
