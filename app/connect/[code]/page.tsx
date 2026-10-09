import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "./ConnectButton";

export const metadata = { title: "Connect", robots: { index: false } };

/** Landing page for a scanned/shared Sauti ID: sign in, then message the person. */
export default async function ConnectPage({ params }: { params: Promise<{ code: string }> }) {
	const { code } = await params;
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect(`/signin?next=${encodeURIComponent(`/connect/${code}`)}`);

	const { data } = await supabase.rpc("find_user_by_sauti_id", { p_code: code });
	const person = data?.[0];

	return (
		<main className="flex min-h-[100dvh] items-center justify-center bg-serene-neutral-50 px-4 py-10">
			<div className="w-full max-w-sm rounded-3xl border border-serene-neutral-100 bg-white p-8 text-center shadow-sm">
				{person ? (
					<>
						<Avatar className="mx-auto h-24 w-24 ring-4 ring-white shadow-md">
							<AvatarImage src={person.avatar_url ?? undefined} />
							<AvatarFallback className="bg-gradient-to-br from-serene-blue-100 to-serene-blue-50 text-3xl font-bold text-serene-blue-600">{person.first_name?.[0]?.toUpperCase()}</AvatarFallback>
						</Avatar>
						<h1 className="mt-4 text-2xl font-bold text-serene-neutral-900">
							{person.first_name} {person.last_name}
						</h1>
						<p className="text-sm capitalize text-serene-neutral-500">
							{String(person.user_type ?? "").replace(/_/g, " ")}
							{person.is_verified ? " · Verified" : ""}
						</p>
						<div className="mt-6">
							<ConnectButton userId={person.id} />
						</div>
					</>
				) : (
					<>
						<h1 className="text-xl font-bold text-serene-neutral-900">We couldn&apos;t find that Sauti ID</h1>
						<p className="mt-2 text-sm text-serene-neutral-600">It may have been changed, or it&apos;s your own. Ask them to share it again.</p>
						<Button asChild className="mt-6 w-full">
							<Link href="/dashboard/chat">Go to chats</Link>
						</Button>
					</>
				)}
			</div>
		</main>
	);
}
