"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SereneReportCard } from "@/app/dashboard/_components/SurvivorDashboardComponents";
import { ReportCardSkeleton } from "@/components/reports/ReportCardSkeleton";
import {
	CalendarDays,
	User,
	Phone,
	Mail,
	Clock,
	FileText,
	ChevronRight,
	Paperclip,
	Shield,
	X,
	ChevronLeft,
	Mic,
	Play,
	Pause,
	Filter,
	Search,
	MessageCircle,
	Calendar,
	Plus,
	CheckSquare,
	Trash2,
	PenLine
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import RichTextNotesEditor from "./rich-text-notes-editor";
import { useToast } from "@/hooks/use-toast";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarConnectionStatus } from "../_components/CalendarConnectionStatus";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { FloatingChatManager, FloatingChat } from "@/components/chat/FloatingChatManager";

interface AppointmentLite {
	id: string;
	appointment_id: string;
	appointment_date: string;
	status: string;
	professional?: {
		id: string;
		first_name?: string | null;
		last_name?: string | null;
		email?: string | null;
	} | null;
}

interface ReportItem extends Tables<"reports"> {
	matched_services?: Array<{
		id: string;
		chat_id?: string | null;
		match_status_type: any;
		support_services: {
			id: string;
			name: string;
			phone_number?: string | null;
			email?: string | null;
		};
		appointments?: AppointmentLite[];
	}>;
}

/** Inline Accountability Tracker for the sidepanel */
function SidepanelChecklist({
	report,
	supabase,
	onUpdate,
}: {
	report: ReportItem;
	supabase: any;
	onUpdate: (updated: ReportItem) => void;
}) {
	const admin = (report as any)?.administrative || {};
	// Support both 'checklist' (singular) and legacy 'checklists' (plural) keys
	const rawChecklist = admin.checklist || admin.checklists || [];
	// Normalize: accept both 'done' and 'completed' fields
	const initialChecklist = rawChecklist.map((c: any) => ({ ...c, done: c.done ?? c.completed ?? false }));
	const [checklist, setChecklist] = useState<Array<{ id: string; title: string; done: boolean; notes: string }>>(initialChecklist);
	const [newItem, setNewItem] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	// Sync from external changes
	useEffect(() => {
		const admin = (report as any)?.administrative || {};
		// Support both keys
		const raw = admin.checklist || admin.checklists || [];
		setChecklist(raw.map((c: any) => ({ ...c, done: c.done ?? c.completed ?? false })));
	}, [report.report_id, (report as any)?.administrative?.checklist?.length, (report as any)?.administrative?.checklists?.length]);

	const persistChecklist = useCallback(async (items: typeof checklist) => {
		const newAdmin = { ...((report as any)?.administrative || {}), checklist: items };
		// Remove legacy plural key if present
		delete (newAdmin as any).checklists;
		const { data } = await supabase
			.from("reports")
			.update({ administrative: newAdmin })
			.eq("report_id", report.report_id)
			.select()
			.single();
		if (data) onUpdate(data as any);
	}, [report, supabase, onUpdate]);

	const toggleItem = (id: string) => {
		const next = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i);
		setChecklist(next);
		void persistChecklist(next);
	};

	const addItem = () => {
		if (!newItem.trim()) return;
		const next = [...checklist, { id: crypto.randomUUID(), title: newItem.trim(), done: false, notes: "" }];
		setChecklist(next);
		setNewItem("");
		void persistChecklist(next);
	};

	const deleteItem = (id: string) => {
		const next = checklist.filter(i => i.id !== id);
		setChecklist(next);
		void persistChecklist(next);
	};

	const startEdit = (id: string, title: string) => {
		setEditingId(id);
		setEditTitle(title);
	};

	const commitEdit = (id: string) => {
		if (!editTitle.trim()) { setEditingId(null); return; }
		const next = checklist.map(i => i.id === id ? { ...i, title: editTitle.trim() } : i);
		setChecklist(next);
		setEditingId(null);
		void persistChecklist(next);
	};

	const updateNotes = (id: string, notes: string) => {
		const next = checklist.map(i => i.id === id ? { ...i, notes } : i);
		setChecklist(next);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => void persistChecklist(next), 1500);
	};

	useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

	return (
		<div className="space-y-3">
			{checklist.length === 0 && (
				<p className="text-xs text-serene-neutral-400 text-center py-3">No items yet. Add your first accountability step.</p>
			)}
			{checklist.map((item, index) => {
				const isEditing = editingId === item.id;
				return (
				<div key={item.id} className={cn("group relative rounded-lg border p-3 transition-all", isEditing ? "border-sauti-teal/30 bg-white shadow-sm" : "border-serene-neutral-100 bg-serene-neutral-50/50 hover:bg-white")}>
					<div className="flex items-start gap-3">
						<Checkbox
							checked={item.done}
							onCheckedChange={() => toggleItem(item.id)}
							className="mt-0.5 border-serene-neutral-300 data-[state=checked]:bg-sauti-teal data-[state=checked]:border-sauti-teal"
						/>
						<div className="flex-1 min-w-0" onClick={() => !isEditing && startEdit(item.id, item.title)}>
							{isEditing ? (
								<div className="space-y-2">
									<Input
										value={editTitle}
										onChange={(e) => setEditTitle(e.target.value)}
										onBlur={() => commitEdit(item.id)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') commitEdit(item.id);
											if (e.key === 'Escape') setEditingId(null);
											if (e.key === 'ArrowUp') {
												e.preventDefault();
												commitEdit(item.id);
												if (index > 0) {
													const prev = checklist[index - 1];
													setTimeout(() => startEdit(prev.id, prev.title), 0);
												}
											}
											if (e.key === 'ArrowDown') {
												e.preventDefault();
												commitEdit(item.id);
												if (index < checklist.length - 1) {
													const next = checklist[index + 1];
													setTimeout(() => startEdit(next.id, next.title), 0);
												}
											}
										}}
										className="h-7 text-sm border-sauti-teal/30 bg-white"
										placeholder="Item title..."
										autoFocus
									/>
									<Textarea
										value={item.notes || ""}
										onChange={(e) => updateNotes(item.id, e.target.value)}
										placeholder="Add notes... (Click outside to save)"
										className="grid w-full min-h-[60px] text-xs resize-none border-serene-neutral-200 bg-white focus:ring-sauti-teal/20"
										onKeyDown={(e) => {
											if (e.key === 'Escape') setEditingId(null);
											if (e.key === 'ArrowUp') {
												// Only navigate if cursor is at the beginning of the textarea
												if (e.currentTarget.selectionStart === 0) {
													e.preventDefault();
													commitEdit(item.id);
													if (index > 0) {
														const prev = checklist[index - 1];
														setTimeout(() => startEdit(prev.id, prev.title), 0);
													}
												}
											}
											if (e.key === 'ArrowDown') {
												// Only navigate if cursor is at the end of the textarea
												if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
													e.preventDefault();
													commitEdit(item.id);
													if (index < checklist.length - 1) {
														const next = checklist[index + 1];
														setTimeout(() => startEdit(next.id, next.title), 0);
													}
												}
											}
										}}
									/>
								</div>
							) : (
								<div className="cursor-pointer">
									<p
										className={cn("text-sm font-medium", item.done ? "line-through text-serene-neutral-400" : "text-sauti-dark")}
									>
										{item.title}
									</p>
									{item.notes && (
										<p className="mt-1 text-xs text-serene-neutral-500 line-clamp-1">
											{item.notes}
										</p>
									)}
								</div>
							)}
						</div>
						<button
							onClick={() => deleteItem(item.id)}
							className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 hover:text-rose-500 text-serene-neutral-300 transition-all ml-1"
							title="Delete item"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			)})}
			<div className="flex items-center gap-2">
				<Input
					value={newItem}
					onChange={(e) => setNewItem(e.target.value)}
					placeholder="Add new item..."
					className="h-8 text-sm border-serene-neutral-200 bg-white flex-1"
					onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
				/>
				<Button size="icon" onClick={addItem} disabled={!newItem.trim()} className="h-8 w-8 shrink-0 bg-sauti-teal hover:bg-sauti-teal/90 rounded-lg text-white">
					<Plus className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	);
}

export default function ReportsMasterDetail({ userId }: { userId: string }) {
	const { toast } = useToast();
	const dash = useDashboardData();
	const router = useRouter();
	const seededFromProviderRef = useRef(false);
	const supabase = useMemo(() => createClient(), []);
	const [reports, setReports] = useState<ReportItem[]>([]);
	const [q, setQ] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [showProfile, setShowProfile] = useState(false);
	const [loading, setLoading] = useState(true);
	// Mobile view toggle between list and calendar
	const [mobileView, setMobileView] = useState<"list" | "calendar">("list");
	// Filters
	const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [onBehalfFilter, setOnBehalfFilter] = useState<string>("all");
	const [showFilters, setShowFilters] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editDescription, setEditDescription] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

	// Floating chats (LinkedIn-style)
	const [floatingChats, setFloatingChats] = useState<FloatingChat[]>([]);

	const openFloatingChat = useCallback((report: ReportItem) => {
		const match = report.matched_services?.[0];
		if (!match) return;
		// Avoid duplicate
		if (floatingChats.find(c => c.matchId === match.id)) return;
		setFloatingChats(prev => [...prev, {
			id: match.id,
			matchId: match.id,
			survivorId: userId,
			professionalId: match.appointments?.[0]?.professional?.id || "",
			professionalName: match.support_services?.name || "Support Professional",
			survivorName: "You",
		}]);
	}, [floatingChats, userId]);

	const closeFloatingChat = useCallback((id: string) => {
		setFloatingChats(prev => prev.filter(c => c.id !== id));
	}, []);

	// Calendar State
	const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
	const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());

	const needsOnboarding = useMemo(() => {
		const profile = dash?.data?.profile;
		if (!profile) return false;
		const hasAcceptedPolicies = !!(profile.policies as any)?.all_policies_accepted;
		return !profile.user_type || 
			!hasAcceptedPolicies ||
			((profile.user_type === 'professional' || profile.user_type === 'ngo') && !profile.professional_title);
	}, [dash?.data?.profile]);

	// Calendar Helpers
	const getWeekDays = (baseDate: Date) => {
		const start = new Date(baseDate);
		start.setDate(start.getDate() - start.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const day = new Date(start);
			day.setDate(start.getDate() + i);
			return day;
		});
	};

	const getMonthDays = (baseDate: Date) => {
		const year = baseDate.getFullYear();
		const month = baseDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = firstDay.getDay();
		const totalDays = lastDay.getDate();
		const weeks = Math.ceil((startPadding + totalDays) / 7);
		const days: { date: Date; isCurrentMonth: boolean }[] = [];
		
		for (let i = 0; i < weeks * 7; i++) {
			const day = new Date(year, month, 1 - startPadding + i);
			days.push({
				date: day,
				isCurrentMonth: day.getMonth() === month
			});
		}
		return days;
	};

	const weekDays = useMemo(() => getWeekDays(calendarSelectedDate), [calendarSelectedDate]);
	const monthDays = useMemo(() => getMonthDays(calendarSelectedDate), [calendarSelectedDate]);

	const getAllAppointments = (reportsData: ReportItem[]) => {
		const all: any[] = [];
		reportsData.forEach(r => {
			 r.matched_services?.forEach(m => {
				 m.appointments?.forEach(a => {
					 all.push({ ...a, report: r, matched_service: m });
				 });
			 });
		});
		return all;
	};

	const getAppointmentsForDay = (date: Date, items: ReportItem[]) => {
		const all = getAllAppointments(items);
		return all.filter(a =>
			a.appointment_date && new Date(a.appointment_date).toDateString() === date.toDateString()
		);
	};

	useEffect(() => {
		// Prefer provider snapshot when available (no spinner)
		try {
			if (
				dash?.data &&
				dash.data.userId === userId &&
				!seededFromProviderRef.current
			) {
				const normalized = (dash.data.reports as any[])?.map((r: any) => ({
					...r,
					matched_services:
						r.matched_services?.map((m: any) => ({
							...m,
							support_services: m.support_service || m.support_services || null,
						})) || [],
				}));
				setReports(normalized || []);
				setLoading(false);
				seededFromProviderRef.current = true;
			}
		} catch {}

		// Try to hydrate from cache if not seeded
		if (!seededFromProviderRef.current) {
			try {
				const cached = localStorage.getItem(`reports-cache-${userId}`);
				if (cached) {
					const parsed = JSON.parse(cached);
					if (Array.isArray(parsed)) {
						setReports(parsed as any);
						setLoading(false);
					}
				}
			} catch {
				// Ignore localStorage errors
			}
		}

		const load = async () => {
			if (seededFromProviderRef.current) return; // skip network when seeded
			setLoading(true);
			try {
				const { data, error } = await supabase
					.from("reports")
					.select(
						`
							*,
							matched_services (
								id,
								match_status_type,
								service_details:support_services (
									id,
									name,
									phone_number,
									email
								),
								hrd_details:profiles!matched_services_hrd_profile_id_fkey (
									id,
									first_name,
									last_name,
									email,
									phone
								),
								appointments (
									id,
									appointment_id,
									appointment_date,
									status,
									professional:profiles!appointments_professional_id_fkey (
										id,
										first_name,
										last_name,
										email
									)
								)
							)
						`
					)
					.eq("user_id", userId)
					.order("submission_timestamp", { ascending: false });
				if (error) throw error;
				const normalized = (data as any)?.map((r: any) => ({
					...r,
					matched_services:
						r.matched_services?.map((m: any) => ({
							...m,
							support_services: m.service_details || m.support_services || (m.hrd_details ? {
								id: m.hrd_details.id,
								name: `${m.hrd_details.first_name || ''} ${m.hrd_details.last_name || ''}`.trim() || 'HRD',
								phone_number: m.hrd_details.phone,
								email: m.hrd_details.email
							} : null),
						})) || [],
				}));
				setReports(normalized || []);
				try {
					localStorage.setItem(
						`reports-cache-${userId}`,
						JSON.stringify(normalized || [])
					);
				} catch {
					// Ignore localStorage errors
				}
			} catch (e: any) {
				// Fallback: minimal query if nested fails
				console.error("Failed to fetch reports, retrying minimal:", e);
				const { data: minimal } = await supabase
					.from("reports")
					.select("*")
					.eq("user_id", userId)
					.order("submission_timestamp", { ascending: false });
				setReports((minimal as any) || []);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [userId, supabase, dash?.data]);

	useEffect(() => {
		const channel = supabase
			.channel(`realtime_reports_master_${userId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'reports', filter: `user_id=eq.${userId}` },
				async (payload) => {
					const targetId = payload.new ? (payload.new as any).report_id : (payload.old as any).report_id;
					if (!targetId) return;
					refreshReport(targetId);
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'matched_services' },
				async (payload) => {
					const reportId = (payload.new as any)?.report_id || (payload.old as any)?.report_id;
					if (reportId) refreshReport(reportId);
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'appointments' },
				async (payload) => {
					const matchedServiceId = (payload.new as any)?.matched_services || (payload.old as any)?.matched_services;
					if (matchedServiceId) {
						// Find which report this matched service belongs to
						const report = reports.find(r => r.matched_services?.some(m => m.id === matchedServiceId));
						if (report) refreshReport(report.report_id);
					}
				}
			)
			.subscribe();

		const refreshReport = async (targetId: string) => {
			const { data } = await supabase
				.from('reports')
				.select(`
					*,
					matched_services (
						id,
						match_status_type,
						service_details:support_services (
							id,
							name,
							phone_number,
							email
						),
						hrd_details:profiles!matched_services_hrd_profile_id_fkey (
							id,
							first_name,
							last_name,
							email,
							phone
						),
						appointments (
							id,
							appointment_id,
							appointment_date,
							status,
							professional:profiles!appointments_professional_id_fkey (
								id,
								first_name,
								last_name,
								email
							)
						)
					)
				`)
				.eq('report_id', targetId)
				.maybeSingle();

			if (data) {
				const normalized = {
					...data,
					matched_services:
						data.matched_services?.map((m: any) => ({
							...m,
							support_services: m.service_details || m.support_services || (m.hrd_details ? {
								id: m.hrd_details.id,
								name: `${m.hrd_details.first_name || ''} ${m.hrd_details.last_name || ''}`.trim() || 'HRD',
								phone_number: m.hrd_details.phone,
								email: m.hrd_details.email
							} : null),
						})) || [],
				};

				setReports((prev) => {
					const exists = prev.some(r => r.report_id === normalized.report_id);
					if (exists) {
						return prev.map(r => r.report_id === normalized.report_id ? (normalized as any) : r);
					} else {
						return [normalized as any, ...prev].sort((a, b) => 
							new Date(b.submission_timestamp || 0).getTime() - new Date(a.submission_timestamp || 0).getTime()
						);
					}
				});
			}
		};

		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, supabase, reports]);

	const filtered = useMemo(() => {
		let filteredReports = reports.filter(r => {
            const admin = (r as any)?.administrative || {};
            const isArchived = !!admin.is_archived;
            return showArchived ? isArchived : !isArchived;
        });

		// Text search filter
		const term = q.trim().toLowerCase();
		if (term) {
			filteredReports = filteredReports.filter(
				(r) =>
					(r.type_of_incident || "").toLowerCase().includes(term) ||
					(r.incident_description || "").toLowerCase().includes(term) ||
					(r.urgency || "").toLowerCase().includes(term)
			);
		}

		// Urgency filter
		if (urgencyFilter !== "all") {
			filteredReports = filteredReports.filter(
				(r) => (r.urgency || "low").toLowerCase() === urgencyFilter
			);
		}

		// Status filter (based on match status)
		if (statusFilter !== "all") {
			filteredReports = filteredReports.filter((r) => {
				if (statusFilter === "matched") {
					return r.matched_services?.some(m => 
						["matched", "confirmed", "accepted", "completed"].includes((m.match_status_type || "").toLowerCase())
					);
				} else if (statusFilter === "pending") {
					return !r.matched_services || r.matched_services.length === 0 || r.matched_services.every(m => (m.match_status_type || "").toLowerCase() === "pending");
				} else if (statusFilter === "appointment") {
					return r.matched_services?.some(
						(m) => m.appointments && m.appointments.length > 0
					);
				}
				return true;
			});
		}

		// On behalf filter
		if (onBehalfFilter !== "all") {
			const isOnBehalf = onBehalfFilter === "yes";
			filteredReports = filteredReports.filter(
				(r) => !!r.is_onBehalf === isOnBehalf
			);
		}

		return filteredReports;
	}, [reports, q, urgencyFilter, statusFilter, onBehalfFilter]);

	const selected = useMemo(
		() => filtered.find((r) => r.report_id === selectedId) || null,
		[filtered, selectedId]
	);

	const urgencyColor = (u?: string | null) =>
		u === "high"
			? "bg-red-100 text-red-700"
			: u === "medium"
			? "bg-yellow-100 text-yellow-700"
			: "bg-blue-100 text-blue-700";

	const formatDate = (d?: string | null) =>
		d ? new Date(d).toLocaleString() : "";

	// Enhanced Audio Player Component with seek controls
	const AudioPlayer = ({ src, type }: { src: string; type?: string }) => {
		const [isPlaying, setIsPlaying] = useState(false);
		const [duration, setDuration] = useState(0);
		const [currentTime, setCurrentTime] = useState(0);
		const [isSeeking, setIsSeeking] = useState(false);
		const audioRef = useRef<HTMLAudioElement>(null);

		useEffect(() => {
			const audio = audioRef.current;
			if (!audio) return;

			const updateTime = () => {
				if (!isSeeking) {
					setCurrentTime(audio.currentTime);
				}
			};
			const updateDuration = () => setDuration(audio.duration);
			const handleEnded = () => setIsPlaying(false);

			audio.addEventListener("timeupdate", updateTime);
			audio.addEventListener("loadedmetadata", updateDuration);
			audio.addEventListener("ended", handleEnded);

			return () => {
				audio.removeEventListener("timeupdate", updateTime);
				audio.removeEventListener("loadedmetadata", updateDuration);
				audio.removeEventListener("ended", handleEnded);
			};
		}, [isSeeking]);

		const togglePlayback = () => {
			const audio = audioRef.current;
			if (!audio) return;

			if (isPlaying) {
				audio.pause();
				setIsPlaying(false);
			} else {
				audio.play();
				setIsPlaying(true);
			}
		};

		const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
			const audio = audioRef.current;
			if (!audio) return;

			const newTime = parseFloat(e.target.value);
			setCurrentTime(newTime);
			audio.currentTime = newTime;
		};

		const handleSeekStart = () => setIsSeeking(true);
		const handleSeekEnd = () => setIsSeeking(false);

		const formatTime = (seconds: number) => {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins}:${secs.toString().padStart(2, "0")}`;
		};

		return (
			<div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-sauti-teal" />
							<span className="text-sm font-medium text-sauti-dark">
								Voice Recording
							</span>
						</div>
						<span className="text-sm text-gray-500 font-mono">
							{formatTime(currentTime)} / {formatTime(duration)}
						</span>
					</div>

					{/* Progress bar */}
					<div className="space-y-1">
						<input
							type="range"
							min="0"
							max={duration || 0}
							value={currentTime}
							onChange={handleSeek}
							onMouseDown={handleSeekStart}
							onMouseUp={handleSeekEnd}
							onTouchStart={handleSeekStart}
							onTouchEnd={handleSeekEnd}
							className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
							style={{
								background: `linear-gradient(to right, #1A3434 0%, #1A3434 ${
									(currentTime / duration) * 100
								}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`,
							}}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={togglePlayback}
							className="flex-1"
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 mr-1" />
							) : (
								<Play className="w-4 h-4 mr-1" />
							)}
							{isPlaying ? "Pause" : "Play"} Recording
						</Button>
					</div>

					<audio ref={audioRef} src={src} className="hidden" />
				</div>
			</div>
		);
	};

	// Compute appointment dates to mark on calendar
	const appointmentDates = useMemo(() => {
		const set = new Set<string>();
		for (const r of reports) {
			for (const m of r.matched_services || []) {
				for (const a of m.appointments || []) {
					if (a.appointment_date)
						set.add(new Date(a.appointment_date).toDateString());
				}
			}
		}
		return set;
	}, [reports]);

	const isDateBooked = (date: Date) => appointmentDates.has(date.toDateString());

	// Lock body overflow when panel is open to prevent horizontal scroll bleed
	useEffect(() => {
		if (typeof document === "undefined") return;
		const html = document.documentElement;
		const body = document.body as HTMLBodyElement | null;
		if (selected) {
			html.style.overflowX = "hidden";
			if (body) body.style.overflowX = "hidden";
		} else {
			html.style.overflowX = "";
			if (body) body.style.overflowX = "";
		}
		return () => {
			html.style.overflowX = "";
			if (body) (body as any).style.overflowX = "";
		};
	}, [selected]);

	// Close on ESC
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selected) setSelectedId(null);
		};
		if (selected) window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selected]);

	// Touch handlers for mobile swipe-down to close
	const [dragStartY, setDragStartY] = useState<number | null>(null);
	const [dragY, setDragY] = useState(0);
	const onTouchStart = (e: React.TouchEvent) => {
		if (!selected) return;
		setDragStartY(e.touches[0].clientY);
		setDragY(0);
	};
	const onTouchMove = (e: React.TouchEvent) => {
		if (dragStartY == null) return;
		const dy = e.touches[0].clientY - dragStartY;
		if (dy > 0) setDragY(dy);
	};
	const onTouchEnd = () => {
		if (dragY > 80) {
			setSelectedId(null);
		}
		setDragStartY(null);
		setDragY(0);
	};

	return (
		<>
		<div className="relative min-h-screen bg-serene-neutral-50">
				<div className="min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-8 lg:h-[calc(100vh-120px)]">
				{/* Mobile toggle */}
				<div className="lg:hidden px-1 shrink-0">
					<div className="inline-flex rounded-2xl border border-serene-neutral-200 bg-white/80 backdrop-blur-sm p-1 shadow-sm">
						<button
							onClick={() => setMobileView("list")}
							className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
								mobileView === "list"
									? "bg-sauti-teal text-white shadow-md"
									: "text-serene-neutral-600 hover:text-sauti-dark hover:bg-serene-neutral-50"
							}`}
						>
							Reports
						</button>
						<button
							onClick={() => setMobileView("calendar")}
							className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
								mobileView === "calendar"
									? "bg-sauti-teal text-white shadow-md"
									: "text-serene-neutral-600 hover:text-sauti-dark hover:bg-serene-neutral-50"
							}`}
						>
							<Calendar className="h-4 w-4 mr-1.5 inline" />
							Calendar
						</button>
					</div>
				</div>

				<div className="mt-8 pt-6 pb-4 text-center border-t border-serene-neutral-100/50">
					<button 
						onClick={() => setShowArchived(!showArchived)}
						className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest hover:text-sauti-teal transition-colors"
					>
						{showArchived ? "← Return to active reports" : "View archived reports"}
					</button>
				</div>

			{/* Main Detail Side */}
				<div
					className={`flex-1 lg:flex-[7] xl:flex-[7] min-w-0 h-full overflow-y-auto overflow-x-hidden pr-2 pb-8 scroll-smooth ${
						mobileView !== "list" ? "hidden lg:block" : ""
					}`}
				>
					<div className="mb-6 sm:mb-8">
						<SereneBreadcrumb items={[{ label: "Reports", active: true }]} className="mb-4" />
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-sauti-dark tracking-tight uppercase">My Reports</h1>
								<p className="text-serene-neutral-500 mt-1 text-xs sm:text-sm lg:text-base font-medium">View your reports and check their status.</p>
							</div>
							{!needsOnboarding && (
								<Button 
									onClick={() => dash?.setIsReportDialogOpen(true)}
									className="bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl sm:rounded-2xl px-6 font-bold shadow-lg shadow-serene-blue-100 transition-all hover:scale-[1.02] h-10 sm:h-11 text-xs sm:text-sm w-full sm:w-auto"
								>
									<Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
									Report Abuse
								</Button>
							)}
						</div>
					</div>
					{/* Premium Search and Filter Bar */}
					<div className="mb-6 sticky top-0 z-30 bg-serene-neutral-50/95 backdrop-blur-lg border-b border-serene-neutral-100 pb-3 pt-2 -mx-1 px-1">
						<div className="flex items-center gap-2 sm:gap-3">
							{/* Search Bar */}
							<div className="relative flex-1 min-w-0">
								<Input
									placeholder="Search reports..."
									value={q}
									onChange={(e) => setQ(e.target.value)}
									className="pl-9 sm:pl-11 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm border-serene-neutral-200 rounded-xl sm:rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-sauti-teal/20 focus:border-sauti-teal transition-all placeholder:text-serene-neutral-400 h-9 sm:h-11"
								/>
								<Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-serene-neutral-400" />
							</div>

							{/* Filter Toggle Button */}
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowFilters(!showFilters)}
								className={`h-9 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border-serene-neutral-200 hover:bg-white hover:border-sauti-teal/30 shadow-sm transition-all font-bold text-[10px] sm:text-xs shrink-0 ${
									urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all"
										? "bg-sauti-teal/10 text-sauti-teal border-sauti-teal/30"
										: "bg-white text-serene-neutral-600"
								}`}
							>
								<Filter className="h-3.5 sm:h-4 w-3.5 sm:w-4 sm:mr-1.5" />
								<span className="hidden sm:inline">Filters</span>
								{(urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all") && (
									<span className="ml-1.5 h-1.5 w-1.5 bg-sauti-teal rounded-full animate-pulse"></span>
								)}
							</Button>
						</div>

						{/* Collapsible Filter Panel */}
						{showFilters && (
							<div className="mt-2 p-3 bg-white rounded-xl border border-serene-neutral-100 shadow-xl shadow-slate-200/50">
								<div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
									{/* Urgency Filter */}
									<div className="flex flex-col gap-1">
										<label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Urgency</label>
										<select
											value={urgencyFilter}
											onChange={(e) => setUrgencyFilter(e.target.value)}
											className="px-2.5 py-1.5 text-xs border border-serene-neutral-100 rounded-lg bg-slate-50 focus:ring-2 focus:ring-sauti-teal/20 focus:border-sauti-teal outline-none font-bold text-slate-700"
										>
											<option value="all">All Levels</option>
											<option value="high">High</option>
											<option value="medium">Medium</option>
											<option value="low">Low</option>
										</select>
									</div>

									{/* Status Filter */}
									<div className="flex flex-col gap-1">
										<label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Status</label>
										<select
											value={statusFilter}
											onChange={(e) => setStatusFilter(e.target.value)}
											className="px-2.5 py-1.5 text-xs border border-serene-neutral-100 rounded-lg bg-slate-50 focus:ring-2 focus:ring-sauti-teal/20 focus:border-sauti-teal outline-none font-bold text-slate-700"
										>
											<option value="all">All Status</option>
											<option value="pending">Pending</option>
											<option value="matched">Matched</option>
											<option value="appointment">With Sessions</option>
										</select>
									</div>

									{/* On Behalf Filter */}
									<div className="flex flex-col gap-1 col-span-2 xs:col-span-1">
										<label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Type</label>
										<select
											value={onBehalfFilter}
											onChange={(e) => setOnBehalfFilter(e.target.value)}
											className="px-2.5 py-1.5 text-xs border border-serene-neutral-100 rounded-lg bg-slate-50 focus:ring-2 focus:ring-sauti-teal/20 focus:border-sauti-teal outline-none font-bold text-slate-700"
										>
											<option value="all">All Types</option>
											<option value="yes">On Behalf</option>
											<option value="no">Personal</option>
										</select>
									</div>
								</div>

									{/* Clear Filters */}
									{(urgencyFilter !== "all" ||
										statusFilter !== "all" ||
										onBehalfFilter !== "all") && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setUrgencyFilter("all");
												setStatusFilter("all");
												setOnBehalfFilter("all");
											}}
											className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 self-end sm:self-center"
										>
											Clear all
										</Button>
									)}
							</div>
						)}
					</div>

					{/* Reports list */}
					<div className="space-y-4">
						{loading ? (
							// Show skeleton loading
							<>
								{Array.from({ length: 3 }).map((_, i) => (
									<ReportCardSkeleton key={i} />
								))}
							</>
						) : filtered.length === 0 ? (
							<div className="text-center py-24 px-6">
								<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sauti-teal/10 to-serene-blue-100 flex items-center justify-center shadow-sm">
									<FileText className="h-10 w-10 text-sauti-teal" />
								</div>
								<h3 className="text-xl font-bold text-sauti-dark mb-3">
									{q ? "No reports found" : "No reports yet"}
								</h3>
								<p className="text-serene-neutral-500 max-w-sm mx-auto leading-relaxed text-sm">
									{q
										? "Try adjusting your search terms or filters to find what you're looking for."
										: "Submit your first incident report to get started with getting the support you need."}
								</p>
								{q && (
									<Button variant="outline" onClick={() => setQ("")} className="mt-6 rounded-2xl border-serene-neutral-200 text-sauti-dark font-semibold hover:bg-serene-neutral-50">
										Clear search
									</Button>
								)}
							</div>
						) : (

							filtered.map((r) => {
								const isActive = selected?.report_id === r.report_id;
								const hasAccepted = r.matched_services?.some(m => m.match_status_type === 'accepted');
								const hasCompleted = r.matched_services?.some(m => m.match_status_type === 'completed');
								const hasProposed = r.matched_services?.some(m => m.match_status_type === 'proposed');
								
								let displayStatus: 'pending' | 'matched' | 'accepted' | 'completed' | 'resolved' = "pending";
								if (hasCompleted) displayStatus = "completed";
								else if (hasAccepted) displayStatus = "accepted";
								else if (hasProposed) displayStatus = "matched";
								else if (r.matched_services && r.matched_services.length > 0) displayStatus = "matched";

								return (
									<div key={r.report_id} className="transition-all duration-200 min-w-0">
										<SereneReportCard
											type={r.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
											date={formatDate(r.submission_timestamp)}
											description={r.incident_description || ""}
											status={displayStatus as any}
											urgency={(r.urgency as any) || "low"}
											matchesCount={r.matched_services?.length || 0}
											active={isActive}
											onClick={() => router.push(`/dashboard/reports/${r.report_id}`)}
											onQuickView={(e) => { e.stopPropagation(); setSelectedId(r.report_id); }}
											onChat={r.matched_services && r.matched_services.length > 0 ? (e) => { e.stopPropagation(); openFloatingChat(r); } : undefined}
										/>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* Right column: Calendar by default */}
				<div
					className={`flex-1 lg:flex-[5] xl:flex-[5] min-w-0 h-full overflow-y-auto overflow-x-hidden ${
						mobileView !== "calendar" ? "hidden lg:block" : ""
					}`}
				>
					<Card className="p-4 sm:p-5 shadow-sm border-serene-neutral-200 rounded-2xl bg-white h-full flex flex-col">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<h3 className="text-sm sm:text-base font-bold text-gray-900 uppercase">
										Sessions Calendar
									</h3>
									{filtered.length > 0 && (
										<span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest rounded-full border border-teal-100">
											{filtered.length} Active
										</span>
									)}
								</div>
								<p className="text-[10px] sm:text-xs font-medium text-gray-400">
									Click on a date to view related reports
								</p>
							</div>
						</div>

						{/* Calendar Connection Status */}
						<CalendarConnectionStatus
							userId={userId}
							variant="inline"
							className="mb-3"
						/>

						{/* Custom Calendar UI */}
						<div className="bg-white rounded-3xl overflow-hidden flex-1 flex flex-col">
							{/* View Mode Toggle + Navigation */}
							<div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
								<div className="flex bg-slate-50 rounded-xl p-1 border border-slate-100 w-full sm:w-auto">
									<button
										onClick={() => setCalendarViewMode('week')}
										className={cn(
											"flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
											calendarViewMode === 'week' 
												? "bg-white text-sauti-teal shadow-sm"
												: "text-slate-400 hover:text-slate-600"
										)}
									>
										Week
									</button>
									<button
										onClick={() => setCalendarViewMode('month')}
										className={cn(
											"flex-1 sm:flex-none px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all",
											calendarViewMode === 'month' 
												? "bg-white text-sauti-teal shadow-sm"
												: "text-slate-400 hover:text-slate-600"
										)}
									>
										Month
									</button>
								</div>
								
								<div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
									<p className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-widest">
										{calendarViewMode === 'week' 
											? `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
											: calendarSelectedDate.toLocaleDateString('default', { month: 'short', year: 'numeric' })
										}
									</p>
									
									<div className="flex gap-1">
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg"
											onClick={() => {
												const prev = new Date(calendarSelectedDate);
												prev.setDate(prev.getDate() - (calendarViewMode === 'week' ? 7 : 30));
												setCalendarSelectedDate(prev);
											}}
										>
											<ChevronLeft className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg"
											onClick={() => {
												const next = new Date(calendarSelectedDate);
												next.setDate(next.getDate() + (calendarViewMode === 'week' ? 7 : 30));
												setCalendarSelectedDate(next);
											}}
										>
											<ChevronRight className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>

							{/* Days Grid */}
							<div className="grid grid-cols-7 gap-1 mb-4">
								{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
									<div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
										{day}
									</div>
								))}
								{calendarViewMode === 'week' ? (
									weekDays.map((day, idx) => {
										const dayAppointments = getAppointmentsForDay(day, filtered);
										const isToday = day.toDateString() === new Date().toDateString();
										const isSelected = day.toDateString() === calendarSelectedDate.toDateString();
										
										return (
											<button
												key={idx}
												onClick={() => {
													setCalendarSelectedDate(day);
												}}
												className={cn(
													"relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all",
													isSelected 
														? "bg-blue-600 text-white" 
														: isToday 
															? "bg-blue-50 text-blue-700" 
															: "hover:bg-gray-50 text-gray-700"
												)}
											>
												<span className="text-sm font-semibold">{day.getDate()}</span>
												{dayAppointments.length > 0 && (
													<div className="flex gap-0.5 mt-0.5">
														{Array.from({ length: Math.min(dayAppointments.length, 3) }).map((_, i) => (
															<div 
																key={i} 
																className={cn(
																	"h-1 w-1 rounded-full",
																	isSelected ? "bg-white/80" : "bg-blue-500"
																)} 
															/>
														))}
													</div>
												)}
											</button>
										);
									})
								) : (
									monthDays.map((dayInfo, idx) => {
										const { date: day, isCurrentMonth } = dayInfo;
										const dayAppointments = getAppointmentsForDay(day, filtered);
										const isToday = day.toDateString() === new Date().toDateString();
										const isSelected = day.toDateString() === calendarSelectedDate.toDateString();
										
										return (
											<button
												key={idx}
												onClick={() => setCalendarSelectedDate(day)}
												className={cn(
													"relative h-9 rounded-lg flex flex-col items-center justify-center transition-all text-xs",
													!isCurrentMonth && "opacity-40",
													isSelected 
														? "bg-blue-600 text-white" 
														: isToday 
															? "bg-blue-50 text-blue-700 font-bold" 
															: "hover:bg-gray-50 text-gray-700"
												)}
											>
												<span className="font-medium">{day.getDate()}</span>
												{dayAppointments.length > 0 && isCurrentMonth && (
													<div className={cn(
														"h-1 w-1 rounded-full mt-0.5",
														isSelected ? "bg-white/80" : "bg-blue-500"
													)} />
												)}
											</button>
										);
									})
								)}
							</div>

							{/* Selected Date Details */}
							<div className="pt-4 border-t border-gray-100">
								<h4 className="text-sm font-semibold text-gray-900 mb-3 block">
									{calendarSelectedDate.toDateString() === new Date().toDateString() ? "Today" : calendarSelectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
								</h4>
								
								{(() => {
									const appointments = getAppointmentsForDay(calendarSelectedDate, filtered);
									const isToday = calendarSelectedDate.toDateString() === new Date().toDateString();
									
									if (appointments.length > 0) {
										return (
											<div className="space-y-2">
												{appointments.map((appt, i) => (
													<div 
														key={i} 
														className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
														onClick={() => setSelectedId(appt.report.report_id)}
													>
														<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 shrink-0">
															<Clock className="h-4 w-4" />
														</div>
														<div className="flex-1 min-w-0">
															<p className="font-medium text-gray-900 text-sm truncate">
																{appt.matched_service?.support_service?.name || "Appointment"}
															</p>
															<p className="text-xs text-gray-500">
																{new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
															</p>
														</div>
														<Badge className="bg-blue-50 text-blue-700 border-0 text-xs shrink-0">
															{appt.status || 'Scheduled'}
														</Badge>
													</div>
												))}
											</div>
										);
									} else if (isToday) {
										// Show upcoming for week logic
										const allAppts = getAllAppointments(filtered);
										const today = new Date();
										const nextWeek = new Date(today);
										nextWeek.setDate(today.getDate() + 7);
										
										const upcoming = allAppts
											.filter(a => {
												if (!a.appointment_date) return false;
												const d = new Date(a.appointment_date);
												return d > today && d <= nextWeek;
											})
											.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
											.slice(0, 3); // Top 3

										if (upcoming.length > 0) {
											return (
												<div>
													<p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Upcoming This Week</p>
													<div className="space-y-2">
														{upcoming.map((appt, i) => (
															<div 
																key={i} 
																className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
																onClick={() => setSelectedId(appt.report.report_id)}
															>
																<div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center text-green-700 shrink-0">
																	<Calendar className="h-4 w-4" />
																</div>
																<div className="flex-1 min-w-0">
																	<p className="font-medium text-gray-900 text-sm truncate">
																		{appt.matched_service?.support_service?.name || "Appointment"}
																	</p>
																	<div className="flex items-center gap-2 text-xs text-gray-500">
																		<span>{new Date(appt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
																		<span>•</span>
																		<span>{new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											);
										}
									}
									
									return (
										<div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
											<p className="text-sm text-gray-500">No appointments scheduled</p>
										</div>
									);
								})()}
							</div>
						</div>
					</Card>
				</div>

				{/* Overlay Backdrop to close sidepanel on outside click */}
				{selected && (
					<div 
						className="fixed inset-0 z-40 bg-black/40 transition-opacity" 
						aria-hidden="true"
						onClick={() => setSelectedId(null)}
					/>
				)}

				{/* Overlay Detail Panel with animation */}
			<div
					className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[600px] lg:w-[800px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out sm:border-l sm:border-serene-neutral-200 ${
						selected
							? "translate-y-0 sm:translate-x-0"
							: "translate-y-full sm:translate-x-full"
					}`}
					aria-hidden={!selected}
					style={{
						transform: selected
							? dragY
								? `translateY(${dragY}px)`
								: undefined
							: undefined,
					}}
					onTouchStart={onTouchStart}
					onTouchMove={onTouchMove}
					onTouchEnd={onTouchEnd}
				>
					{selected && (
						<div className="h-full flex flex-col bg-serene-neutral-50/50">
							{/* Header */}
							<div className="p-4 sm:p-6 border-b border-serene-neutral-200 bg-white flex items-center justify-between gap-4 shadow-sm sticky top-0 z-20">
								<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-12 h-1.5 rounded-full bg-serene-neutral-200" />
								
								<div className="flex items-center gap-3 min-w-0 flex-1">
									<button
										onClick={() => setSelectedId(null)}
										className="sm:hidden -ml-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
									>
										<ChevronLeft className="h-5 w-5 text-gray-600" />
									</button>
									
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-1">
											<h2 className="text-xl font-bold text-gray-900 truncate">
												{selected.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
											</h2>
											<span
												className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${urgencyColor(
													selected.urgency
												)}`}
											>
												{selected.urgency || "low"}
											</span>
										</div>
										<p className="text-xs font-medium text-gray-500 flex items-center gap-2">
											<Clock className="h-3.5 w-3.5" />
											Submitted {formatDate(selected.submission_timestamp)}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="hidden sm:flex text-sauti-teal hover:text-sauti-dark hover:bg-sauti-teal/10 text-xs font-semibold px-3 h-8 rounded-full transition-colors"
										onClick={() => router.push(`/dashboard/reports/${selected.report_id}`)}
										title="View Full Report"
									>
										View Full Details <ChevronRight className="h-3 w-3 ml-1" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="rounded-full hover:bg-red-50 hover:text-red-600 transition-colors h-10 w-10"
										onClick={() => setSelectedId(null)}
									>
										<X className="h-5 w-5" />
									</Button>
								</div>
							</div>
						<div className="flex-1 overflow-y-auto">
							<div className="p-4 space-y-4">
								{/* Mobile only full report link */}
								<Button
									variant="outline"
									className="sm:hidden w-full h-10 rounded-xl border-sauti-teal/30 text-sauti-teal hover:bg-sauti-teal/5 font-semibold text-sm"
									onClick={() => router.push(`/dashboard/reports/${selected.report_id}`)}
								>
									View Full Report <ChevronRight className="h-4 w-4 ml-1" />
								</Button>

								{/* Matched Service & Appointment - Always visible */}
								{(() => {
									// Prioritize accepted match, then proposed, then first available
									const activeMatch = selected.matched_services?.find(m => m.match_status_type === 'accepted') || 
													   selected.matched_services?.find(m => m.match_status_type === 'completed') ||
													   selected.matched_services?.find(m => m.match_status_type === 'proposed') ||
													   selected.matched_services?.[0];

									if (!activeMatch) return (
										<div className="bg-serene-neutral-50 rounded-2xl border border-serene-neutral-200 p-6 text-center">
											<div className="w-12 h-12 rounded-full bg-serene-neutral-100 flex items-center justify-center mx-auto mb-3">
												<Search className="h-6 w-6 text-serene-neutral-400" />
											</div>
											<h3 className="text-sm font-bold text-serene-neutral-900 mb-1">
												Finding a Match
											</h3>
											<p className="text-xs text-serene-neutral-500 max-w-[200px] mx-auto">
												We are currently looking for the best professional to support you.
											</p>
										</div>
									);

									return (
										<div className="bg-white rounded-2xl border border-serene-neutral-200 p-5 shadow-sm">
											<div className="flex items-center justify-between mb-4">
												<h3 className="text-base font-bold text-serene-neutral-900 flex items-center gap-2">
													<User className="h-5 w-5 text-serene-blue-600" />
													{activeMatch.match_status_type === 'accepted' ? 'Connected Professional' : 'Matched Professional'}
												</h3>
												<Badge className={cn(
													"uppercase text-[10px] tracking-wider border-0",
													activeMatch.match_status_type === 'accepted' ? "bg-serene-blue-50 text-serene-blue-700" :
													activeMatch.match_status_type === 'completed' ? "bg-indigo-50 text-indigo-700" :
													"bg-serene-green-50 text-serene-green-700"
												)}>
													{activeMatch.match_status_type}
												</Badge>
											</div>
											
											<div className="flex items-start gap-4 mb-6">
												<Avatar className="h-12 w-12 border-2 border-white shadow-sm">
													<AvatarFallback className="bg-serene-blue-100 text-serene-blue-700 font-bold">
														{activeMatch.support_services?.name?.charAt(0) || "P"}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="text-base font-bold text-serene-neutral-900">
														{activeMatch.support_services?.name || "Service Provider"}
													</p>
													<p className="text-sm text-serene-neutral-500">
														Verified Support Professional
													</p>
												</div>
											</div>

											{/* Appointment Info */}
											{activeMatch.appointments?.[0] ? (
												<div className="bg-serene-blue-50/50 rounded-xl border border-serene-blue-100 p-4 mb-4">
													<div className="flex items-center gap-2 mb-2">
														<CalendarDays className="h-4 w-4 text-serene-blue-600" />
														<span className="text-sm font-bold text-serene-blue-900">
															{activeMatch.appointments[0].status === 'upcoming' ? 'Upcoming Appointment' : 'Appointment Details'}
														</span>
													</div>
													<div className="text-sm text-serene-neutral-700 font-medium">
														{new Date(activeMatch.appointments[0].appointment_date).toLocaleDateString(undefined, {
															weekday: 'long',
															month: 'long',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</div>
													<div className="mt-2 flex gap-2">
														<Badge variant="outline" className="bg-white/80 capitalize">
															{activeMatch.appointments[0].status}
														</Badge>
													</div>
												</div>
											) : (
												<div className="bg-serene-neutral-50 rounded-xl border border-serene-neutral-100 p-4 mb-4 text-center">
													<p className="text-sm text-serene-neutral-500">No appointment scheduled yet.</p>
												</div>
											)}

											<div className="grid grid-cols-2 gap-3">
												<Button 
													className="bg-sauti-teal hover:bg-sauti-dark text-white shadow-sm"
													onClick={() => window.location.href = `/dashboard/chat?id=${activeMatch.appointments?.[0]?.appointment_id || activeMatch.chat_id || 'new'}`}
												>
													<MessageCircle className="h-4 w-4 mr-2" /> Message
												</Button>
												<Button 
													variant="outline"
													className="border-sauti-teal/30 text-sauti-dark hover:bg-sauti-teal/5"
													onClick={() => {
														// Handle showing profile for this specific match
														setShowProfile(true);
													}}
												>
													View Profile
												</Button>
											</div>
										</div>
									);
								})()}

								{/* Collapsible Accordion sections */}
								<Accordion type="multiple" defaultValue={["details"]} className="space-y-3">
									{/* Report Details */}
									<AccordionItem value="details" className="bg-white rounded-xl border border-serene-neutral-200 shadow-sm overflow-hidden">
										<AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
											<div className="flex items-center gap-2 text-sm font-bold text-serene-neutral-900">
												<FileText className="h-4 w-4 text-serene-blue-600" />
												Report Details
											</div>
										</AccordionTrigger>
										<AccordionContent className="px-5 pb-5">
											<div className="space-y-4">
												<div className="flex items-center justify-between">
													<p className="text-xs text-serene-neutral-400 font-medium">
														<Clock className="h-3 w-3 inline mr-1" />
														{formatDate(selected.submission_timestamp)}
													</p>
													<Button 
														variant="ghost" 
														size="sm" 
														className="text-serene-blue-600 hover:text-serene-blue-700 hover:bg-serene-blue-50 h-7 text-xs"
														onClick={() => {
															setEditDescription(selected.incident_description || "");
															setEditDialogOpen(true);
														}}
													>
														<PenLine className="h-3 w-3 mr-1" /> Edit
													</Button>
												</div>
												{selected.incident_description ? (
													<p className="text-sm text-serene-neutral-700 leading-relaxed whitespace-pre-wrap">
														{selected.incident_description}
													</p>
												) : (
													<p className="text-sm text-serene-neutral-400 italic">No description provided.</p>
												)}

												{(selected.media as any)?.url && (
													<div className="pt-4 border-t border-serene-neutral-100">
														<AudioPlayer
															src={(selected.media as any).url}
															type={(selected.media as any).type}
														/>
													</div>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Accountability Tracker */}
									<AccordionItem value="checklist" className="bg-white rounded-xl border border-serene-neutral-200 shadow-sm overflow-hidden">
										<AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
											<div className="flex items-center gap-2 text-sm font-bold text-serene-neutral-900">
												<CheckSquare className="h-4 w-4 text-sauti-teal" />
												Accountability Tracker
												{(() => {
													const admin = (selected as any)?.administrative;
													const items = admin?.checklist || admin?.checklists || [];
													const done = items.filter((i: any) => i.done || i.completed).length;
													return items.length > 0 ? (
														<Badge className="bg-sauti-teal/10 text-sauti-teal border-0 text-[10px] ml-2">{done}/{items.length}</Badge>
													) : null;
												})()}
											</div>
										</AccordionTrigger>
										<AccordionContent className="px-5 pb-5">
											<SidepanelChecklist
												report={selected}
												supabase={supabase}
												onUpdate={(updated) => {
													const next = reports.map((r) =>
														r.report_id === updated.report_id ? { ...r, administrative: (updated as any).administrative } : r
													);
													setReports(next as any);
													try {
														localStorage.setItem(`reports-cache-${userId}`, JSON.stringify(next));
													} catch {}
												}}
											/>
										</AccordionContent>
									</AccordionItem>

									{/* Notes & Updates */}
									<AccordionItem value="notes" className="bg-white rounded-xl border border-serene-neutral-200 shadow-sm overflow-hidden">
										<AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
											<div className="flex items-center gap-2 text-sm font-bold text-serene-neutral-900">
												<PenLine className="h-4 w-4 text-amber-500" />
												Notes & Updates
											</div>
										</AccordionTrigger>
										<AccordionContent className="p-0">
											<div className="h-[400px]">
												<RichTextNotesEditor
													userId={userId}
													report={selected}
													onSaved={(updated: any) => {
														const next = reports.map((r) =>
															r.report_id === updated.report_id ? (updated as any) : r
														);
														setReports(next);
														try {
															localStorage.setItem(
																`reports-cache-${userId}`,
																JSON.stringify(next)
															);
														} catch {}
													}}
												/>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>

								{/* Attachments (if any in administrative JSON) */}
								{(() => {
									const attachments = (selected as any)?.administrative?.attachments as
										| Array<{ name: string; url: string }>
										| undefined;
									if (!attachments || attachments.length === 0) return null;
									return (
										<div className="bg-white rounded-xl border border-serene-neutral-200 p-4 shadow-sm">
											<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
												<Paperclip className="h-4 w-4 text-gray-600" />
												Attachments
											</h3>
											<div className="space-y-2">
												{attachments.map((a, idx) => (
													<div
														key={idx}
														className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200"
													>
														<div className="flex items-center gap-2 min-w-0 flex-1">
															<FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
															<span className="text-sm font-medium text-gray-900 truncate">
																{a.name}
															</span>
														</div>
														<a
															href={a.url}
															target="_blank"
															rel="noreferrer"
															className="ml-2 px-2 py-1 text-xs font-medium text-[#1A3434] bg-[#1A3434]/10 rounded-md hover:bg-[#1A3434]/20 transition-colors"
														>
															Open
														</a>
													</div>
												))}
											</div>
										</div>
									);
								})()}
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Professional Profile Dialog */}
				<Dialog open={showProfile} onOpenChange={setShowProfile}>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>Professional / Service Profile</DialogTitle>
						</DialogHeader>
						{selected?.matched_services?.[0] ? (
							<div className="space-y-3">
								<div className="p-3 rounded-lg bg-neutral-50 border">
									<h4 className="text-sm font-medium text-neutral-800">
										{selected?.matched_services?.[0]?.support_services?.name}
									</h4>
									<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
										<User className="h-3 w-3" />{" "}
										{
											selected?.matched_services?.[0]?.appointments?.[0]?.professional
												?.first_name
										}{" "}
										{
											selected?.matched_services?.[0]?.appointments?.[0]?.professional
												?.last_name
										}
									</div>
									{selected?.matched_services?.[0]?.support_services?.phone_number && (
										<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
											<Phone className="h-3 w-3" />{" "}
											{selected?.matched_services?.[0]?.support_services?.phone_number}
										</div>
									)}
									{selected?.matched_services?.[0]?.support_services?.email && (
										<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
											<Mail className="h-3 w-3" />{" "}
											{selected?.matched_services?.[0]?.support_services?.email}
										</div>
									)}
								</div>
								<div className="text-xs text-neutral-500">
									Reach out to your matched professional if you need to adjust scheduling
									or discuss details.
								</div>
							</div>
						) : (
							<div className="text-sm text-neutral-500">
								No matched professional found.
							</div>
						)}
					</DialogContent>
				</Dialog>

				{/* Edit Report Dialog */}
				<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
					<DialogContent className="sm:max-w-lg bg-white rounded-2xl p-0 overflow-hidden">
						<div className="p-6 pb-0">
							<DialogHeader>
								<DialogTitle className="text-xl font-bold text-serene-neutral-900">Update Report Details</DialogTitle>
							</DialogHeader>
						</div>
						
						<div className="p-6 space-y-6">
							<div className="space-y-2">
								<label className="text-sm font-bold text-serene-neutral-700">Description</label>
								<textarea 
									className="w-full min-h-[150px] p-4 rounded-xl border border-serene-neutral-200 bg-serene-neutral-50 focus:bg-white focus:ring-2 focus:ring-serene-blue-100 transition-all resize-none text-sm leading-relaxed"
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									placeholder="Update the details of what happened..."
								/>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-bold text-serene-neutral-700">Add Voice Note</label>
								<div className="bg-serene-neutral-50 rounded-xl p-4 border border-serene-neutral-200 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? "bg-red-100 text-red-600 animate-pulse" : "bg-serene-blue-100 text-serene-blue-600"}`}>
											<Mic className="h-5 w-5" />
										</div>
										<div className="flex flex-col">
											<span className="text-sm font-bold text-serene-neutral-900">{isRecording ? "Recording..." : "Record Audio"}</span>
											<span className="text-xs text-serene-neutral-500">{isRecording ? "00:12" : "Tap to start recording"}</span>
										</div>
									</div>
									<Button 
										size="icon" 
										variant="ghost" 
										className={`rounded-full h-10 w-10 ${isRecording ? "bg-red-600 text-white hover:bg-red-700" : "bg-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-blue-600 hover:text-white"}`}
										onClick={() => setIsRecording(!isRecording)}
									>
										{isRecording ? <div className="w-3 h-3 bg-white rounded-sm" /> : <div className="w-3 h-3 bg-current rounded-full" />}
									</Button>
								</div>
								<p className="text-xs text-serene-neutral-400 pl-1">Voice notes are encrypted and secure.</p>
							</div>
							
							{/* Photos Disabled as per request */}
							<div className="opacity-50 pointer-events-none">
								<div className="flex items-center gap-2 text-sm font-bold text-serene-neutral-400 mb-2">
									<Paperclip className="h-4 w-4" /> Add Photos (Disabled)
								</div>
							</div>

							<div className="pt-2 flex gap-3">
								<Button 
									className="flex-1 bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl h-12" 
									onClick={async () => {
										if (!selected) return;
										try {
											const { error } = await supabase
												.from("reports")
												.update({ incident_description: editDescription })
												.eq("report_id", selected.report_id);

											if (error) throw error;

											// Update local state
											const updatedReports = reports.map(r => 
												r.report_id === selected.report_id 
													? { ...r, incident_description: editDescription } 
													: r
											);
											setReports(updatedReports as any);
											
											// Also update cache
											try {
												localStorage.setItem(
													`reports-cache-${userId}`,
													JSON.stringify(updatedReports)
												);
											} catch {}

											toast({ title: "Report Updated", description: "Your changes have been saved successfully." });
											setEditDialogOpen(false);
										} catch (err) {
											console.error("Error updating report:", err);
											toast({ 
												title: "Update Failed", 
												description: "Could not update the report details. Please try again.", 
												variant: "destructive" 
											});
										}
									}}
								>
									Save Changes
								</Button>
								<Button variant="outline" className="flex-1 rounded-xl h-12 border-serene-neutral-200" onClick={() => setEditDialogOpen(false)}>
									Cancel
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>

		<FloatingChatManager chats={floatingChats} onClose={closeFloatingChat} />
		</>
	);
}
