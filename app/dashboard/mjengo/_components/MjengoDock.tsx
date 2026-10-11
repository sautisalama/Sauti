"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, Calendar, Check, GripVertical, Loader2, MessageCircle, Mic, Video } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { cn } from "@/lib/utils";
import { createMeeting } from "@/app/actions/mjengo-meet";

interface Note { id: string; title: string; message: string | null; link: string | null; read: boolean; created_at: string }

const BTN = "relative flex h-10 w-10 items-center justify-center rounded-lg text-[#787774] transition-colors hover:bg-black/5 hover:text-[#37352f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40";

/**
 * A slim action bar on the left edge of the suite. It rests as a small handle and slides out on hover or
 * focus: chat, notifications, voice call, video call and calendar. Styled like the mail toolbar.
 */
export function MjengoDock() {
	const { toast } = useToast();
	const dash = useDashboardData();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const collapsed = mounted ? !!dash?.isSidebarCollapsed : false;

	const [notesOpen, setNotesOpen] = useState(false);
	const [notes, setNotes] = useState<Note[] | null>(null);
	const [unread, setUnread] = useState(0);
	const [starting, setStarting] = useState<"voice" | "video" | null>(null);
	const supabase = useMemo(() => createClient(), []);

	const loadNotes = useCallback(async () => {
		const { data } = await supabase.from("notifications").select("id, title, message, link, read, created_at").order("created_at", { ascending: false }).limit(30);
		const rows = (data ?? []) as Note[];
		setNotes(rows);
		setUnread(rows.filter((n) => !n.read).length);
	}, [supabase]);
	useEffect(() => { loadNotes().catch(() => undefined); }, [loadNotes]);

	const start = async (mode: "voice" | "video") => {
		setStarting(mode);
		try {
			const { code } = await unwrap(createMeeting(mode === "voice" ? "voice" : "video", null));
			const url = `${window.location.origin}/meet/${code}`;
			navigator.clipboard?.writeText(url).catch(() => undefined);
			window.open(url, "_blank", "noopener");
			toast({ title: mode === "voice" ? "Voice call started" : "Video call started", description: "The link is copied. Send it to anyone you want in the call." });
		} catch (e) {
			toast({ title: "Could not start the call", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setStarting(null);
		}
	};

	return (
		<TooltipProvider delayDuration={150}>
			<nav
				aria-label="Quick actions"
				className={cn(
					"group fixed top-1/2 z-30 hidden -translate-y-1/2 transition-[left] duration-300 lg:block",
					collapsed ? "lg:left-[72px]" : "lg:left-64"
				)}
			>
				<div className="flex items-center">
					<div className="-translate-x-[calc(100%-14px)] rounded-r-2xl border border-l-0 border-black/10 bg-white py-1.5 pl-1.5 pr-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] transition-transform duration-200 ease-out hover:translate-x-0 focus-within:translate-x-0 group-hover:translate-x-0">
						<div className="flex flex-col items-center gap-0.5">
							<Item label="Chat" hint="Open your conversations" href="/dashboard/chat"><MessageCircle className="h-[18px] w-[18px]" /></Item>
							<Item label="Notifications" hint="What needs your attention" onClick={() => { setNotesOpen(true); loadNotes().catch(() => undefined); }}>
								<Bell className="h-[18px] w-[18px]" />
								{unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sauti-teal px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
							</Item>
							<Item label="Voice call" hint="Start an audio call and share the link" onClick={() => start("voice")} busy={starting === "voice"}><Mic className="h-[18px] w-[18px]" /></Item>
							<Item label="Video call" hint="Start a video call with captions" onClick={() => start("video")} busy={starting === "video"}><Video className="h-[18px] w-[18px]" /></Item>
							<Item label="Calendar" hint="Month view, events and meetings" href="/dashboard/mjengo/calendar"><Calendar className="h-[18px] w-[18px]" /></Item>
						</div>
					</div>
					{/* The handle that stays visible while the bar is tucked away. */}
					<span aria-hidden className="pointer-events-none -ml-[14px] flex h-14 w-[14px] items-center justify-center rounded-r-lg border border-l-0 border-black/10 bg-white text-[#9b9a97] shadow-sm transition-opacity group-hover:opacity-0">
						<GripVertical className="h-4 w-4" />
					</span>
				</div>
			</nav>

			<Sheet open={notesOpen} onOpenChange={setNotesOpen}>
				<SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
					<SheetHeader className="border-b p-4"><SheetTitle>Notifications</SheetTitle></SheetHeader>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{!notes ? (
							<div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div>
						) : notes.length === 0 ? (
							<p className="p-8 text-center text-sm text-serene-neutral-500">Nothing new.</p>
						) : (
							<ul className="divide-y divide-serene-neutral-100">
								{notes.map((n) => {
									const inner = (
										<>
											<span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-sauti-teal")} />
											<span className="min-w-0 flex-1">
												<span className="block text-sm font-medium text-serene-neutral-900">{n.title}</span>
												{n.message && <span className="block text-sm text-serene-neutral-600">{n.message}</span>}
												<span className="mt-0.5 block text-xs text-serene-neutral-400">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
											</span>
										</>
									);
									const mark = async () => {
										if (n.read) return;
										await supabase.from("notifications").update({ read: true }).eq("id", n.id);
										setNotes((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
										setUnread((u) => Math.max(0, u - 1));
									};
									return (
										<li key={n.id}>
											{n.link ? (
												<Link href={n.link} onClick={() => { mark(); setNotesOpen(false); }} className="flex gap-3 p-4 hover:bg-serene-neutral-50">{inner}</Link>
											) : (
												<button onClick={mark} className="flex w-full gap-3 p-4 text-left hover:bg-serene-neutral-50">{inner}</button>
											)}
										</li>
									);
								})}
							</ul>
						)}
					</div>
					{notes && unread > 0 && (
						<div className="border-t p-3">
							<button
								onClick={async () => {
									await supabase.from("notifications").update({ read: true }).in("id", notes.filter((n) => !n.read).map((n) => n.id));
									setNotes(notes.map((n) => ({ ...n, read: true })));
									setUnread(0);
								}}
								className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-sauti-teal hover:bg-sauti-teal-light/40"
							>
								<Check className="h-4 w-4" /> Mark all as read
							</button>
						</div>
					)}
				</SheetContent>
			</Sheet>
		</TooltipProvider>
	);
}

function Item({ label, hint, href, onClick, busy, children }: { label: string; hint: string; href?: string; onClick?: () => void; busy?: boolean; children: React.ReactNode }) {
	const body = busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : children;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{href ? (
					<Link href={href} aria-label={label} className={BTN}>{body}</Link>
				) : (
					<button type="button" onClick={onClick} aria-label={label} className={BTN}>{body}</button>
				)}
			</TooltipTrigger>
			<TooltipContent side="right" sideOffset={10}>
				<p className="font-semibold">{label}</p>
				<p className="text-xs opacity-80">{hint}</p>
			</TooltipContent>
		</Tooltip>
	);
}
