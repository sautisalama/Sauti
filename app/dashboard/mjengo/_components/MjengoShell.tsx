"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ClipboardList, Briefcase, CheckSquare, FileText, HardDrive, FolderKanban, LayoutDashboard, Lightbulb, Mail, ScrollText, ShieldCheck } from "lucide-react";
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
	// Mail and the document editor take the whole window, like native apps.
	const fullBleed = pathname.startsWith(`${BASE}/mail`) || pathname.startsWith(`${BASE}/documents/editor`);

	return (
		<div className={cn("flex min-h-dvh flex-col bg-serene-neutral-50", fullBleed && "h-dvh min-h-0")}>
			{/* Phones have no side panel: the same sections as a scrolling strip. */}
			<nav aria-label="Mjengo sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-serene-neutral-200 bg-white px-2 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] scrollbar-hide lg:hidden">
				<Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-serene-neutral-500">
					<ArrowLeft className="h-4 w-4" /> Dashboard
				</Link>
				{TABS.filter((t) => !t.superOnly || isSuper).map((t) => {
					const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
					return (
						<Link
							key={t.href}
							href={t.href}
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex shrink-0 touch-manipulation items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
								active ? "bg-sauti-teal-light text-sauti-teal" : "text-serene-neutral-600 hover:bg-serene-neutral-100"
							)}
						>
							<t.icon className="h-4 w-4" />
							{t.label}
						</Link>
					);
				})}
			</nav>
			<div className={cn("w-full flex-1", fullBleed ? "min-h-0" : "px-4 py-5 md:px-8")}>{children}</div>
		</div>
	);
}
