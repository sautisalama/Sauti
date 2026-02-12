"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
	Shield, 
	Mail, 
	ArrowRight, 
	CheckCircle2,
	Lock
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface UpgradeAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userEmail: string;
}

export function UpgradeAccountDialog({ 
	open, 
	onOpenChange,
	userEmail 
}: UpgradeAccountDialogProps) {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const { toast } = useToast();
	const supabase = createClient();

	const handleUpgradeWithGoogle = async () => {
		setLoading(true);
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
					queryParams: {
						access_type: "offline",
						prompt: "consent",
					},
				},
			});
			if (error) throw error;
		} catch (error: any) {
			console.error("Google upgrade error:", error);
			toast({
				title: "Upgrade Failed",
				description: error.message || "Could not start Google sign in",
				variant: "destructive",
			});
			setLoading(false);
		}
	};

	const handleUpgradeWithEmail = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const { error } = await supabase.auth.updateUser({
				email: email,
			});

			if (error) throw error;

			// Also update profile to remove anonymous flag
			// This might be better handled by a server action or trigger
			// For now let's rely on the auth update triggering handle things
			
			// We need to call an API route to handle the "upgrade" logic 
			// like setting is_anonymous to false in profiles table
			
			const upgradeResponse = await fetch("/api/auth/upgrade", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			
			if (!upgradeResponse.ok) {
				const data = await upgradeResponse.json();
				throw new Error(data.error || "Failed to update account status");
			}

			toast({
				title: "Confirmation Sent",
				description: "Please check your new email to confirm the change.",
			});
			onOpenChange(false);
		} catch (error: any) {
			console.error("Email upgrade error:", error);
			toast({
				title: "Upgrade Failed",
				description: error.message,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded-[2rem] shadow-2xl bg-white">
				<div className="bg-slate-900 p-8 text-center relative overflow-hidden">
					<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-teal-500/20 to-transparent pointer-events-none" />
					<div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-inner relative z-10">
						<Shield className="h-8 w-8 text-teal-400" />
					</div>
					<DialogTitle className="text-2xl font-bold text-white mb-2 relative z-10">Secure Your Account</DialogTitle>
					<DialogDescription className="text-slate-400 relative z-10">
						Upgrade to a permanent account to keep your history safe and sign in easily next time.
					</DialogDescription>
				</div>

				<div className="p-8 space-y-6">
					<div className="space-y-4">
						<Button 
							variant="outline" 
							className="w-full h-14 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold relative group overflow-hidden"
							onClick={handleUpgradeWithGoogle}
							disabled={loading}
						>
							<div className="absolute inset-0 w-full h-full bg-white transition-opacity group-hover:opacity-90" />
							<div className="relative flex items-center justify-center gap-3">
								<svg className="h-5 w-5" viewBox="0 0 24 24">
									<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
									<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
									<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
									<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
								</svg>
								Continue with Google
							</div>
						</Button>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t border-slate-100" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-white px-2 text-slate-400 font-bold tracking-wider">Or continue with email</span>
							</div>
						</div>

						<form onSubmit={handleUpgradeWithEmail} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email" className="text-slate-700 font-bold ml-1">Email Address</Label>
								<div className="relative">
									<Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
									<Input 
										id="email"
										type="email" 
										placeholder="you@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="pl-12 h-14 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-teal-500 focus-visible:border-teal-500 transition-all font-medium"
										required
										disabled={loading}
									/>
								</div>
							</div>
							<Button 
								type="submit" 
								className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg shadow-lg shadow-teal-200 hover:shadow-xl hover:shadow-teal-300 transition-all"
								disabled={loading}
							>
								{loading ? (
									<span className="flex items-center gap-2">
										<span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
										Updating...
									</span>
								) : (
									<span className="flex items-center gap-2">
										Update Account <ArrowRight className="h-5 w-5" />
									</span>
								)}
							</Button>
						</form>
					</div>

					<div className="bg-slate-50 rounded-xl p-4 flex gap-3 items-start">
						<Lock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
						<p className="text-xs text-slate-500 leading-relaxed">
							Your current session data, including reports and messages, will be automatically transferred to your permanent account.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
