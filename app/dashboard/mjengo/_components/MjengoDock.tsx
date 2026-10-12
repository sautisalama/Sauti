"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Calendar, GripVertical, Loader2, MessageCircle, Pin, PinOff, Video } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { cn } from "@/lib/utils";
import { createMeeting } from "@/app/actions/mjengo-meet";
import { useSuiteNotifications } from "@/lib/client/suite-notifications";

type Edge = "left" | "right" | "bottom";
interface Place { edge: Edge; at: number }

const KEY = "ss_mj_dock";
const BTN = "relative flex h-10 w-10 items-center justify-center rounded-xl text-[#37352f] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/50";

/**
 * Quick actions as a small floating handle you can drag to the left, right or bottom edge and tap to open:
 * chats, notifications, voice call, video call and calendar. It sits above the side navigation, so it is
 * always reachable, and the "Move" buttons do the same thing as dragging for keyboard users.
 */
export function MjengoDock() {
	const { toast } = useToast();
	const dash = useDashboardData();
	const [mounted, setMounted] = useState(false);
	const [small, setSmall] = useState(false);
	const [place, setPlace] = useState<Place>({ edge: "right", at: 0.55 });
	const [hover, setOpen] = useState(false);
	const [pinned, setPinned] = useState(false);
	const open = pinned || hover;
	const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
	const [starting, setStarting] = useState<"video" | null>(null);
	const { unread } = useSuiteNotifications();
	const moved = useRef(false);
	const origin = useRef({ x: 0, y: 0 });
	const sidebarW = mounted && dash?.isSidebarCollapsed ? 72 : 256;

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 1023px)");
		const on = () => setSmall(mq.matches);
		on();
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	useEffect(() => {
		setMounted(true);
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const p = JSON.parse(raw) as Place;
				if (["left", "right", "bottom"].includes(p.edge) && typeof p.at === "number") setPlace({ edge: p.edge, at: Math.min(0.95, Math.max(0.05, p.at)) });
			} else if (window.innerWidth < 1024) setPlace({ edge: "bottom", at: 0.85 });
			setPinned(localStorage.getItem("ss_mj_dock_pin") === "1");
		} catch { /* default */ }
	}, []);
	const togglePin = () => { const n = !pinned; setPinned(n); try { localStorage.setItem("ss_mj_dock_pin", n ? "1" : "0"); } catch { /* ignore */ } };
	const save = (p: Place) => { setPlace(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

	const onDown = (e: React.PointerEvent) => {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		origin.current = { x: e.clientX, y: e.clientY };
		moved.current = false;
		setDrag({ x: e.clientX, y: e.clientY });
	};
	const onMove = (e: React.PointerEvent) => {
		if (!drag) return;
		if (Math.abs(e.clientX - origin.current.x) + Math.abs(e.clientY - origin.current.y) > 6) moved.current = true;
		setDrag({ x: e.clientX, y: e.clientY });
	};
	const onUp = (e: React.PointerEvent) => {
		if (!drag) return;
		const w = window.innerWidth;
		const h = window.innerHeight;
		setDrag(null);
		if (!moved.current) { if (!pinned) setOpen((v) => !v); return; }
		const x = e.clientX;
		const y = e.clientY;
		const dl = x, dr = w - x, db = h - y;
		const edge: Edge = Math.min(dl, dr, db) === db ? "bottom" : dl <= dr ? "left" : "right";
		save({ edge, at: Math.min(0.95, Math.max(0.05, edge === "bottom" ? x / w : y / h)) });
	};

	const start = async (mode: "video") => {
		setStarting(mode);
		try {
			const { code } = await unwrap(createMeeting(mode, null));
			const url = `${window.location.origin}/meet/${code}`;
			navigator.clipboard?.writeText(url).catch(() => undefined);
			// The call is its own page (/meet/...), opened right here so an installed app does not pop up a new window.
			toast({ title: "Meeting ready", description: "The link is copied: send it to anyone you want in the call." });
			setOpen(false);
			window.location.assign(url);
		} catch (e) {
			toast({ title: "Could not start the call", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setStarting(null);
		}
	};

	const style = useMemo<React.CSSProperties>(() => {
		if (drag) return { left: drag.x - 22, top: drag.y - 22 };
		const lg = typeof window !== "undefined" && window.innerWidth >= 1024;
		if (place.edge === "bottom") return { left: `calc(${place.at * 100}% - 22px)`, bottom: 16 };
		if (place.edge === "left") return { left: (lg ? sidebarW : 0) + 12, top: `calc(${place.at * 100}% - 22px)` };
		return { right: 12, top: `calc(${place.at * 100}% - 22px)` };
	}, [drag, place, sidebarW]);

	const horizontal = place.edge === "bottom";
	const toLeft = place.edge === "right";
	const side: "left" | "right" | "top" = horizontal ? "top" : toLeft ? "left" : "right";

	const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const expand = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = null; setOpen(true); };
	const collapse = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setOpen(false), 220); };

	if (!mounted) return null;
	if (small) return <EdgeSheet unread={unread} onMeeting={() => start("video")} starting={starting === "video"} />;
	return (
		<TooltipProvider delayDuration={150}>
			{/* Hover (or tap the handle) to expand; move away to collapse. Drag the handle to put it on another edge. */}
			<div
				style={style}
				onPointerEnter={(e) => { if (e.pointerType === "mouse" && !drag) expand(); }}
				onPointerLeave={(e) => { if (e.pointerType === "mouse") collapse(); }}
				onFocus={expand}
				onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) collapse(); }}
				className={cn("fixed z-[55] flex items-stretch rounded-2xl border border-black/10 bg-white shadow-[0_6px_24px_rgba(0,0,0,0.14)]", horizontal ? "flex-row" : "flex-col", drag && "select-none")}
			>
				<button
					type="button"
					onPointerDown={onDown}
					onPointerMove={onMove}
					onPointerUp={onUp}
					onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } if (e.key === "Escape") setOpen(false); }}
					aria-label="Quick actions. Drag to move."
					aria-expanded={open}
					className="relative flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-2xl text-[#787774] transition active:cursor-grabbing hover:text-[#37352f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/50"
				>
					<GripVertical className="h-5 w-5" />
					{!open && unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sauti-teal px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
				</button>

				<div role="toolbar" aria-label="Quick actions" className={cn("flex gap-0.5 overflow-hidden transition-all duration-200", horizontal ? "flex-row items-center" : "flex-col items-center", open ? (horizontal ? "max-w-[320px] px-1 opacity-100" : "max-h-[280px] pb-1 opacity-100") : (horizontal ? "max-w-0 opacity-0" : "max-h-0 opacity-0"))}>
					<Item label={pinned ? "Unpin" : "Pin open"} hint={pinned ? "Let it collapse when you move away" : "Keep it open while you work"} onClick={togglePin} side={side}>{pinned ? <PinOff className="h-[18px] w-[18px] text-sauti-teal" /> : <Pin className="h-[18px] w-[18px]" />}</Item>
					<Item label="Chats" hint="Conversations in the suite" href="/dashboard/mjengo/chat" side={side}><MessageCircle className="h-[18px] w-[18px]" /></Item>
					<Item label="Notifications" hint="What needs your attention" href="/dashboard/mjengo/notifications" side={side}>
						<Bell className="h-[18px] w-[18px]" />
						{unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sauti-teal px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
					</Item>
					<Item label="Meeting" hint="Start a meeting; turn the camera off for audio only" onClick={() => start("video")} busy={starting === "video"} side={side}><Video className="h-[18px] w-[18px]" /></Item>
					<Item label="Calendar" hint="Month view, events and meetings" href="/dashboard/mjengo/calendar" side={side}><Calendar className="h-[18px] w-[18px]" /></Item>
				</div>
			</div>
		</TooltipProvider>
	);
}

function Item({ label, hint, href, onClick, busy, side, children }: { label: string; hint: string; href?: string; onClick?: () => void; busy?: boolean; side: "left" | "right" | "top"; children: React.ReactNode }) {
	const body = busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : children;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{href ? <Link href={href} aria-label={label} className={BTN}>{body}</Link> : <button type="button" onClick={onClick} aria-label={label} className={BTN}>{body}</button>}
			</TooltipTrigger>
			<TooltipContent side={side} sideOffset={10}><p className="font-semibold">{label}</p><p className="text-xs opacity-80">{hint}</p></TooltipContent>
		</Tooltip>
	);
}

/**
 * On phones the quick actions live off the right edge: swipe in from the right to pull them out, swipe
 * back (or tap outside) to put them away. The thin tab on the edge shows where to swipe and works as a tap.
 */
function EdgeSheet({ unread, onMeeting, starting }: { unread: number; onMeeting: () => void; starting: boolean }) {
	const [open, setOpen] = useState(false);
	const [dx, setDx] = useState(0);
	const from = useRef<{ x: number; y: number; open: boolean } | null>(null);
	const W = 224;

	const down = (e: React.TouchEvent) => {
		const t = e.touches[0];
		from.current = { x: t.clientX, y: t.clientY, open };
	};
	const move = (e: React.TouchEvent) => {
		const f = from.current;
		if (!f) return;
		const t = e.touches[0];
		const mx = t.clientX - f.x;
		if (Math.abs(t.clientY - f.y) > Math.abs(mx) + 10) { from.current = null; setDx(0); return; }
		setDx(f.open ? Math.max(0, Math.min(W, mx)) : Math.min(0, Math.max(-W, mx)));
	};
	const up = () => {
		const f = from.current;
		from.current = null;
		if (f) {
			if (!f.open && dx < -48) setOpen(true);
			else if (f.open && dx > 48) setOpen(false);
		}
		setDx(0);
	};

	const dragging = from.current !== null && dx !== 0;
	const offset = open ? dx : W + dx;
	const items: { label: string; href?: string; run?: () => void; icon: React.ReactNode; badge?: number }[] = [
		{ label: "Chats", href: "/dashboard/mjengo/chat", icon: <MessageCircle className="h-5 w-5" /> },
		{ label: "Notifications", href: "/dashboard/mjengo/notifications", icon: <Bell className="h-5 w-5" />, badge: unread },
		{ label: "Start a meeting", run: onMeeting, icon: starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" /> },
		{ label: "Calendar", href: "/dashboard/mjengo/calendar", icon: <Calendar className="h-5 w-5" /> },
	];

	return (
		<>
			{/* The swipe zone on the right edge, and the tab that shows it. */}
			{!open && (
				<div onTouchStart={down} onTouchMove={move} onTouchEnd={up} className="fixed bottom-24 right-0 top-24 z-[54] w-6 touch-pan-y">
					<button onClick={() => setOpen(true)} aria-label="Open quick actions" className="absolute right-0 top-1/2 flex h-14 w-3 -translate-y-1/2 items-center justify-center rounded-l-full bg-black/25 active:bg-black/40">
						{unread > 0 && <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-sauti-teal" />}
					</button>
				</div>
			)}
			{(open || dx !== 0) && <div onClick={() => setOpen(false)} className="fixed inset-0 z-[55] bg-black/30" style={{ opacity: open ? 1 - Math.min(1, dx / W) : Math.min(1, -dx / W) }} aria-hidden />}
			<aside
				aria-label="Quick actions"
				onTouchStart={down}
				onTouchMove={move}
				onTouchEnd={up}
				className="fixed bottom-0 right-0 top-0 z-[56] flex w-56 flex-col bg-white pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
				style={{ transform: `translateX(${open || dx !== 0 ? offset : W}px)`, transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0, 0, 1)", visibility: open || dx !== 0 ? "visible" : "hidden" }}
			>
				<p className="px-5 pb-2 text-xs font-semibold uppercase tracking-widest text-[#9b9a97]">Quick actions</p>
				<ul className="space-y-0.5 px-2">
					{items.map((it) => {
						const inner = (
							<>
								<span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f7f5] text-[#37352f]">
									{it.icon}
									{!!it.badge && <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sauti-teal px-1 text-[10px] font-bold text-white">{it.badge > 9 ? "9+" : it.badge}</span>}
								</span>
								<span className="text-[15px] font-medium text-[#37352f]">{it.label}</span>
							</>
						);
						return (
							<li key={it.label}>
								{it.href ? (
									<Link href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 active:bg-black/5">{inner}</Link>
								) : (
									<button onClick={() => { setOpen(false); it.run?.(); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left active:bg-black/5">{inner}</button>
								)}
							</li>
						);
					})}
				</ul>
			</aside>
		</>
	);
}
