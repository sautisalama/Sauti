"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import { ReportCard } from "@/components/reports/ReportCard";
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
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import RichTextNotesEditor from "./rich-text-notes-editor";
import { useToast } from "@/hooks/use-toast";

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
	const supabase = useMemo(() => createClient(), []);
	const [reports, setReports] = useState<ReportItem[]>([]);
	const [q, setQ] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [showProfile, setShowProfile] = useState(false);
	const [loading, setLoading] = useState(true);
	// Mobile view toggle between list and calendar
	const [mobileView, setMobileView] = useState<"list" | "calendar">("list");

	useEffect(() => {
		// Try to hydrate from cache first for instant load
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

		const load = async () => {
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
              support_service:support_services (
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
							support_services: m.support_service || m.support_services || null,
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
	}, [userId, supabase]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return reports;
		return reports.filter(
			(r) =>
				(r.type_of_incident || "").toLowerCase().includes(term) ||
				(r.incident_description || "").toLowerCase().includes(term) ||
				(r.urgency || "").toLowerCase().includes(term)
		);
	}, [reports, q]);

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
							Reports
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
					{/* Search and filters */}
					<div className="mb-6">
						<div className="flex items-center gap-4">
							<div className="relative flex-1">
								<Input
									placeholder="Search reports by incident type, description, or urgency..."
									value={q}
									onChange={(e) => setQ(e.target.value)}
									className="pl-10 pr-4 py-3 text-sm border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434]"
								/>
								<FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							</div>
							{filtered.length > 0 && (
								<div className="text-sm text-gray-600 whitespace-nowrap">
									{filtered.length} report{filtered.length === 1 ? "" : "s"} found
								</div>
							)}
						</div>
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
							<div className="text-center py-16">
								<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
									<FileText className="h-8 w-8 text-gray-400" />
								</div>
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									No reports found
								</h3>
								<p className="text-gray-500">
									{q
										? "Try adjusting your search terms"
										: "You haven't submitted any reports yet"}
								</p>
							</div>
						) : (
							filtered.map((r) => {
								const isActive = selected?.report_id === r.report_id;
								return (
									<div key={r.report_id} className="transition-all duration-200">
										<ReportCard
											data={r as any}
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
					className={`lg:col-span-5 xl:col-span-5 ${
						mobileView !== "calendar" ? "hidden lg:block" : ""
					} lg:sticky lg:top-4 lg:self-start`}
				>
					<Card className="p-4 shadow-sm border-gray-200 rounded-lg">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h3 className="text-base font-semibold text-gray-900">
									Appointments Calendar
								</h3>
								<p className="text-xs text-gray-500 mt-1">
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
								const firstWithAppt = filtered.find((r) =>
									(r.matched_services || []).some((m) =>
										(m.appointments || []).some(
											(a) => new Date(a.appointment_date).toDateString() === dayKey
										)
									)
								);
								if (firstWithAppt) setSelectedId(firstWithAppt.report_id);
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
												{selected.type_of_incident || "Unknown Incident"}
											</h2>
											<span
												className={`px-2 py-0.5 rounded-md text-xs font-medium ${urgencyColor(
													selected.urgency
												)}`}
											>
												{selected.urgency || "low"}
											</span>
										</div>
										<div className="flex items-center gap-3 text-xs text-gray-500">
											<div className="flex items-center gap-1">
												<Clock className="h-3 w-3" />
												<span>{formatDate(selected.submission_timestamp)}</span>
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
									{selected?.matched_services && selected.matched_services.length > 0 ? (
										<div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
											<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
												<User className="h-4 w-4 text-blue-600" />
												Matched Service & Appointment
											</h3>
											<div className="space-y-3">
												{/* Service Info */}
												<div>
													<p className="text-sm font-medium text-gray-900">
														{selected.matched_services[0].support_services?.name ||
															"Pending Match"}
													</p>
													<p className="text-xs text-gray-600 mt-1">
														Status:{" "}
														<span className="font-medium capitalize">
															{String(selected.matched_services[0].match_status_type)}
														</span>
													</p>
												</div>

												{/* Appointment Info */}
												{selected?.matched_services?.[0]?.appointments?.[0] ? (
													(() => {
														const appt = selected?.matched_services?.[0]?.appointments?.[0];
														if (!appt) return null;
														return (
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
																				{new Date(appt.appointment_date).toLocaleDateString()}
																			</span>
																		</div>
																		<div className="text-gray-600">
																			{new Date(appt.appointment_date).toLocaleTimeString([], {
																				hour: "2-digit",
																				minute: "2-digit",
																			})}
																		</div>
																	</div>
																	<div className="flex items-center gap-2">
																		<span
																			className={`px-2 py-1 rounded-md text-xs font-medium ${
																				appt.status === "confirmed"
																					? "bg-blue-100 text-blue-700 border border-blue-200"
																					: appt.status === "completed"
																					? "bg-green-100 text-green-700 border border-green-200"
																					: "bg-gray-100 text-gray-700 border border-gray-200"
																			}`}
																		>
																			{appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
																		</span>
																	</div>
																</div>
															</div>
														);
													})()
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

												<Button
													variant="outline"
													size="sm"
													onClick={() => setShowProfile(true)}
													className="w-full border-blue-200 text-blue-700 hover:bg-blue-100 text-xs h-8"
												>
													View Professional Profile
												</Button>
											</div>
										</div>
									) : (
										<div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
											<h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
												<User className="h-4 w-4 text-gray-600" />
												Matched Service & Appointment
											</h3>
											<p className="text-xs text-gray-600">
												No match yet - we're working on finding the right professional for
												you
											</p>
										</div>
									)}

									{/* Description with Audio - Combined */}
									{(selected.incident_description || (selected.media as any)?.url) && (
										<div className="bg-white rounded-lg border border-gray-200 p-4">
											<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
												<FileText className="h-4 w-4 text-gray-600" />
												Description
											</h3>
											<div className="space-y-3">
												{selected.incident_description && (
													<p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
														{selected.incident_description}
													</p>
												)}
												{(selected.media as any)?.url && (
													<AudioPlayer
														src={(selected.media as any).url}
														type={(selected.media as any).type}
													/>
												)}
											</div>
										</div>
									)}

									{/* Notes (WYSIWYG) - Full Height */}
									<div className="bg-white rounded-lg border border-gray-200 flex flex-col h-[500px]">
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
			</div>
		</div>
	);
}
