"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Share2, RefreshCw, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getMySautiId, regenerateMySautiId } from "@/app/actions/chat-social";

/** "Your Sauti ID": a short code you can give anyone so they can start a chat with you. */
export function SautiIdCard({ compact = false }: { compact?: boolean }) {
	const [id, setId] = useState<string | null | undefined>(undefined);
	const [copied, setCopied] = useState(false);
	const [busy, setBusy] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		getMySautiId().then(setId).catch(() => setId(null));
	}, []);

	if (id === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-serene-neutral-100" />;
	if (!id) return null; // anonymous accounts have no shareable identity

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(id);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			toast({ title: "Could not copy", description: id });
		}
	};

	const share = async () => {
		const text = `Connect with me on Sauti Salama. My Sauti ID is ${id}`;
		if (navigator.share) {
			try {
				await navigator.share({ title: "My Sauti ID", text });
				return;
			} catch {
				/* cancelled: fall through to copy */
			}
		}
		copy();
	};

	const regenerate = async () => {
		if (!window.confirm("Make a new Sauti ID? Your old ID will stop working for anyone who has not already started a chat with you.")) return;
		setBusy(true);
		try {
			setId(await regenerateMySautiId());
			toast({ title: "New Sauti ID created" });
		} catch {
			toast({ title: "Could not change your ID", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="rounded-2xl border border-serene-neutral-200 bg-white p-4">
			<div className="flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
					<IdCard className="h-5 w-5" />
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="font-bold text-serene-neutral-900">Your Sauti ID</h3>
					{!compact && (
						<p className="mt-0.5 text-sm text-serene-neutral-600">
							Share this with people you want to hear from. They enter it under New message to start a chat. Only share it with people you trust.
						</p>
					)}
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<code className="select-all rounded-xl bg-purple-50 px-3 py-2 font-mono text-base font-bold tracking-wider text-purple-800">{id}</code>
						<Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
							{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							{copied ? "Copied" : "Copy"}
						</Button>
						<Button size="sm" variant="outline" onClick={share} className="gap-1.5">
							<Share2 className="h-4 w-4" /> Share
						</Button>
						<Button size="sm" variant="ghost" onClick={regenerate} disabled={busy} className="gap-1.5 text-serene-neutral-500">
							<RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> New ID
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
