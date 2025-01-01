import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { Twitter } from "lucide-react";
import { Linkedin } from "lucide-react";
import Link from "next/link";

export function JoinCommunity() {
	return (
		<Card className="overflow-hidden">
			<CardContent className="p-0">
				<div className="relative p-6 bg-gradient-to-br from-orange-400/90 via-orange-300/80 to-orange-100/70">
					<div className="mb-4 flex justify-between items-center">
						<span className="rounded bg-teal-600 px-2 py-1 text-xs text-white">
							About Community
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="text-xs text-teal-700"
							asChild
						>
							<Link href="/dashboard/about">About</Link>
						</Button>
					</div>

					<h3 className="text-xl font-bold text-slate-800">Join Our Community</h3>
					<p className="mt-2 text-sm text-slate-600 max-w-[80%]">
						Connect with others who understand your journey. Share experiences and
						heal together.
					</p>

					<div className="mt-4 flex items-center">
						<div className="flex -space-x-3">
							<Avatar className="border-2 border-white h-10 w-10">
								<AvatarImage src="/dashboard/doctors/maina.jpeg" alt="User" />
								<AvatarFallback>U1</AvatarFallback>
							</Avatar>
							<Avatar className="border-2 border-white h-10 w-10">
								<AvatarImage src="/dashboard/doctors/dr-emilia.jpg" alt="User" />
								<AvatarFallback>U2</AvatarFallback>
							</Avatar>
							<Avatar className="border-2 border-white h-10 w-10">
								<AvatarImage src="/dashboard/doctors/sauti.jpeg" alt="User" />
								<AvatarFallback>U3</AvatarFallback>
							</Avatar>
							<Avatar className="border-2 border-white h-10 w-10 bg-teal-600 text-white">
								<AvatarFallback>+5</AvatarFallback>
							</Avatar>
						</div>
					</div>

					<div className="mt-6 flex gap-4">
						<Link
							href="https://www.instagram.com/p/DDYrY0YsN0W/?igsh=cjBwbjBpZmx3dzNn"
							target="_blank"
							rel="noopener noreferrer"
							className="text-slate-700 hover:text-slate-900 transition-colors"
						>
							<MessageCircle className="w-5 h-5" />
						</Link>
						<Link
							href="https://x.com/sautisalama"
							target="_blank"
							rel="noopener noreferrer"
							className="text-slate-700 hover:text-slate-900 transition-colors"
						>
							<Twitter className="w-5 h-5" />
						</Link>
						<Link
							href="https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://www.linkedin.com/company/sauti-salama"
							target="_blank"
							rel="noopener noreferrer"
							className="text-slate-700 hover:text-slate-900 transition-colors"
						>
							<Linkedin className="w-5 h-5" />
						</Link>
					</div>

					{/* Network illustration - you'll need to replace with your actual illustration */}
					<div className="absolute bottom-0 right-0 w-32 h-32 opacity-80">
						<svg
							viewBox="0 0 200 200"
							className="w-full h-full"
							style={{ transform: "rotate(-10deg)" }}
						>
							{/* Simple network visualization */}
							<circle cx="100" cy="100" r="8" fill="#1a3434" />
							<circle cx="140" cy="80" r="6" fill="#1a3434" />
							<circle cx="60" cy="120" r="6" fill="#1a3434" />
							<circle cx="150" cy="130" r="6" fill="#1a3434" />
							<line
								x1="100"
								y1="100"
								x2="140"
								y2="80"
								stroke="#1a3434"
								strokeWidth="2"
							/>
							<line
								x1="100"
								y1="100"
								x2="60"
								y2="120"
								stroke="#1a3434"
								strokeWidth="2"
							/>
							<line
								x1="100"
								y1="100"
								x2="150"
								y2="130"
								stroke="#1a3434"
								strokeWidth="2"
							/>
						</svg>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
