"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileText,
	Shield,
	User,
	Phone,
	Mail,
	X,
	Briefcase,
	Play,
	Pause,
	Filter,
	Search,
	CheckCircle2,
	MessageCircle,
	TrendingUp,
	MessageSquare,
} from "lucide-react";
import { CaseCard } from "@/components/cases/CaseCard";
import { CaseCardSkeleton } from "@/components/cases/CaseCardSkeleton";
import CaseNotesEditor from "./case-notes-editor";
import {
	getUnreadMessagesForCases,
	subscribeToUnreadMessages,
} from "@/utils/chat/unread-tracker";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { CalendarConnectionStatus } from "../_components/CalendarConnectionStatus";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { useRouter } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { getCaseChat } from "@/app/actions/chat";
import { Chat } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";


interface MatchedServiceItem {
	id: string;
	match_date: string | null;
	match_status_type: string | null;
	match_score: number | null;
	completed_at?: string | null;
	unread_messages?: number;
	report: any;
	service_details: any;
	notes?: string | null;
	appointments?: Array<{
		id: string;
		appointment_id: string;
		appointment_date: string;
		status: string;
	}>;
}

export default function CasesMasterDetail({ userId }: { userId: string }) {
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);
	const dash = useDashboardData();
	const seededFromProviderRef = useRef(false);
	const [cases, setCases] = useState<MatchedServiceItem[]>([]);
	const [q, setQ] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [mobileView, setMobileView] = useState<"list" | "calendar">("list");
	const [loading, setLoading] = useState(true);
	// Filters
	const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [onBehalfFilter, setOnBehalfFilter] = useState<string>("all");
	const [showFilters, setShowFilters] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);

	// Chat State
	const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
	const [activeChat, setActiveChat] = useState<Chat | null>(null);
	const [isChatLoading, setIsChatLoading] = useState(false);

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

	const getAllAppointments = (casesData: MatchedServiceItem[]) => {
		const all: any[] = [];
		casesData.forEach(c => {
			 c.appointments?.forEach(a => {
				 all.push({ ...a, case: c });
			 });
		});
		return all;
	};

	const getAppointmentsForDay = (date: Date, items: MatchedServiceItem[]) => {
		const all = getAllAppointments(items);
		return all.filter(a =>
			a.appointment_date && new Date(a.appointment_date).toDateString() === date.toDateString()
		);
	};

	// Fetch chat when case is selected
	useEffect(() => {
		if (selectedId) {
			const selectedCase = cases.find(c => c.id === selectedId);
			if (selectedCase && selectedCase.report?.survivor_id) {
				setIsChatLoading(true);
				const survId = selectedCase.report.survivor_id;
				getCaseChat(selectedId, survId)
					.then(chat => setActiveChat(chat))
					.catch(err => console.error("Failed to load chat", err))
					.finally(() => setIsChatLoading(false));
			}
		} else {
			setActiveChat(null);
			setActiveTab('details');
		}
	}, [selectedId, cases]);

	// Seed from provider if available (instant render)
	useEffect(() => {
		try {
			if (
				!dash?.data ||
				dash.data.userId !== userId ||
				seededFromProviderRef.current
			)
				return;
			const apptByMatchId = new Map<string, any[]>();
			(dash.data.appointments || []).forEach((a: any) => {
				const mid = a?.matched_service?.id;
				if (!mid) return;
				const arr = apptByMatchId.get(mid) || [];
				arr.push({
					id: a.id,
					appointment_id: a.appointment_id,
					appointment_date: a.appointment_date,
					status: a.status,
				});
				apptByMatchId.set(mid, arr);
			});
			const seeded: MatchedServiceItem[] = (dash.data.matchedServices || []).map(
				(m: any) => ({
					id: m.id,
					match_date: m.match_date || null,
					match_status_type: m.match_status_type || null,
					match_score: (m as any).match_score ?? null,
					completed_at: (m as any).completed_at ?? null,
					unread_messages: 0,
					report: m.report,
					service_details: m.service_details,
					notes: (m as any).notes || null,
					appointments: apptByMatchId.get(m.id) || [],
				})
			);
			setCases(seeded);
			setLoading(false);
			seededFromProviderRef.current = true;
		} catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dash?.data, userId]);

	// Load matched services and appointments in parallel (skip if already seeded)
	useEffect(() => {
		const load = async () => {
			if (seededFromProviderRef.current) return;
			setLoading(true);
			try {
				// Get the user's services
				const { data: services } = await supabase
					.from("support_services")
					.select("id")
					.eq("user_id", userId);
				const ids = (services || []).map((s) => s.id);
				if (ids.length === 0) {
					setCases([]);
					setLoading(false);
					return;
				}

				const [{ data: matches }, { data: appts }] = await Promise.all([
					supabase
						.from("matched_services")
						.select(`*, report:reports(*), service_details:support_services(*)`)
						.in("service_id", ids)
						.order("match_date", { ascending: false }),
					supabase
						.from("appointments")
						.select("*, matched_services")
						.in(
							"matched_services",
							ids.length
								? (
										await supabase
											.from("matched_services")
											.select("id")
											.in("service_id", ids)
								  ).data?.map((m: any) => m.id) || []
								: []
						),
				]);

				const apptByMatchId = new Map<string, any[]>();
				(appts || []).forEach((a: any) => {
					const k = a.matched_services as string;
					const arr = apptByMatchId.get(k) || [];
					arr.push(a);
					apptByMatchId.set(k, arr);
				});

				const normalized: MatchedServiceItem[] = (matches || []).map((m: any) => ({
					...m,
					notes: m.notes || null,
					appointments: apptByMatchId.get(m.id) || [],
				}));

				setCases(normalized);
			} catch (error) {
				console.error("Failed to load cases:", error);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [userId, supabase]);

	// Track unread messages for each case - load after cases are loaded
	// This prevents delays and freezing during initial case loading
	useEffect(() => {
		if (cases.length === 0 || loading) return;

		// Add a small delay to ensure cases are fully rendered first
		const timeoutId = setTimeout(async () => {
			try {
				setIsLoadingMessages(true);
				// Get unread message counts for all cases
				const caseIds = cases.map((c) => c.id);
				const unreadData = await getUnreadMessagesForCases(
					"current-user-id", // This should be the actual user ID
					"current-username", // This should be the actual username
					caseIds
				);

				// Update cases with unread message counts
				setCases((prev) =>
					prev.map((c) => {
						const unreadInfo = unreadData.find((u) => u.caseId === c.id);
						return {
							...c,
							unread_messages: unreadInfo?.unreadCount || 0,
						};
					})
				);
			} catch (error) {
				console.error("Error tracking unread messages:", error);
			} finally {
				setIsLoadingMessages(false);
			}
		}, 200); // 200ms delay to ensure cases are rendered first

		return () => clearTimeout(timeoutId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cases.length, loading]); // Only depend on cases.length and loading state

	// Subscribe to real-time unread message updates - only after initial load
	useEffect(() => {
		if (cases.length === 0 || loading) return;

		// Add a delay to ensure initial load is complete
		const timeoutId = setTimeout(() => {
			const cleanup = subscribeToUnreadMessages(
				"current-user-id", // This should be the actual user ID
				"current-username", // This should be the actual username
				(unreadData) => {
					// Update cases with new unread message counts
					setCases((prev) =>
						prev.map((c) => {
							const unreadInfo = unreadData.find((u) => u.caseId === c.id);
							return {
								...c,
								unread_messages: unreadInfo?.unreadCount || 0,
							};
						})
					);
				}
			);

			// Store cleanup function for later use
			return cleanup;
		}, 1000); // 1 second delay for real-time subscription

		return () => clearTimeout(timeoutId);
	}, [cases.length, loading]); // Only depend on cases.length and loading state

	const filtered = useMemo(() => {
		let filteredCases = cases;

		// Text search filter
		const term = q.trim().toLowerCase();
		if (term) {
			filteredCases = filteredCases.filter(
				(c) =>
					(c.report?.type_of_incident || "").toLowerCase().includes(term) ||
					(c.report?.incident_description || "").toLowerCase().includes(term) ||
					(c.match_status_type || "").toLowerCase().includes(term) ||
					(c.service_details?.name || "").toLowerCase().includes(term)
			);
		}

		// Urgency filter
		if (urgencyFilter !== "all") {
			filteredCases = filteredCases.filter(
				(c) => (c.report?.urgency || "low").toLowerCase() === urgencyFilter
			);
		}

		// Status filter (based on match status)
		if (statusFilter !== "all") {
			filteredCases = filteredCases.filter((c) => {
				const matchStatus = c.match_status_type;
				if (statusFilter === "matched") {
					return (
						matchStatus &&
						["matched", "confirmed", "accepted"].includes(matchStatus.toLowerCase())
					);
				} else if (statusFilter === "pending") {
					return !matchStatus || matchStatus.toLowerCase() === "pending";
				} else if (statusFilter === "appointment") {
					return c.appointments && c.appointments.length > 0;
				}
				return true;
			});
		}

		// On behalf filter
		if (onBehalfFilter !== "all") {
			const isOnBehalf = onBehalfFilter === "yes";
			filteredCases = filteredCases.filter(
				(c) => !!c.report?.is_onBehalf === isOnBehalf
			);
		}

		return filteredCases;
	}, [cases, q, urgencyFilter, statusFilter, onBehalfFilter]);

	const selected = useMemo(
		() => filtered.find((c) => c.id === selectedId) || null,
		[filtered, selectedId]
	);

	const appointmentDates = useMemo(() => {
		const set = new Set<string>();
		for (const c of cases) {
			for (const a of c.appointments || []) {
				if (a.appointment_date)
					set.add(new Date(a.appointment_date).toDateString());
			}
		}
		return set;
	}, [cases]);

	const isDateBooked = (date: Date) => appointmentDates.has(date.toDateString());

	const urgencyColor = (u?: string | null) =>
		u === "high"
			? "bg-red-100 text-red-700"
			: u === "medium"
			? "bg-yellow-100 text-yellow-700"
			: "bg-blue-100 text-blue-700";

	const formatDate = (d?: string | null) =>
		d ? new Date(d).toLocaleString() : "";

	// Handle case completion
	const handleCompleteCase = async (caseId: string) => {
		try {
			setIsUpdatingStatus(true);
			const { error } = await supabase
				.from("matched_services")
				.update({
					match_status_type: "completed",
					completed_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				})
				.eq("id", caseId);

			if (error) throw error;

			// Update local state
			setCases((prev) =>
				prev.map((c) =>
					c.id === caseId
						? {
								...c,
								match_status_type: "completed",
								completed_at: new Date().toISOString(),
						  }
						: c
				)
			);
		} catch (error) {
			console.error("Error completing case:", error);
		} finally {
			setIsUpdatingStatus(false);
		}
	};

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
							<div className="w-3 h-3 rounded-full bg-purple-500" />
							<span className="text-sm font-medium text-gray-700">
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
								background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${
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

	return (
		<div className="relative min-h-screen bg-serene-neutral-50">
				<div className=" overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-8">
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
							Cases
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
					className={`flex-1 h-full overflow-y-auto pr-2 pb-8 scroll-smooth ${
						mobileView !== "list" ? "hidden lg:block" : ""
					}`}
				>
					<div className="mb-8">
						<SereneBreadcrumb items={[{ label: "Cases", active: true }]} className="mb-4" />
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl lg:text-3xl font-bold text-sauti-dark tracking-tight">Case Management</h1>
								<p className="text-serene-neutral-500 mt-1 text-sm lg:text-base font-medium">Review your matched cases and track progress.</p>
							</div>
						</div>
					</div>
					{/* Premium Search and Filter Bar */}
					<div className="mb-6 sticky top-0 z-30 bg-serene-neutral-50/95 backdrop-blur-lg border-b border-serene-neutral-100 pb-4 pt-3 -mx-1 px-1">
						<div className="flex items-center gap-3">
							{/* Search Bar */}
							<div className="relative flex-1">
								<Input
									placeholder="Search cases..."
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

					{/* Cases list */}
					<div className="space-y-4">
						{loading ? (
							// Show skeleton loading
							<>
								{Array.from({ length: 3 }).map((_, i) => (
									<CaseCardSkeleton key={i} />
								))}
							</>
						) : filtered.length === 0 ? (
							<div className="text-center py-24 px-6">
								<div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-sauti-teal/10 to-serene-blue-100 flex items-center justify-center shadow-sm">
									<Shield className="h-10 w-10 text-sauti-teal" />
								</div>
								<h3 className="text-xl font-bold text-sauti-dark mb-3">
									{q ? "No cases found" : "No cases yet"}
								</h3>
								<p className="text-serene-neutral-500 max-w-sm mx-auto leading-relaxed text-sm">
									{q
										? "Try adjusting your search terms or filters to find what you're looking for."
										: "When survivors report incidents and you're matched as their support professional, your cases will appear here."}
								</p>
								{q && (
									<Button variant="outline" onClick={() => setQ("")} className="mt-6 rounded-2xl border-serene-neutral-200 text-sauti-dark font-semibold hover:bg-serene-neutral-50">
										Clear search
									</Button>
								)}
							</div>
						) : (
							filtered.map((c) => {
								const isActive = selected?.id === c.id;
								return (
									<div key={c.id} className="transition-all duration-200">
										<CaseCard
											data={c as any}
											active={isActive}
											onClick={() => router.push(`/dashboard/reports/${c.report.report_id}`)}
											isLoadingMessages={isLoadingMessages}
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
					<Card className="p-5 shadow-sm border-serene-neutral-200 rounded-2xl bg-white">
						<div className="flex items-center justify-between mb-5">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<h3 className="text-base font-semibold text-gray-900">
										Appointments Calendar
									</h3>
									{filtered.length > 0 && (
										<span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
											{filtered.length} case{filtered.length === 1 ? "" : "s"}
										</span>
									)}
								</div>
								<p className="text-xs text-gray-500">
									Click on a date to view related cases
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
													// If has appointments, allow selection logic if needed
													if (dayAppointments.length > 0) {
														// Example: select first case? Or list below?
														// The list below shows appointments. Clicking here just updates `calendarSelectedDate`.
														// The user can then click the appointment list item below to open the case.
													}
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
														onClick={() => setSelectedId(appt.case.id)}
													>
														<div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 shrink-0">
															<Clock className="h-4 w-4" />
														</div>
														<div className="flex-1 min-w-0">
															<p className="font-medium text-gray-900 text-sm truncate">
																{appt.case?.support_service?.name || "Appointment"}
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
																onClick={() => setSelectedId(appt.case.id)}
															>
																<div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center text-green-700 shrink-0">
																	<Calendar className="h-4 w-4" />
																</div>
																<div className="flex-1 min-w-0">
																	<p className="font-medium text-gray-900 text-sm truncate">
																		{appt.case?.support_service?.name || "Appointment"}
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
			{/* Backdrop for mobile */}
			{selected && (
				<div 
					className="fixed inset-0 bg-black/20 z-40 sm:hidden"
					onClick={() => setSelectedId(null)}
				/>
			)}
				<div
					className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[600px] lg:w-[800px] bg-white shadow-2xl border-l border-serene-neutral-200 z-50 transform transition-transform duration-300 ease-out ${
						selected
							? "translate-y-0 sm:translate-x-0"
							: "translate-y-full sm:translate-x-full"
					}`}
					aria-hidden={!selected}
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
												{selected.report?.type_of_incident || "Unknown Incident"}
											</h2>
											<span
												className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${urgencyColor(
													selected.report?.urgency
												)}`}
											>
												{selected.report?.urgency || "low"}
											</span>
										</div>
										<p className="text-xs font-medium text-gray-500 flex items-center gap-2">
											<Clock className="h-3.5 w-3.5" />
											Submitted {formatDate(selected.report?.submission_timestamp)}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									{/* Complete Case Button (if not completed) */}
									{!selected.completed_at && (
										<Button 
											size="sm"
											className="bg-serene-green-600 hover:bg-serene-green-700 text-white shadow-sm border border-serene-green-700 font-semibold"
											onClick={() => handleCompleteCase(selected.id)}
											disabled={isUpdatingStatus}
										>
											{isUpdatingStatus ? (
												<div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
											) : (
												<CheckCircle2 className="h-4 w-4 mr-1.5" />
											)}
											Complete Case
										</Button>
									)}
									
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

							{/* Tabs */}
							<div className="flex border-b border-gray-200 px-4 gap-6 bg-white shrink-0">
								<button
									onClick={() => setActiveTab('details')}
									className={`py-3 text-sm font-medium border-b-2 transition-colors ${
										activeTab === 'details'
											? 'border-blue-600 text-blue-600'
											: 'border-transparent text-gray-500 hover:text-gray-700'
									}`}
								>
									Case Details
								</button>
								<button
									onClick={() => setActiveTab('chat')}
									className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
										activeTab === 'chat'
											? 'border-blue-600 text-blue-600'
											: 'border-transparent text-gray-500 hover:text-gray-700'
									}`}
								>
									<MessageSquare className="h-4 w-4" />
									Chat
								</button>
							</div>

							{activeTab === 'chat' ? (
								<div className="flex-1 overflow-hidden flex flex-col relative h-full">
									{isChatLoading ? (
										<div className="flex items-center justify-center h-full text-gray-500">
											<div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
											Loading chat...
										</div>
									) : activeChat ? (
										<ChatWindow 
											chat={activeChat} 
											onBack={() => setActiveTab('details')} 
										/>
									) : (
										<div className="flex items-center justify-center h-full text-gray-500 p-8 text-center">
											<p>Unable to load chat or no survivor associated.</p>
										</div>
									)}
								</div>
							) : (
								/* Premium Case Details Body */
								<div className="flex-1 overflow-y-auto bg-gray-50/50">
									<div className="p-6 space-y-6">

										{/* Status Card */}
										<Card className="p-5 border-serene-neutral-200 shadow-sm bg-white">
											<div className="flex items-center justify-between mb-4">
												<div className="flex items-center gap-2">
													<div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
														<TrendingUp className="h-4 w-4 text-blue-600" />
													</div>
													<span className="text-sm font-semibold text-gray-900">Case Status</span>
												</div>
												{selected.match_status_type === "completed" ? (
													<Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
														<CheckCircle2 className="h-3 w-3 mr-1" />
														Completed
													</Badge>
												) : (
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleCompleteCase(selected.id)}
														disabled={isUpdatingStatus}
														className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
													>
														{isUpdatingStatus ? (
															<Clock className="h-3 w-3 mr-1 animate-spin" />
														) : (
															<CheckCircle2 className="h-3 w-3 mr-1" />
														)}
														Mark Complete
													</Button>
												)}
											</div>
											
											{selected.unread_messages && selected.unread_messages > 0 && (
												<div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
													<div className="relative">
														<MessageCircle className="h-5 w-5 text-blue-600" />
														<span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white" />
													</div>
													<div className="flex-1">
														<p className="text-sm font-medium text-blue-900">New Messages</p>
														<p className="text-xs text-blue-600">You have {selected.unread_messages} unread message(s)</p>
													</div>
													<Button
														size="sm"
														className="h-8 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
														onClick={() => window.open(`/dashboard/chats?caseId=${selected.id}`, "_blank")}
													>
														View Chat
													</Button>
												</div>
											)}
										</Card>

										{/* Survivor & Incident Card */}
										<Card className="overflow-hidden border-serene-neutral-200 shadow-sm bg-white">
											<div className="p-5 border-b border-gray-100 bg-gray-50/30">
												<h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
													<User className="h-4 w-4 text-gray-500" />
													Survivor & Incident Details
												</h3>
											</div>
											<div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
												{/* Incident Type */}
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Incident Type</p>
													<div className="flex items-center gap-2">
														<Shield className="h-4 w-4 text-gray-400" />
														<span className="text-sm font-medium text-gray-900">
															{selected.report?.type_of_incident || "Not specified"}
														</span>
													</div>
												</div>

												{/* Urgency */}
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Urgency Level</p>
													<Badge variant="outline" className={cn("capitalize font-medium", urgencyColor(selected.report?.urgency))}>
														{selected.report?.urgency || "Low"} Priority
													</Badge>
												</div>

												{/* Date */}
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Reported On</p>
													<div className="flex items-center gap-2">
														<Calendar className="h-4 w-4 text-gray-400" />
														<span className="text-sm text-gray-900">
															{formatDate(selected.report?.submission_timestamp)}
														</span>
													</div>
												</div>

												{/* Connection */}
												<div>
													<p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Connection Type</p>
													<div className="flex items-center gap-2">
														<User className="h-4 w-4 text-gray-400" />
														<span className="text-sm text-gray-900 capitalize">
															{selected.report?.reporting_on_behalf ? "On Behalf" : "Direct Report"}
														</span>
													</div>
												</div>
											</div>
										</Card>

										{/* Matched Service Card */}Welcome back, you're safe here.
										<Card className="overflow-hidden border-serene-neutral-200 shadow-sm bg-white">
											<div className="p-5 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
												<h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
													<Briefcase className="h-4 w-4 text-gray-500" />
													Matched Service
												</h3>
												<Badge variant="secondary" className="bg-gray-100 text-gray-600 font-normal">
													{selected.match_status_type === 'matched' ? 'Active Match' : 'Pending'}
												</Badge>
											</div>
											<div className="p-5">
												<div className="flex items-start gap-4 mb-6">
													<div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
														<span className="text-lg font-bold text-blue-600">
															{selected.support_service?.name?.charAt(0) || "S"}
														</span>
													</div>
													<div>
														<h4 className="text-base font-bold text-gray-900">
															{selected.support_service?.name || "Pending Service Allocation"}
														</h4>
														<p className="text-sm text-gray-500 mt-0.5">
															{selected.support_service?.category || "Support Service"} • {selected.support_service?.organization_name || "Sauti Salama Network"}
														</p>
													</div>
												</div>

												{selected.appointments?.[0] ? (
													<div className="bg-green-50/50 rounded-xl border border-green-100 p-4">
														<div className="flex items-center gap-2 mb-3">
															<CalendarDays className="h-4 w-4 text-green-600" />
															<span className="text-sm font-bold text-green-900">Upcoming Appointment</span>
														</div>
														<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
															<div>
																<p className="text-sm font-medium text-gray-900">
																	{new Date(selected.appointments[0].appointment_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
																</p>
																<p className="text-sm text-gray-500">
																	{new Date(selected.appointments[0].appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
																</p>
															</div>
															<Badge className={cn(
																"self-start sm:self-center capitalize",
																selected.appointments[0].status === 'confirmed' ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-700"
															)}>
																{selected.appointments[0].status}
															</Badge>
														</div>
													</div>
												) : (
													<div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
														<CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
														<p className="text-sm text-gray-500">No appointments scheduled yet</p>
													</div>
												)}
											</div>
										</Card>

										{/* Description & Media */}
										{(selected.report?.incident_description || selected.report?.media?.url) && (
											<Card className="border-serene-neutral-200 shadow-sm bg-white overflow-hidden">
												<div className="p-5 border-b border-gray-100 bg-gray-50/30">
													<h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
														<FileText className="h-4 w-4 text-gray-500" />
														Incident Description
													</h3>
												</div>
												<div className="p-5 space-y-4">
													{selected.report?.incident_description && (
														<div className="prose prose-sm max-w-none text-gray-600">
															<p className="whitespace-pre-wrap leading-relaxed">
																{selected.report.incident_description}
															</p>
														</div>
													)}
													
													{selected.report?.media?.url && (
														<div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
															<p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Attached Media</p>
															<AudioPlayer
																src={selected.report.media.url}
																type={selected.report.media.type}
															/>
														</div>
													)}
												</div>
											</Card>
										)}

										{/* Notes Editor */}
										<Card className="overflow-hidden flex flex-col h-[500px]">
											<div className="p-4 flex items-center justify-between">
												<h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
													<FileText className="h-4 w-4 text-gray-500" />
													Case Notes
												</h3>
												<span className="text-xs text-gray-400">Private & Secure</span>
											</div>
											<div className="flex-1 overflow-hidden bg-gray-50/20">
												<CaseNotesEditor
													matchId={selected.id}
													initialHtml={selected.notes || ""}
													onSaved={(html) => {
														setCases((prev) =>
															prev.map((c) =>
																c.id === selected?.id ? { ...c, notes: html } : c
															)
														);
													}}
												/>
											</div>
										</Card>

									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
