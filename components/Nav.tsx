import Link from "next/link";
import { CircleUser, Menu, MoveUpRight, Package2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image"; // Import the Image component from the correct package
import { UserButton } from "@clerk/nextjs";

export function Nav() {
	return (
		<header className="sticky top-0 flex flex-col md:flex-row h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-[900]">
			<nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 container">
				<Link
					href="#"
					className="flex items-center gap-2 text-lg font-semibold md:text-base"
				>
					<Image src="/logo.webp" alt="logo" width={80} height={80} />
					<span className="sr-only">Sauti Salama</span>
				</Link>
				<div className="flex items-center gap-4 max-w-[80%] ml-auto">
					<Link
						href="#"
						className="text-foreground transition-colors hover:text-foreground"
					>
						Home
					</Link>
					<Link
						href="#"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Proffesional Services
					</Link>
					<Link
						href="#"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Information Resources
					</Link>
					<Link
						href="#"
						className="text-muted-foreground transition-colors hover:text-foreground"
					>
						Community
					</Link>

					<Link href="https://sauti-salama.vercel.app/Report">
						<Button variant="default"> Report Abuse </Button>
					</Link>
					{/* <Link href="/login ">
						<Button variant="default">
							<div className="flex items-center justify-between gap-2">
								Sign In <MoveUpRight className="h-4 w-4" />
							</div>
						</Button>
					</Link> */}
					<UserButton />
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
					<nav className="grid gap-6 text-lg font-medium z-[999]">
						<Link href="#" className="flex items-center gap-2 text-lg font-semibold">
							<Image src="/logo.webp" alt="logo" width={80} height={80} />
							<span className="sr-only">Sauti Salama</span>
						</Link>
						<Link href="#" className="hover:text-foreground">
							Home
						</Link>
						<Link href="#" className="text-muted-foreground hover:text-foreground">
							Proffessional Services
						</Link>
						<Link href="#" className="text-muted-foreground hover:text-foreground">
							Information Resources
						</Link>
						<Link href="#" className="text-muted-foreground hover:text-foreground">
							Community
						</Link>
						<Link href="https://sauti-salama.vercel.app/Report">
							<Button variant="default"> Report Abuse </Button>
						</Link>
						<Link href="/login">
							<Button variant="default">
								<div className="flex items-center justify-between gap-2">
									Sign In <MoveUpRight className="h-4 w-4" />
								</div>
							</Button>
						</Link>
					</nav>
				</SheetContent>
			</Sheet>

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
