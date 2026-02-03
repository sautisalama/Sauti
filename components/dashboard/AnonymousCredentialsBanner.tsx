"use client";

import { useState, useEffect } from "react";
import { Copy, Check, User, Key, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { CreatePermanentAccountModal } from "./CreatePermanentAccountModal";

interface AnonymousCredentialsBannerProps {
	username?: string;
	onDismiss?: () => void;
}

export function AnonymousCredentialsBanner({ 
	username: propUsername, 
	onDismiss 
}: AnonymousCredentialsBannerProps) {
	const { toast } = useToast();
	const [username, setUsername] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		// Get username from props or sessionStorage
		if (propUsername) {
			setUsername(propUsername);
		} else if (typeof window !== "undefined") {
			const stored = sessionStorage.getItem("anon_username");
			if (stored) setUsername(stored);
		}

		// Check if previously dismissed
		if (typeof window !== "undefined") {
			const wasDismissed = sessionStorage.getItem("anon_banner_dismissed");
			if (wasDismissed === "true") setDismissed(true);
		}
	}, [propUsername]);

	const handleCopy = async () => {
		if (!username) return;
		
		const fullEmail = `${username}@anon.sautisalama.org`;
		try {
			await navigator.clipboard.writeText(fullEmail);
			setCopied(true);
			toast({
				title: "Copied!",
				description: "Username copied to clipboard",
			});
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				title: "Copy failed",
				description: "Please copy manually",
				variant: "destructive",
			});
		}
	};

	const handleDismiss = () => {
		if (typeof window !== "undefined") {
			sessionStorage.setItem("anon_banner_dismissed", "true");
		}
		setDismissed(true);
		onDismiss?.();
	};

	if (!username || dismissed) return null;

	return (
		<div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white shadow-xl">
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1 space-y-4">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-5 h-5 text-yellow-300" />
						<h3 className="font-bold text-lg">Save Your Login Credentials</h3>
					</div>
					
					<p className="text-sm text-blue-100">
						Your anonymous account has been created. Save these credentials to access your dashboard later.
					</p>

					{/* Username Display */}
					<div className="bg-white/10 backdrop-blur rounded-xl p-4 space-y-3">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<User className="w-4 h-4 text-blue-200" />
								<span className="text-sm text-blue-200">Username:</span>
							</div>
							<div className="flex items-center gap-2">
								<code className="bg-white/20 px-3 py-1 rounded font-mono text-sm">
									{username}@anon.sautisalama.org
								</code>
								<button
									onClick={handleCopy}
									className="p-1.5 hover:bg-white/20 rounded transition-colors"
									title="Copy username"
								>
									{copied ? (
										<Check className="w-4 h-4 text-green-300" />
									) : (
										<Copy className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>
						
						<div className="flex items-center gap-2">
							<Key className="w-4 h-4 text-blue-200" />
							<span className="text-sm text-blue-200">Password:</span>
							<span className="text-sm italic text-blue-100">The password you created during registration</span>
						</div>
					</div>

					{/* Actions */}
					<div className="flex flex-wrap gap-3">
						<CreatePermanentAccountModal>
							<Button 
								variant="secondary" 
								className="bg-white text-blue-600 hover:bg-blue-50"
							>
								<ExternalLink className="w-4 h-4 mr-2" />
								Create Permanent Account
							</Button>
						</CreatePermanentAccountModal>
						<Button 
							variant="ghost" 
							className="text-white hover:bg-white/10"
							onClick={handleDismiss}
						>
							I&apos;ve saved my credentials
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
