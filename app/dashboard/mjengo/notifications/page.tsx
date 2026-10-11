"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck, Lightbulb, ListChecks, Mail, Megaphone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { MjengoLoader } from "../_components/MjengoLoader";

interface Note { id: string; type: string; title: string; message: string | null; link: string | null; read: boolean; created_at: string }

const ICON: Record<string, typeof Bell> = { todo_due: ListChecks, todo_assigned: ListChecks, opportunity: Lightbulb, mail: Mail, meeting: Video, post: Megaphone };

/** Only what belongs to the suite: anything that links into it. */
export default function NotificationsPage() {
	const supabase = useMemo(() => createClient(), []);
	const [notes, setNotes] = useState<Note[] | null>(null);
	const [onlyUnread, setOnlyUnread] = useState(false);

	const load = useCallback(async () => {
		const { data } = await supabase.from("notifications").select("id, type, title, message, link, read, created_at").like("link", "/dashboard/mjengo%").order("created_at", { ascending: false }).limit(100);
		setNotes((data ?? []) as Note[]);
	}, [supabase]);
	useEffect(() => { load().catch(() => setNotes([])); }, [load]);

	const mark = async (ids: string[]) => {
		if (!ids.length) return;
		await supabase.from("notifications").update({ read: true }).in("id", ids);
		setNotes((cur) => cur?.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) ?? cur);
	};

	if (!notes) return <MjengoLoader label="Loading notifications" />;
	const shown = onlyUnread ? notes.filter((n) => !n.read) : notes;
	const unread = notes.filter((n) => !n.read);

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Notifications</h2>
					<p className="text-sm text-serene-neutral-500">{unread.length ? `${unread.length} unread` : "You are up to date"}. Only the suite&apos;s own notifications appear here.</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5">
						<button onClick={() => setOnlyUnread(false)} aria-pressed={!onlyUnread} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", !onlyUnread ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>All</button>
						<button onClick={() => setOnlyUnread(true)} aria-pressed={onlyUnread} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", onlyUnread ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>Unread</button>
					</div>
					<Button variant="outline" size="sm" className="gap-1.5" disabled={!unread.length} onClick={() => mark(unread.map((n) => n.id))}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
				{shown.length === 0 ? (
					<div className="p-12 text-center">
						<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><Bell className="h-6 w-6" /></span>
						<p className="text-sm font-medium text-sauti-dark">{onlyUnread ? "Nothing unread" : "No notifications yet"}</p>
						<p className="mt-1 text-sm text-serene-neutral-500">Task reminders, assignments and scheduled posts show up here.</p>
					</div>
				) : (
					<ul className="divide-y divide-serene-neutral-100">
						{shown.map((n) => {
							const Icon = ICON[n.type] ?? Bell;
							const body = (
								<>
									<span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", n.read ? "bg-serene-neutral-100 text-serene-neutral-500" : "bg-sauti-teal-light text-sauti-teal")}><Icon className="h-5 w-5" /></span>
									<span className="min-w-0 flex-1">
										<span className={cn("block text-sm text-serene-neutral-900", !n.read && "font-semibold")}>{n.title}</span>
										{n.message && <span className="block text-sm text-serene-neutral-600">{n.message}</span>}
										<span className="mt-0.5 block text-xs text-serene-neutral-400">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
									</span>
									{!n.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sauti-teal" aria-label="Unread" />}
								</>
							);
							return (
								<li key={n.id} className="group flex items-start">
									{n.link ? <Link href={n.link} onClick={() => mark([n.id])} className="flex min-w-0 flex-1 items-start gap-3 p-4 hover:bg-serene-neutral-50">{body}</Link> : <div className="flex min-w-0 flex-1 items-start gap-3 p-4">{body}</div>}
									{!n.read && <button onClick={() => mark([n.id])} aria-label="Mark as read" title="Mark as read" className="m-3 hidden h-8 w-8 items-center justify-center rounded-lg text-serene-neutral-400 hover:bg-serene-neutral-100 group-hover:flex"><Check className="h-4 w-4" /></button>}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
