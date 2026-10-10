"use client";

import { Copy, Mail, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A sender or recipient in an opened email: click for the address and what you can do with it. */
export function PersonChip({ name, address, onWrite, onAddContact, className }: { name: string; address: string; onWrite: (address: string) => void; onAddContact: (name: string, address: string) => void; className?: string }) {
	const label = name || address;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button type="button" className={cn("rounded px-0.5 text-left hover:bg-black/5 hover:underline", className)} title={address}>
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-0">
				<div className="flex items-center gap-3 border-b border-serene-neutral-100 p-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sm font-bold text-sauti-teal">{label.charAt(0).toUpperCase()}</span>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold text-serene-neutral-900">{name || address}</p>
						<p className="truncate text-xs text-serene-neutral-500">{address}</p>
					</div>
				</div>
				<div className="p-1">
					<button onClick={() => onWrite(address)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-serene-neutral-100"><Mail className="h-4 w-4 text-serene-neutral-500" /> Write an email</button>
					<button onClick={() => onAddContact(name, address)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-serene-neutral-100"><UserPlus className="h-4 w-4 text-serene-neutral-500" /> Add to contacts</button>
					<button onClick={() => navigator.clipboard?.writeText(address)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-serene-neutral-100"><Copy className="h-4 w-4 text-serene-neutral-500" /> Copy address</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
