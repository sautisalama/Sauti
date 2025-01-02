import { Clock, MapPin, Lightbulb, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommunityCard() {
	return (
		<div className="rounded-2xl bg-white p-6 shadow-sm">
			<div className="mb-6">
				<span className="text-[#FF8A65]">Community</span>
				<h3 className="text-xl font-semibold text-[#00A5A5]">
					Join our volunteer team
				</h3>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<div className="space-y-2">
					<span className="text-sm text-gray-400">PLACE</span>
					<div className="flex items-center gap-2">
						<MapPin className="h-5 w-5 text-[#00A5A5]" />
						<span className="font-medium">KHA Hospital</span>
					</div>
				</div>

				<div className="space-y-2">
					<span className="text-sm text-gray-400">TIME</span>
					<div className="flex items-center gap-2">
						<Clock className="h-5 w-5 text-[#00A5A5]" />
						<span className="font-medium">3 PM</span>
					</div>
				</div>

				<div className="space-y-2">
					<span className="text-sm text-gray-400">GOALS</span>
					<div className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-[#00A5A5]" />
						<span className="font-medium">Share Success stories</span>
					</div>
				</div>

				<div className="space-y-2">
					<span className="text-sm text-gray-400">CONDITIONS</span>
					<div className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-[#00A5A5]" />
						<span className="font-medium">Be available</span>
					</div>
				</div>
			</div>

			<Button 
				className="mt-6 bg-[#00A5A5] hover:bg-[#008585] px-8"
				onClick={() => window.open('https://chat.whatsapp.com/K4EoeSsNEQ49y0b2P2O7RR', '_blank')}
			>
				Join
			</Button>
		</div>
	);
}
