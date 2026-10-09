import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { looseAdmin } from "@/lib/loose-db";
import { getInvitePreview } from "@/app/actions/community-invite";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { JoinGroupButton } from "./JoinGroupButton";

export const metadata = { title: "Join group", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	const preview = await getInvitePreview(code);

	if (!preview) {
		return (
			<Shell>
				<h1 className="text-xl font-bold text-serene-neutral-900">This invite link isn&apos;t valid</h1>
				<p className="mt-2 text-sm text-serene-neutral-600">It may have been reset by a group admin. Ask them for a new link.</p>
				<Button asChild className="mt-6 w-full">
					<Link href="/dashboard/chat">Go to chats</Link>
				</Button>
			</Shell>
		);
	}

	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	// Already in the group: just open it.
	if (user) {
		const db = looseAdmin();
		const { data: c } = await db.from("communities").select("id, chat_id").eq("invite_code", preview.code).maybeSingle();
		if (c) {
			const { data: m } = await db.from("community_members").select("id").eq("community_id", c.id).eq("user_id", user.id).maybeSingle();
			if (m && c.chat_id) redirect(`/dashboard/chat?id=${c.chat_id}`);
		}
	}

	const next = encodeURIComponent(`/join/${preview.code}`);

	return (
		<Shell>
			<Avatar className="mx-auto h-24 w-24 ring-4 ring-white shadow-md">
				<AvatarImage src={preview.avatarUrl ?? undefined} />
				<AvatarFallback className="bg-gradient-to-br from-serene-blue-100 to-serene-blue-50 text-3xl font-bold text-serene-blue-600">{preview.name.charAt(0).toUpperCase()}</AvatarFallback>
			</Avatar>
			<p className="mt-4 text-xs font-bold uppercase tracking-widest text-serene-neutral-400">You&apos;re invited to join</p>
			<h1 className="mt-1 text-2xl font-bold text-serene-neutral-900">{preview.name}</h1>
			<p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-serene-neutral-500">
				<Users className="h-4 w-4" /> {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}
			</p>
			{preview.description && <p className="mt-4 whitespace-pre-line text-sm text-serene-neutral-700">{preview.description}</p>}

			<div className="mt-6 space-y-2">
				{user ? (
					<JoinGroupButton code={preview.code} />
				) : (
					<>
						<Button asChild className="w-full">
							<Link href={`/signin?next=${next}`}>Log in to join</Link>
						</Button>
						<Button asChild variant="outline" className="w-full">
							<Link href={`/signup?next=${next}`}>Create an account</Link>
						</Button>
						<p className="pt-1 text-xs text-serene-neutral-400">You&apos;ll be asked to confirm before you join.</p>
					</>
				)}
			</div>
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-[100dvh] items-center justify-center bg-serene-neutral-50 px-4 py-10">
			<div className="w-full max-w-sm rounded-3xl border border-serene-neutral-100 bg-white p-8 text-center shadow-sm">{children}</div>
		</main>
	);
}
