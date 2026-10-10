"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AccountView } from "./api";

const KIND: Record<string, string> = { google: "Google", microsoft: "Microsoft" };

const providerOf = (a: AccountView) => KIND[a.auth_type] ?? (a.protocol === "pop3" ? "POP3" : "IMAP");

/** Avatar chosen from the address so each mailbox is recognisable at a glance. */
const TONES = ["bg-sauti-teal-light text-sauti-teal", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
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
				<button className="flex h-9 w-full touch-manipulation items-center gap-2 rounded-md px-1.5 text-left text-[#37352f] transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauti-teal" aria-label="Switch or add mailbox">
					{current && <Avatar email={current.email} className="h-6 w-6 rounded-full text-xs" />}
					<span className="min-w-0 flex-1 truncate text-[15px] font-medium">{current?.label || current?.email || "No mailbox"}</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 text-[#9b9a97]" />
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
						{a.id === current?.id && <Check className="h-4 w-4 shrink-0 text-sauti-teal" />}
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
