"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Briefcase, CalendarClock, CheckSquare, FileText, HardDrive, FolderKanban, LayoutDashboard, Lightbulb, Mail, ScrollText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/dashboard/mjengo";

const TABS = [
	{ href: BASE, label: "Overview", icon: LayoutDashboard, exact: true },
	{ href: `${BASE}/mail`, label: "Mail", icon: Mail },
	{ href: `${BASE}/grants`, label: "Grants", icon: Briefcase },
	{ href: `${BASE}/opportunities`, label: "Opportunities", icon: Lightbulb },
	{ href: `${BASE}/projects`, label: "Projects", icon: FolderKanban },
	{ href: `${BASE}/forms`, label: "Forms", icon: ClipboardList },
	{ href: `${BASE}/todos`, label: "To-dos", icon: CheckSquare },
	{ href: `${BASE}/documents`, label: "Documents", icon: FileText },
	{ href: `${BASE}/vault`, label: "Vault", icon: HardDrive },
	{ href: `${BASE}/people`, label: "People & access", icon: ShieldCheck, superOnly: true },
	{ href: `${BASE}/logs`, label: "Logs", icon: ScrollText, superOnly: true },
];

export function MjengoShell({ isSuper, children }: { isSuper: boolean; children: React.ReactNode }) {
	const pathname = usePathname() ?? "";
	// The mail client uses the whole window, like a mail app.
	const fullBleed = pathname.startsWith(`${BASE}/mail`);

	return (
		<div className={cn("flex min-h-screen flex-col bg-serene-neutral-50", fullBleed && "h-[calc(100dvh-9rem)] min-h-0 lg:h-[100dvh]")}>
			<div className="z-20 border-b border-serene-neutral-200 bg-white">
				<div className="mx-auto w-full max-w-7xl px-4 pt-3 md:px-8">
					<div className="flex items-center gap-3 pb-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sauti-teal text-white shadow-sm">
							<CalendarClock className="h-5 w-5" />
						</div>
						<div className="min-w-0">
							<h1 className="text-lg font-bold leading-tight text-sauti-dark">Mjengo Suite</h1>
							<p className="text-xs text-serene-neutral-500">Mail, grants, opportunities and projects. Administrators only.</p>
						</div>
					</div>
					<nav aria-label="Mjengo sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 scrollbar-hide">
						{TABS.filter((t) => !t.superOnly || isSuper).map((t) => {
							const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
							return (
								<Link
									key={t.href}
									href={t.href}
									aria-current={active ? "page" : undefined}
									className={cn(
										"flex shrink-0 touch-manipulation items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
										active ? "bg-sauti-teal-light text-sauti-teal" : "text-serene-neutral-600 hover:bg-serene-neutral-100 hover:text-sauti-dark"
									)}
								>
									<t.icon className="h-4 w-4" />
									{t.label}
								</Link>
							);
						})}
					</nav>
				</div>
			</div>
			<div className={cn("w-full flex-1", fullBleed ? "min-h-0" : "mx-auto max-w-7xl px-4 py-6 md:px-8")}>{children}</div>
		</div>
	);
}
