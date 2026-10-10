"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AccountView } from "./api";

const KIND: Record<string, string> = { google: "Google", microsoft: "Microsoft" };

const providerOf = (a: AccountView) => KIND[a.auth_type] ?? (a.protocol === "pop3" ? "POP3" : "IMAP");

/** Avatar chosen from the address so each mailbox is recognisable at a glance. */
const TONES = ["bg-purple-100 text-purple-700", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
const tone = (s: string) => TONES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];

function Avatar({ email, className }: { email: string; className?: string }) {
	return <span className={cn("flex shrink-0 items-center justify-center rounded-lg font-bold uppercase", tone(email), className)}>{email.charAt(0)}</span>;
}

/**
 * The menu beside your name at the top of the sidebar: pick which mailbox you are in, add another,
 * or open mail settings (the way Notion Mail's account menu works).
 */
export function AccountSwitcher({ accounts, accountId, onSelect, onAdd, onSettings }: { accounts: AccountView[]; accountId: string | null; onSelect: (id: string) => void; onAdd: () => void; onSettings: () => void }) {
	const current = accounts.find((a) => a.id === accountId) ?? accounts[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="flex w-full touch-manipulation items-center gap-2.5 rounded-xl bg-white px-2 py-1.5 text-left shadow-sm transition hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500" aria-label="Switch or add mailbox">
					{current && <Avatar email={current.email} className="h-8 w-8 text-sm" />}
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold text-serene-neutral-900">{current?.label || current?.email}</span>
						<span className="block truncate text-[11px] text-serene-neutral-500">{current ? `${current.email}` : "No mailbox"}</span>
					</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 text-serene-neutral-400" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[270px] rounded-xl p-1.5">
				<DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-400">Mailboxes</DropdownMenuLabel>
				{accounts.map((a) => (
					<DropdownMenuItem key={a.id} onSelect={() => onSelect(a.id)} className="gap-2.5 rounded-lg px-2 py-2">
						<Avatar email={a.email} className="h-8 w-8 text-sm" />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-medium">{a.email}</span>
							<span className="block text-[11px] text-serene-neutral-500">{providerOf(a)}</span>
						</span>
						{a.id === current?.id && <Check className="h-4 w-4 shrink-0 text-purple-600" />}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onAdd} className="gap-2.5 rounded-lg px-2 py-2">
					<span className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-serene-neutral-300 text-serene-neutral-500"><Plus className="h-4 w-4" /></span>
					<span className="text-sm font-medium">Add email account</span>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={onSettings} className="gap-2.5 rounded-lg px-2 py-2">
					<span className="flex h-8 w-8 items-center justify-center text-serene-neutral-500"><Settings className="h-4 w-4" /></span>
					<span className="text-sm">Mail settings</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
