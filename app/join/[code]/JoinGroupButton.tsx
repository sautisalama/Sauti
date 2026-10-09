"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinByInviteCode } from "@/app/actions/community-invite";

/** Asks first, then joins: nobody is added to a group just by opening a link. */
export function JoinGroupButton({ code }: { code: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	const join = async () => {
		setBusy(true);
		setError(null);
		try {
			const { chatId } = await joinByInviteCode(code);
			router.replace(`/dashboard/chat?id=${chatId}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not join the group.");
			setBusy(false);
		}
	};

	return (
		<>
			<p className="text-sm font-medium text-serene-neutral-800">Do you want to join this group?</p>
			<Button onClick={join} disabled={busy} className="w-full gap-2">
				{busy && <Loader2 className="h-4 w-4 animate-spin" />} Join group
			</Button>
			<Button variant="ghost" className="w-full" onClick={() => router.push("/dashboard/chat")} disabled={busy}>
				Not now
			</Button>
			{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
		</>
	);
}
