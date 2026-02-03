"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";

export function CreatePermanentAccountModal({ 
	children,
	onSuccess 
}: { 
	children: React.ReactNode;
	onSuccess?: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const { toast } = useToast();
	const supabase = createClient();
	const router = useRouter();

	const handleUpgrade = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			// 1. Update the user's email in Supabase Auth
			const { data, error } = await supabase.auth.updateUser({
				email: email,
			});

			if (error) throw error;

			// 2. Optimization: We could also update metadata or profile here if needed, 
			// but Supabase will handle the email change confirmation process.
			
			toast({
				title: "Verification Email Sent",
				description: `Please check ${email} to verify your permanent account.`,
			});

			setOpen(false);
			onSuccess?.();
			
		} catch (error) {
			console.error("Error upgrading account:", error);
			toast({
				title: "Upgrade Failed",
				description: error instanceof Error ? error.message : "Failed to update account",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create Permanent Account</DialogTitle>
					<DialogDescription>
						Enter your email address to secure your account permanently. You&apos;ll be able to recover your password and access your data from any device.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleUpgrade} className="space-y-4 mt-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email Address</Label>
						<div className="relative">
							<Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								className="pl-9"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="flex justify-end gap-3 mt-6">
						<Button 
							type="button" 
							variant="outline" 
							onClick={() => setOpen(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Send Verification
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
