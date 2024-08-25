import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function signup() {
	return (
		<div className="flex flex-col min-h-screen items-center justify-between pt-10">
			<div className="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
				<div className="hidden bg-muted lg:block">
					<Image
						src="/couple-salama.jpg"
						alt="Image"
						width="1920"
						height="1080"
						className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
					/>
				</div>
				<div className="flex items-center justify-center py-12">
					<div className="mx-auto grid w-[350px] gap-6">
						<div className="grid gap-2 text-center">
							<h1 className="text-3xl font-bold">Sign Up</h1>
							<p className="text-balance text-muted-foreground">
								Enter your etails to create your account
							</p>
						</div>
						<div className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" type="email" placeholder="m@example.com" required />
							</div>
							<div className="grid gap-2">
								<div className="flex items-center">
									<Label htmlFor="password">Password</Label>
									{/* <Link
										href="/forgot-password"
										className="ml-auto inline-block text-sm underline"
									>
										Forgot your password?
									</Link> */}
								</div>
								<Input id="password" type="password" required />
							</div>
							<Button type="submit" className="w-full">
								<Link href="/login" className="underline">
									Sign Up
								</Link>
							</Button>
							<Button variant="outline" className="w-full">
								Sign Up with Google
							</Button>
						</div>
						<div className="mt-4 text-center text-sm">
							Have an account?
							<Link href="/login" className="underline">
								Log In
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
