import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
	title: "You are offline | Sauti Salama",
};

export default function OfflinePage() {
	return (
		<div className="flex h-[100dvh] w-full flex-col justify-center items-center p-6 text-center bg-gray-50">
			<div className="rounded-full bg-orange-100 p-6 mb-6">
				<WifiOff className="h-12 w-12 text-[#FC8E00]" />
			</div>
			
			<h1 className="text-3xl font-bold mb-4 text-gray-900">
				You're currently offline
			</h1>
			
			<p className="text-gray-600 mb-8 max-w-md">
				It looks like you've lost your internet connection. Don't worry, Sauti Salama will automatically reconnect when your connection is restored.
			</p>
			
			<RetryButton />
		</div>
	);
}
