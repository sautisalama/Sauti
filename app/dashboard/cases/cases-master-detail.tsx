"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
	Mic,
	Play,
	Pause,
	Filter,
	Search,
} from "lucide-react";
import { CaseCard } from "@/components/cases/CaseCard";
import { CaseCardSkeleton } from "@/components/cases/CaseCardSkeleton";
import CaseNotesEditor from "./case-notes-editor";

interface MatchedServiceItem {
	id: string;
	match_date: string | null;
	match_status_type: string | null;
	match_score: number | null;
	report: any;
	support_service: any;
	notes?: string | null;
	appointments?: Array<{
		id: string;
		appointment_id: string;
		appointment_date: string;
		status: string;
	}>;
}

export default function CasesMasterDetail({ userId }: { userId: string }) {
	const supabase = useMemo(() => createClient(), []);
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

	// Load matched services and appointments in parallel
	useEffect(() => {
		const load = async () => {
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
					return;
				}

				const [{ data: matches }, { data: appts }] = await Promise.all([
					supabase
						.from("matched_services")
						.select(`*, report:reports(*), support_service:support_services(*)`)
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
					(c.support_service?.name || "").toLowerCase().includes(term)
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
		<div className="relative">
			<div
				className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${
					selected ? "overflow-x-hidden" : ""
				}`}
			>
				{/* Mobile toggle */}
				<div className="lg:hidden -mt-2 mb-4">
					<div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
						<button
							onClick={() => setMobileView("list")}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
								mobileView === "list"
									? "bg-[#1A3434] text-white shadow-sm"
									: "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
							}`}
						>
							Cases
						</button>
						<button
							onClick={() => setMobileView("calendar")}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
								mobileView === "calendar"
									? "bg-[#1A3434] text-white shadow-sm"
									: "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
							}`}
						>
							Calendar
						</button>
					</div>
				</div>

				{/* Master list */}
				<div
					className={`lg:col-span-7 xl:col-span-7 ${
						mobileView !== "list" ? "hidden lg:block" : ""
					}`}
				>
					{/* Compact Search and Filter Bar */}
					<div className="mb-4">
						<div className="flex items-center gap-3">
							{/* Search Bar */}
							<div className="relative flex-1">
								<Input
									placeholder="Search cases..."
									value={q}
									onChange={(e) => setQ(e.target.value)}
									className="pl-10 pr-4 py-2 text-sm border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434]"
								/>
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							</div>

							{/* Filter Toggle Button */}
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowFilters(!showFilters)}
								className={`h-9 px-3 border-gray-200 hover:bg-gray-50 ${
									urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all"
										? "bg-blue-50 text-blue-700 border-blue-200"
										: ""
								}`}
							>
								<Filter className="h-4 w-4 mr-1" />
								Filters
								{(urgencyFilter !== "all" ||
									statusFilter !== "all" ||
									onBehalfFilter !== "all") && (
									<span className="ml-1 h-2 w-2 bg-blue-500 rounded-full"></span>
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
							<div className="text-center py-16">
								<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
									<FileText className="h-8 w-8 text-gray-400" />
								</div>
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									No cases found
								</h3>
								<p className="text-gray-500">
									{q
										? "Try adjusting your search terms"
										: "You don't have any cases yet"}
								</p>
							</div>
						) : (
							filtered.map((c) => {
								const isActive = selected?.id === c.id;
								return (
									<div key={c.id} className="transition-all duration-200">
										<CaseCard
											data={c as any}
											active={isActive}
											onClick={() => setSelectedId(c.id)}
										/>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* Right column: Calendar by default */}
				<div
					className={`lg:col-span-5 xl:col-span-5 ${
						mobileView !== "calendar" ? "hidden lg:block" : ""
					} lg:sticky lg:top-4 lg:self-start`}
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
						<UIDateCalendar
							mode="single"
							showOutsideDays
							className="p-0"
							classNames={{
								caption: "flex items-center justify-between px-2 py-2 mb-3",
								nav: "flex items-center gap-1",
								nav_button_previous:
									"relative left-0 h-7 w-7 rounded-md hover:bg-gray-100",
								nav_button_next:
									"relative right-0 h-7 w-7 rounded-md hover:bg-gray-100",
								head_cell: "text-gray-500 font-medium text-xs uppercase tracking-wide",
								cell: "h-8 w-8 text-center text-sm relative",
								day: "h-7 w-7 rounded-md hover:bg-gray-100 transition-colors",
								day_selected: "bg-[#1A3434] text-white hover:bg-[#1A3434]",
								day_today: "bg-gray-100 text-gray-900 font-semibold",
							}}
							selected={undefined}
							modifiers={{ booked: (date) => isDateBooked(date) }}
							modifiersStyles={{
								booked: {
									backgroundColor: "#E0F2FE",
									color: "#0369A1",
									borderRadius: 8,
									fontWeight: 600,
								},
							}}
							onSelect={(date) => {
								if (!date) return;
								// Filter master list by selected date (appointments on that date)
								const dayKey = date.toDateString();
								const firstWithAppt = filtered.find((c) =>
									(c.appointments || []).some(
										(a) => new Date(a.appointment_date).toDateString() === dayKey
									)
								);
								if (firstWithAppt) setSelectedId(firstWithAppt.id);
							}}
						/>
						<div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
							<div className="flex items-center gap-2">
								<span className="inline-block w-2 h-2 rounded bg-sky-100 border border-sky-200" />
								<span>Appointment scheduled</span>
							</div>
						</div>
					</Card>
				</div>

				{/* Overlay Detail Panel with animation */}
				<div
					className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[720px] bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 ease-out ${
						selected
							? "translate-y-0 sm:translate-x-0"
							: "translate-y-full sm:translate-x-full"
					}`}
					aria-hidden={!selected}
				>
					{selected && (
						<div className="h-full flex flex-col bg-gray-50">
							{/* Header */}
							<div className="p-4 border-b border-gray-200 bg-white flex items-start justify-between gap-3 sticky top-0 z-10">
								<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-12 h-1.5 rounded-full bg-gray-300" />
								<div className="flex items-start gap-3 min-w-0 flex-1">
									<button
										onClick={() => setSelectedId(null)}
										className="sm:hidden -ml-1 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
									>
										<ChevronLeft className="h-4 w-4 text-gray-600" />
									</button>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 mb-1">
											<h2 className="text-lg font-semibold text-gray-900 truncate">
												{selected.report?.type_of_incident || "Unknown Incident"}
											</h2>
											<span
												className={`px-2 py-0.5 rounded-md text-xs font-medium ${urgencyColor(
													selected.report?.urgency
												)}`}
											>
												{selected.report?.urgency || "low"}
											</span>
										</div>
										<div className="flex items-center gap-3 text-xs text-gray-500">
											<div className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												<span>{formatDate(selected.match_date)}</span>
											</div>
											<div className="flex items-center gap-1">
												<Shield className="h-3 w-3" />
												<span>Case ID: {selected.id}</span>
											</div>
										</div>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="rounded-lg hover:bg-gray-100 transition-colors h-8 w-8"
									onClick={() => setSelectedId(null)}
								>
									<X className="h-4 w-4 text-gray-600" />
								</Button>
							</div>

							{/* Body */}
							<div className="flex-1 overflow-y-auto">
								<div className="p-4 space-y-4">
									{/* Matched Service & Appointment - Combined */}
									<div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
										<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
											<User className="h-4 w-4 text-blue-600" />
											Matched Service & Appointment
										</h3>
										<div className="space-y-3">
											{/* Service Info */}
											<div>
												<p className="text-sm font-medium text-gray-900">
													{selected.support_service?.name || "Pending Match"}
												</p>
												<p className="text-xs text-gray-600 mt-1">
													Status:{" "}
													<span className="font-medium capitalize">
														{String(selected.match_status_type || "pending")}
													</span>
												</p>
											</div>

											{/* Appointment Info */}
											{selected.appointments?.[0] ? (
												<div className="bg-white rounded-lg border border-blue-200 p-3">
													<div className="flex items-center gap-2 mb-2">
														<CalendarDays className="h-4 w-4 text-green-600" />
														<span className="text-sm font-medium text-gray-900">
															Appointment
														</span>
													</div>
													<div className="space-y-2">
														<div className="text-xs text-gray-700">
															<div className="flex items-center gap-2 mb-1">
																<Clock className="h-3 w-3 text-gray-500" />
																<span className="font-medium">
																	{new Date(
																		selected.appointments[0].appointment_date
																	).toLocaleDateString()}
																</span>
															</div>
															<div className="text-gray-600">
																{new Date(
																	selected.appointments[0].appointment_date
																).toLocaleTimeString([], {
																	hour: "2-digit",
																	minute: "2-digit",
																})}
															</div>
														</div>
														<div className="flex items-center gap-2">
															<span
																className={`px-2 py-1 rounded-md text-xs font-medium ${
																	selected.appointments[0].status === "confirmed"
																		? "bg-blue-100 text-blue-700 border border-blue-200"
																		: selected.appointments[0].status === "completed"
																		? "bg-green-100 text-green-700 border border-green-200"
																		: "bg-gray-100 text-gray-700 border border-gray-200"
																}`}
															>
																{selected.appointments[0].status.charAt(0).toUpperCase() +
																	selected.appointments[0].status.slice(1)}
															</span>
														</div>
													</div>
												</div>
											) : (
												<div className="bg-white rounded-lg border border-blue-200 p-3">
													<div className="flex items-center gap-2 mb-2">
														<CalendarDays className="h-4 w-4 text-gray-600" />
														<span className="text-sm font-medium text-gray-900">
															Appointment
														</span>
													</div>
													<p className="text-xs text-gray-600">
														No appointment scheduled yet
													</p>
												</div>
											)}
										</div>
									</div>

									{/* Description with Audio - Combined */}
									{(selected.report?.incident_description ||
										selected.report?.media?.url) && (
										<div className="bg-white rounded-lg border border-gray-200 p-4">
											<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
												<FileText className="h-4 w-4 text-gray-600" />
												Description
											</h3>
											<div className="space-y-3">
												{selected.report?.incident_description && (
													<p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
														{selected.report.incident_description}
													</p>
												)}
												{selected.report?.media?.url && (
													<AudioPlayer
														src={selected.report.media.url}
														type={selected.report.media.type}
													/>
												)}
											</div>
										</div>
									)}

									{/* Notes (WYSIWYG) - Full Height */}
									<div className="bg-white rounded-lg border border-gray-200 flex flex-col h-[100vh] sm:h-[500px]">
										<div className="p-4 border-b border-gray-200">
											<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
												<FileText className="h-5 w-5 text-gray-600" />
												Case Notes & Updates
											</h3>
										</div>
										<div className="flex-1 overflow-hidden">
											<CaseNotesEditor
												matchId={selected.id}
												initialHtml={selected.notes || ""}
												onSaved={(html) => {
													setCases((prev) =>
														prev.map((c) =>
															c.id === selected.id ? { ...c, notes: html } : c
														)
													);
												}}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
