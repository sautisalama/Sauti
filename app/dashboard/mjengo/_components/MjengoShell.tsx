"use client";

import { OpenRouterBalance } from "./OpenRouterBalance";
import Link from "next/link";
import { useEffect, useState } from "react";
import { mjengoNav } from "@/app/actions/mjengo-nav";
import { usePathname } from "next/navigation";
import { ArrowLeft, GraduationCap, ClipboardList, Briefcase, CheckSquare, FileText, HardDrive, FolderKanban, LayoutDashboard, Lightbulb, Mail, ScrollText, ShieldCheck, Sparkles, CalendarClock, Users, MessageCircle, Bell, Megaphone, Palette, Video, BookMarked, Receipt, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { MjengoDock } from "./MjengoDock";
import { UploadTray } from "@/components/mjengo/UploadTray";
import { startSuiteNotifications } from "@/lib/client/suite-notifications";

const BASE = "/dashboard/mjengo";

const TABS = [
	{ href: BASE, label: "Overview", icon: LayoutDashboard, exact: true },
	{ href: `${BASE}/mail`, label: "Mail", icon: Mail },
	{ href: `${BASE}/chat`, label: "Chats", icon: MessageCircle },
	{ href: `${BASE}/contacts`, label: "Contacts", icon: Users },
	{ href: `${BASE}/calendar`, label: "Calendar", icon: CalendarClock },
	{ href: "/meet", label: "Meet", icon: Video },
	{ href: `${BASE}/vault`, label: "Files", icon: HardDrive },
	{ href: `${BASE}/forms`, label: "Forms", icon: ClipboardList },
	{ href: `${BASE}/grants`, label: "Grants", icon: Briefcase },
	{ href: `${BASE}/opportunities`, label: "Opportunities", icon: Lightbulb },
	{ href: `${BASE}/projects`, label: "Projects", icon: FolderKanban },
	{ href: `${BASE}/fellowships`, label: "Fellowships", icon: GraduationCap },
	{ href: `${BASE}/todos`, label: "To-dos", icon: CheckSquare },
	{ href: `${BASE}/playbooks`, label: "Playbooks", icon: Workflow },
	{ href: `${BASE}/assistant`, label: "Assistant", icon: Sparkles },
	{ href: `${BASE}/design`, label: "Design", icon: Palette },
	{ href: `${BASE}/finance`, label: "Finance", icon: Receipt },
	{ href: `${BASE}/brand`, label: "Brand", icon: BookMarked },
	{ href: `${BASE}/people`, label: "People & access", icon: ShieldCheck, superOnly: true },
	{ href: `${BASE}/logs`, label: "Logs", icon: ScrollText, superOnly: true },
];

export function MjengoShell({ isSuper, children }: { isSuper: boolean; children: React.ReactNode }) {
	const pathname = usePathname() ?? "";
	// Grants, projects and fellowships show once there is one (an opportunity that was won).
	const [has, setHas] = useState({ grants: true, projects: true, fellowships: true });
	useEffect(() => { mjengoNav().then((n) => setHas(n.has)).catch(() => undefined); }, []);
	// On a phone the strip scrolls freely and the current section rests in the middle.
	useEffect(() => {
		const el = document.querySelector<HTMLElement>('nav[aria-label="Mjengo sections"] [aria-current="page"]');
		el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
	}, [pathname]);
	// Retheme shadcn controls (also in portals) while the suite is open.
	useEffect(() => {
		document.documentElement.classList.add("mjengo-theme");
		return () => document.documentElement.classList.remove("mjengo-theme");
	}, []);
	// Notifications load at once and stay live, so counters are right before anything is opened.
	useEffect(() => { startSuiteNotifications(); }, []);
	// Warm the mail screen shortly after the suite opens, so Mail is already there when it is clicked.
	useEffect(() => {
		// Only for people who use mail, and only when the browser is idle: it must never slow the first screen.
		let used = false;
		try { used = localStorage.getItem("ss_mail_used") === "1"; } catch { /* no storage */ }
		if (!used) return;
		const run = () => { import("../mail/_components/mail-store").then((m) => m.prefetchMail()).catch(() => undefined); };
		const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
		if (w.requestIdleCallback) { const id = w.requestIdleCallback(run, { timeout: 6000 }); return () => w.cancelIdleCallback?.(id); }
		const t = setTimeout(run, 4000);
		return () => clearTimeout(t);
	}, []);
	// Mail and the document editor take the whole window, like native apps.
	const fullBleed = pathname.startsWith(`${BASE}/mail`) || pathname.startsWith(`${BASE}/assistant`) || pathname.startsWith(`${BASE}/files/`) || pathname.startsWith(`${BASE}/chat`) || pathname.startsWith(`${BASE}/design/editor`) || pathname.startsWith(`${BASE}/documents/editor`);

	return (
		<div className={cn("flex min-h-dvh flex-col bg-serene-neutral-50", fullBleed && "h-dvh min-h-0")}>
			<OpenRouterBalance />
			{/* Phones have no side panel: the same sections as a scrolling strip. */}
			<nav aria-label="Mjengo sections" className={cn("flex shrink-0 gap-1 overflow-x-auto snap-x snap-proximity overscroll-x-contain border-b border-serene-neutral-200 bg-white px-2 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] scrollbar-hide lg:hidden", (pathname.startsWith(`${BASE}/files/`) || pathname.startsWith(`${BASE}/documents/editor`) || pathname.startsWith(`${BASE}/design/editor`)) && "max-sm:hidden")}>
{pathname !== BASE && (
					<button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign(BASE); }} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-serene-neutral-500">
						<ArrowLeft className="h-4 w-4" /> Back
					</button>
				)}
				{TABS.filter((t) => (!t.superOnly || isSuper) && !((t.href.endsWith("/grants") && !has.grants) || (t.href.endsWith("/projects") && !has.projects) || (t.href.endsWith("/fellowships") && !has.fellowships))).map((t) => {
					const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
					return (
						<Link
							key={t.href}
							href={t.href}
							aria-current={active ? "page" : undefined}
							className={cn(
								"flex shrink-0 snap-center touch-manipulation items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
								active ? "bg-sauti-teal-light text-sauti-teal" : "text-serene-neutral-600 hover:bg-serene-neutral-100"
							)}
						>
							<t.icon className="h-4 w-4" />
							{t.label}
						</Link>
					);
				})}
			</nav>
			<MjengoDock />
			<UploadTray />
			<div className={cn("w-full flex-1", fullBleed ? "min-h-0" : "px-4 py-5 md:px-8")}>{children}</div>
		</div>
	);
}
