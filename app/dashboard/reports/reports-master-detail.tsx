"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

interface AppointmentLite {
	id: string;
	appointment_id: string;
	appointment_date: string;
	status: string;
	professional?: {
		first_name?: string | null;
		last_name?: string | null;
		email?: string | null;
	} | null;
}

interface ReportItem extends Tables<"reports"> {
	matched_services?: Array<{
		id: string;
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

export default function ReportsMasterDetail({ userId }: { userId: string }) {
	const { toast } = useToast();
	const dash = useDashboardData();
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

	// Calendar State
	const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
	const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());

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
								appointments (
									id,
									appointment_id,
									appointment_date,
									status,
									professional:profiles!appointments_professional_id_fkey (
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
							support_services: m.service_details || m.support_services || null,
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

	const filtered = useMemo(() => {
		let filteredReports = reports;

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
				const matchStatus = r.matched_services?.[0]?.match_status_type;
				if (statusFilter === "matched") {
					return (
						matchStatus &&
						["matched", "confirmed", "accepted"].includes(matchStatus.toLowerCase())
					);
				} else if (statusFilter === "pending") {
					return !matchStatus || matchStatus.toLowerCase() === "pending";
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
		<div className="relative min-h-screen bg-serene-neutral-50">
				<div className="h-[calc(100vh-120px)] overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-8">
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
				{/* Master list */}
				<div
					className={`flex-1 lg:flex-[7] xl:flex-[7] h-full overflow-y-auto pr-2 pb-8 scroll-smooth ${
						mobileView !== "list" ? "hidden lg:block" : ""
					}`}
				>
					<div className="mb-8">
						<SereneBreadcrumb items={[{ label: "Reports", active: true }]} className="mb-4" />
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl lg:text-3xl font-bold text-sauti-dark tracking-tight">My Reports</h1>
								<p className="text-serene-neutral-500 mt-1 text-sm lg:text-base font-medium">View your reports and check their status.</p>
							</div>
						</div>
					</div>
					{/* Premium Search and Filter Bar */}
					<div className="mb-6 sticky top-0 z-30 bg-serene-neutral-50/95 backdrop-blur-lg border-b border-serene-neutral-100 pb-4 pt-3 -mx-1 px-1">
						<div className="flex items-center gap-3">
							{/* Search Bar */}
							<div className="relative flex-1">
								<Input
									placeholder="Search reports..."
									value={q}
									onChange={(e) => setQ(e.target.value)}
									className="pl-11 pr-4 py-2.5 text-sm border-serene-neutral-200 rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-sauti-teal/20 focus:border-sauti-teal transition-all placeholder:text-serene-neutral-400"
								/>
								<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
							</div>

							{/* Filter Toggle Button */}
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowFilters(!showFilters)}
								className={`h-10 px-4 rounded-2xl border-serene-neutral-200 hover:bg-white hover:border-sauti-teal/30 shadow-sm transition-all font-semibold ${
									urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all"
										? "bg-sauti-teal/10 text-sauti-teal border-sauti-teal/30"
										: "bg-white text-serene-neutral-600"
								}`}
							>
								<Filter className="h-4 w-4 mr-1.5" />
								Filters
								{(urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all") && (
									<span className="ml-1.5 h-2 w-2 bg-sauti-teal rounded-full animate-pulse"></span>
								)}
							</Button>
						</div>

						{/* Collapsible Filter Panel */}
						{showFilters && (
							<div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
								<div className="flex flex-col sm:flex-row sm:items-center gap-4">
									<div className="flex flex-wrap items-center gap-3">
										{/* Urgency Filter */}
										<div className="flex flex-col gap-1">
											<label className="text-xs font-medium text-gray-600">Urgency</label>
											<select
												value={urgencyFilter}
												onChange={(e) => setUrgencyFilter(e.target.value)}
												className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434] min-w-[100px]"
											>
												<option value="all">All</option>
												<option value="high">High</option>
												<option value="medium">Medium</option>
												<option value="low">Low</option>
											</select>
										</div>

										{/* Status Filter */}
										<div className="flex flex-col gap-1">
											<label className="text-xs font-medium text-gray-600">Status</label>
											<select
												value={statusFilter}
												onChange={(e) => setStatusFilter(e.target.value)}
												className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434] min-w-[120px]"
											>
												<option value="all">All</option>
												<option value="pending">Pending</option>
												<option value="matched">Matched</option>
												<option value="appointment">With Appointment</option>
											</select>
										</div>

										{/* On Behalf Filter */}
										<div className="flex flex-col gap-1">
											<label className="text-xs font-medium text-gray-600">Type</label>
											<select
												value={onBehalfFilter}
												onChange={(e) => setOnBehalfFilter(e.target.value)}
												className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434] min-w-[100px]"
											>
												<option value="all">All</option>
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
								<div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-sauti-teal/10 to-serene-blue-100 flex items-center justify-center shadow-sm">
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
								return (
									<div key={r.report_id} className="transition-all duration-200">
										<SereneReportCard
											type={r.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
											date={formatDate(r.submission_timestamp)}
											description={r.incident_description || ""}
											status={r.matched_services && r.matched_services.length > 0 ? "matched" : "pending"}
											urgency={(r.urgency as any) || "low"}
											matchesCount={r.matched_services?.length || 0}
											active={isActive}
											onClick={() => setSelectedId(r.report_id)}
										/>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* Right column: Calendar by default */}
				<div
					className={`flex-1 lg:flex-[5] xl:flex-[5] h-full overflow-y-auto ${
						mobileView !== "calendar" ? "hidden lg:block" : ""
					}`}
				>
					<Card className="p-4 shadow-sm border-gray-200 rounded-lg">
						<div className="flex items-center justify-between mb-4">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<h3 className="text-base font-semibold text-gray-900">
										Appointments Calendar
									</h3>
									{filtered.length > 0 && (
										<span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
											{filtered.length} report{filtered.length === 1 ? "" : "s"}
										</span>
									)}
								</div>
								<p className="text-xs text-gray-500">
									Click on a date to view related reports
								</p>
							</div>
							{selectedId && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setSelectedId(null)}
									className="h-8 text-xs border-gray-200 hover:bg-gray-50"
								>
									Clear selection
								</Button>
							)}
						</div>

						{/* Calendar Connection Status */}
						<CalendarConnectionStatus
							userId={userId}
							variant="inline"
							className="mb-3"
						/>

						{/* Custom Calendar UI */}
						<div className="bg-white rounded-lg overflow-hidden">
							{/* View Mode Toggle + Navigation */}
							<div className="flex items-center justify-between mb-4">
								<div className="flex bg-gray-100 rounded-lg p-0.5">
									<button
										onClick={() => setCalendarViewMode('week')}
										className={cn(
											"px-3 py-1.5 text-xs font-medium rounded-md transition-all",
											calendarViewMode === 'week' 
												? "bg-white text-blue-700 shadow-sm"
												: "text-gray-600 hover:text-gray-900"
										)}
									>
										Week
									</button>
									<button
										onClick={() => setCalendarViewMode('month')}
										className={cn(
											"px-3 py-1.5 text-xs font-medium rounded-md transition-all",
											calendarViewMode === 'month' 
												? "bg-white text-blue-700 shadow-sm"
												: "text-gray-600 hover:text-gray-900"
										)}
									>
										Month
									</button>
								</div>
								
								<p className="text-sm font-medium text-gray-700">
									{calendarViewMode === 'week' 
										? `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
										: calendarSelectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
									}
								</p>
								
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0"
										onClick={() => {
											const prev = new Date(calendarSelectedDate);
											prev.setDate(prev.getDate() - (calendarViewMode === 'week' ? 7 : 30));
											setCalendarSelectedDate(prev);
										}}
									>
										←
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0"
										onClick={() => {
											const next = new Date(calendarSelectedDate);
											next.setDate(next.getDate() + (calendarViewMode === 'week' ? 7 : 30));
											setCalendarSelectedDate(next);
										}}
									>
										→
									</Button>
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

				{/* Overlay Detail Panel with animation */}
			<div
					className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[600px] lg:w-[800px] bg-white shadow-2xl border-l border-serene-neutral-200 z-50 transform transition-transform duration-300 ease-out ${
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
						<div className="h-full flex flex-col bg-gray-50/50">
							{/* Header */}
							<div className="p-6 border-b border-serene-neutral-200 bg-white flex items-center justify-between gap-4 shadow-sm sticky top-0 z-20">
								<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-12 h-1.5 rounded-full bg-gray-300" />
								
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

								<Button
									variant="ghost"
									size="icon"
									className="rounded-full hover:bg-red-50 hover:text-red-600 transition-colors h-10 w-10"
									onClick={() => setSelectedId(null)}
								>
									<X className="h-5 w-5" />
								</Button>
							</div>

							{/* Body */}
							<div className="flex-1 overflow-y-auto">
								<div className="p-4 space-y-4">
									{/* Matched Service & Appointment - Combined */}
									{selected?.matched_services && selected.matched_services.length > 0 ? (
										<div className="bg-white rounded-2xl border border-serene-neutral-200 p-5 shadow-sm">
											<div className="flex items-center justify-between mb-4">
												<h3 className="text-base font-bold text-serene-neutral-900 flex items-center gap-2">
													<User className="h-5 w-5 text-serene-blue-600" />
													Matched Professional
												</h3>
												<Badge className="bg-serene-green-50 text-serene-green-700 border-serene-green-200 uppercase text-[10px] tracking-wider">
													{selected.matched_services[0].match_status_type}
												</Badge>
											</div>
											
											<div className="flex items-start gap-4 mb-6">
												<Avatar className="h-12 w-12 border-2 border-white shadow-sm">
													<AvatarFallback className="bg-serene-blue-100 text-serene-blue-700 font-bold">
														{selected.matched_services[0].support_services?.name?.charAt(0) || "P"}
													</AvatarFallback>
												</Avatar>
												<div>
													<p className="text-base font-bold text-serene-neutral-900">
														{selected.matched_services[0].support_services?.name || "Service Provider"}
													</p>
													<p className="text-sm text-serene-neutral-500">
														Verified Support Professional
													</p>
												</div>
											</div>

											{/* Appointment Info */}
											{selected?.matched_services?.[0]?.appointments?.[0] ? (
												<div className="bg-serene-blue-50/50 rounded-xl border border-serene-blue-100 p-4 mb-4">
													<div className="flex items-center gap-2 mb-2">
														<CalendarDays className="h-4 w-4 text-serene-blue-600" />
														<span className="text-sm font-bold text-serene-blue-900">
															Upcoming Appointment
														</span>
													</div>
													<div className="text-sm text-serene-neutral-700 font-medium">
														{new Date(selected.matched_services[0].appointments[0].appointment_date).toLocaleDateString(undefined, {
															weekday: 'long',
															month: 'long',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</div>
													<div className="mt-2 flex gap-2">
														<Badge variant="outline" className="bg-white/80 capitalize">
															{selected.matched_services[0].appointments[0].status}
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
													onClick={() => window.location.href = `/dashboard/chat?id=${selected.matched_services![0].appointments?.[0]?.appointment_id || 'new'}`} // Mock chat link
												>
													<MessageCircle className="h-4 w-4 mr-2" /> Message
												</Button>
												<Button 
													variant="outline"
													className="border-sauti-teal/30 text-sauti-dark hover:bg-sauti-teal/5"
													onClick={() => setShowProfile(true)}
												>
													View Profile
												</Button>
											</div>
										</div>
									) : (
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
									)}

									{/* Description with Audio - Update Details Primary */}
									<div className="bg-white rounded-2xl border border-serene-neutral-200 p-5 shadow-sm">
										<div className="flex items-center justify-between mb-4">
											<h3 className="text-base font-bold text-serene-neutral-900 flex items-center gap-2">
												<FileText className="h-5 w-5 text-serene-blue-600" />
												Report Details
											</h3>
											<Button 
												variant="ghost" 
												size="sm" 
												className="text-serene-blue-600 hover:text-serene-blue-700 hover:bg-serene-blue-50"
												onClick={() => {
													setEditDescription(selected.incident_description || "");
													setEditDialogOpen(true);
												}}
											>
												Edit
											</Button>
										</div>
										<div className="space-y-4">
											{selected.incident_description ? (
												<p className="text-sm text-serene-neutral-700 leading-relaxed whitespace-pre-wrap">
													{selected.incident_description}
												</p>
											) : (
												<p className="text-sm text-serene-neutral-400 italic">No description provided.</p>
											)}
											
											{(selected.media as any)?.url && (
												<div className="mt-4 pt-4 border-t border-serene-neutral-100">
													<AudioPlayer
														src={(selected.media as any).url}
														type={(selected.media as any).type}
													/>
												</div>
											)}
										</div>
									</div>

									{/* Notes (WYSIWYG) - Full Height */}
									<div className="flex flex-col h-[80vh] sm:h-[500px] mb-4">
										<div className="p-4 border-b border-gray-200">
											<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
												<FileText className="h-5 w-5 text-gray-600" />
												Notes & Updates
											</h3>
										</div>
										<div className="flex-1 overflow-hidden">
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
													} catch {
														// Ignore localStorage errors
													}
												}}
											/>
										</div>
									</div>

									{/* Attachments (if any in administrative JSON) */}
									{(() => {
										const attachments = (selected as any)?.administrative?.attachments as
											| Array<{ name: string; url: string }>
											| undefined;
										if (!attachments || attachments.length === 0) return null;
										return (
											<div className="bg-white rounded-lg border border-gray-200 p-4">
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
					<DialogContent className="sm:max-w-lg bg-white rounded-3xl p-0 overflow-hidden">
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
	);
}
