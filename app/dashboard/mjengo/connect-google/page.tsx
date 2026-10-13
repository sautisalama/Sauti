import Link from "next/link";
import { Mail, HardDrive, Users, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { mail: "your mailbox and calendar", drive: "Google Drive", contacts: "your Google contacts" };

/** Asked once, when someone who did not sign in with Google connects a single Google service. */
export default async function ConnectGooglePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const sp = await searchParams;
	const service = sp.service === "drive" || sp.service === "contacts" ? sp.service : "mail";
	const keep = new URLSearchParams();
	for (const k of ["email", "kind", "id", "return"]) if (sp[k]) keep.set(k, sp[k]!);
	keep.set("choice", "done");
	const everything = new URLSearchParams(keep);
	everything.delete("kind"); everything.delete("id"); everything.delete("return");
	const only = new URLSearchParams(keep);
	const onlyHref = service === "mail" ? `/api/mjengo/mail/oauth/google/start?${(() => { const q = new URLSearchParams(only); q.set("all", "0"); return q; })()}` : service === "drive" ? `/api/mjengo/drive/google/start?${only}` : `/api/mjengo/contacts/google/start?${only}`;
	const Icon = service === "mail" ? Mail : service === "drive" ? HardDrive : Users;
	return (
		<div className="mx-auto max-w-lg py-10">
			<div className="rounded-2xl border border-serene-neutral-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
				<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><Icon className="h-5 w-5" /></span>
				<h1 className="mt-4 text-xl font-bold tracking-tight text-sauti-dark">Connect Google</h1>
				<p className="mt-1 text-sm text-serene-neutral-600">You are about to connect {LABEL[service]}. Would you like to connect the rest of Google at the same time, so you are asked only once?</p>
				<div className="mt-5 space-y-2.5">
					<a href={`/api/mjengo/mail/oauth/google/start?${everything}`} className="flex items-start gap-3 rounded-xl border border-sauti-teal/30 bg-sauti-teal-light/40 p-4 hover:bg-sauti-teal-light/70">
						<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sauti-teal" />
						<span><span className="block text-sm font-semibold text-sauti-dark">Connect everything</span><span className="block text-xs text-serene-neutral-600">Mail, calendar, files and contacts in one consent.</span></span>
					</a>
					<a href={onlyHref} className="flex items-start gap-3 rounded-xl border border-serene-neutral-200 p-4 hover:bg-serene-neutral-50">
						<Icon className="mt-0.5 h-5 w-5 shrink-0 text-serene-neutral-500" />
						<span><span className="block text-sm font-semibold text-sauti-dark">Only {LABEL[service]}</span><span className="block text-xs text-serene-neutral-600">Everything else is connected later, when you use it.</span></span>
					</a>
				</div>
				<Link href="/dashboard/mjengo" className="mt-5 inline-block text-sm text-serene-neutral-500 hover:underline">Not now</Link>
			</div>
		</div>
	);
}
