"use client";

import { Briefcase, Check, Shield, User, Building2 } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useWorkspace, type WorkspaceId } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

/**
 * The same three-way switch in every account menu (sidebar and phone). Whoever can use more than one
 * workspace sees where they are and can move with one tap; everyone else sees nothing.
 */
export function WorkspaceMenu({ canSwitch, primaryRole }: { canSwitch: boolean; primaryRole?: string | null }) {
	const { current, go } = useWorkspace();
	if (!canSwitch) return null;

	const personalLabel = primaryRole === "ngo" ? "NGO" : primaryRole === "survivor" ? "Survivor" : "Professional";
	const rows: { id: WorkspaceId; label: string; hint: string; icon: typeof User; tone: string }[] = [
		{ id: "personal", label: personalLabel, hint: "Your cases and services", icon: primaryRole === "ngo" ? Building2 : User, tone: "bg-serene-neutral-100 text-serene-neutral-700" },
		{ id: "admin", label: "Admin", hint: "Platform management", icon: Shield, tone: "bg-blue-50 text-blue-600" },
		{ id: "suite", label: "Mjengo suite", hint: "Mail, grants, projects", icon: Briefcase, tone: "bg-purple-50 text-purple-600" },
	];

	return (
		<>
			<DropdownMenuSeparator className="my-1 bg-serene-neutral-100" />
			<DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-500">Workspace</DropdownMenuLabel>
			<div role="radiogroup" aria-label="Workspace">
				{rows.map(({ id, label, hint, icon: Icon, tone }) => {
					const active = current === id;
					return (
						<DropdownMenuItem
							key={id}
							role="radio"
							aria-checked={active}
							onSelect={() => !active && go(id)}
							className={cn("m-1 flex cursor-pointer items-center gap-3 rounded-xl p-2", active && "bg-serene-neutral-50")}
						>
							<div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
								<Icon className="h-4 w-4" aria-hidden />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold leading-tight text-serene-neutral-900">{label}</p>
								<p className="text-xs leading-tight text-serene-neutral-600">{hint}</p>
							</div>
							{active && <Check className="h-4 w-4 text-sauti-teal" aria-label="Current workspace" />}
						</DropdownMenuItem>
					);
				})}
			</div>
		</>
	);
}
