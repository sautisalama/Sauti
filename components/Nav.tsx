"use client";
import Link from "next/link";
import { Menu, Package2, Megaphone, Home, Cloud, LayoutDashboard, LogIn } from "lucide-react";
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
	const url = process.env.NEXT_PUBLIC_APP_URL!;

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
								Dashboard
							</Button>
						</Link>
					) : (
						<Link href={`${url}/signin`}>
							<Button variant="default">
								Sign In
							</Button>
						</Link>
					)}
				</div>
			</nav>
			<Sheet>
				{/* Mobile top bar */}
				<div className="md:hidden sticky top-0 left-0 right-0 bg-background/95 backdrop-blur z-40 border-b">
					<div className="flex items-center justify-between px-3 py-2">
						<Link href="/" className="flex items-center gap-2">
							<Image src="/logo.webp" alt="logo" width={72} height={72} className="h-9 w-9" />
							<span className="sr-only">Sauti Salama</span>
						</Link>
						<div className="flex items-center gap-2">
							<Button
								variant="default"
								size="sm"
								className="h-9 gap-1"
								onClick={() => setDialogOpen(true)}
							>
								<Megaphone className="h-4 w-4" />
								<span>Report</span>
							</Button>
							<SheetTrigger asChild>
								<Button variant="outline" size="icon" className="h-9 w-9">
									<Menu className="h-5 w-5" />
									<span className="sr-only">Open menu</span>
								</Button>
							</SheetTrigger>
						</div>
				</div>
				</div>

				<SheetContent side="right" className="p-0">
					<div className="p-4 space-y-6">
						{/* Header with logo */}
						<div className="flex items-center gap-3">
							<Image src="/logo.webp" alt="logo" width={64} height={64} className="h-10 w-10" />
							<div>
								<p className="text-sm text-muted-foreground">Welcome{isAuthenticated ? "," : " to"}</p>
								<p className="text-base font-medium">Sauti Salama</p>
							</div>
						</div>

						{/* Quick nav */}
						<nav className="grid gap-2 text-sm">
							<Link href="/" className={`flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted ${isActive("/") ? "bg-muted" : ""}`}>
								<Home className="h-5 w-5" />
								<span>Home</span>
							</Link>
							<Link href="/weather" className={`flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted ${isActive("/weather") ? "bg-muted" : ""}`}>
								<Cloud className="h-5 w-5" />
								<span>Weather Safety Alerts</span>
							</Link>
							{isAuthenticated ? (
								<Link href="/dashboard" className={`flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted ${isActive("/dashboard") ? "bg-muted" : ""}`}>
									<LayoutDashboard className="h-5 w-5" />
									<span>Dashboard</span>
								</Link>
							) : (
								<Link href={`${url}/signin`} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted">
									<LogIn className="h-5 w-5" />
									<span>Sign In</span>
								</Link>
							)}
						</nav>

						{/* CTA */}
						<div className="pt-2">
							<Button className="w-full h-10 gap-2" onClick={() => setDialogOpen(true)}>
								<Megaphone className="h-4 w-4" /> Report Abuse
							</Button>
						</div>

						{/* Install button */}
						{pwaHandlers?.showInstallPrompt && (
							<Button variant="outline" onClick={pwaHandlers.handleInstallClick} className="w-full h-10 gap-2">
								<Package2 className="h-4 w-4" /> Install App
							</Button>
						)}
					</div>
				</SheetContent>
			</Sheet>

			<PWAInstallPrompt onHandlersReady={setPwaHandlers} />
		</header>
	);
}
