"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import { AppointmentCard } from "@/app/dashboard/_components/AppointmentCard";
import { useToast } from "@/hooks/use-toast";
import {
	CalendarDays,
	Clock,
	Filter,
	Search,
	FileText,
	X,
	ArrowLeft,
} from "lucide-react";
import type { AppointmentWithDetails } from "@/app/dashboard/_types";
import ReportNotesEditor from "@/app/dashboard/reports/rich-text-notes-editor";
import { Tables } from "@/types/db-schema";
import { CalendarConnectionStatus } from "../_components/CalendarConnectionStatus";

export default function AppointmentsMasterDetail({
	userId,
	username,
}: {
	userId: string;
	username: string;
}) {
	const { toast } = useToast();
	const supabase = useMemo(() => createClient(), []);
	const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
	const [q, setQ] = useState("");
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [mobileView, setMobileView] = useState<"list" | "calendar">("list");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [showFilters, setShowFilters] = useState(false);

	useEffect(() => {
		// Try local cache first
		try {
			const cached = localStorage.getItem(`appointments-cache-${userId}`);
			if (cached) {
				const parsed = JSON.parse(cached);
				if (Array.isArray(parsed)) {
					setAppointments(parsed);
					setLoading(false);
				}
			}
		} catch {}

		const load = async () => {
			setLoading(true);
			try {
				const { data, error } = await supabase
					.from("appointments")
					.select(
						`
            *,
            matched_service:matched_services (
              *,
              support_service:support_services (*),
              report:reports (*)
            ),
            professional:profiles!appointments_professional_id_fkey (*),
            survivor:profiles!appointments_survivor_id_fkey (*)
          `
					)
					.eq("survivor_id", userId)
					.order("appointment_date", { ascending: false });
				if (error) throw error;
				setAppointments((data as any) || []);
				try {
					localStorage.setItem(
						`appointments-cache-${userId}`,
						JSON.stringify(data || [])
					);
				} catch {}
			} catch (e) {
				toast({
					title: "Error",
					description: "Failed to load appointments",
					variant: "destructive",
				});
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [userId, supabase, toast]);

	const term = q.trim().toLowerCase();
	const filtered = useMemo(() => {
		return appointments.filter((a) => {
			const matchesText =
				!term ||
				(a.matched_service?.support_service?.name || "")
					.toLowerCase()
					.includes(term) ||
				(a.matched_service?.report?.incident_description || "")
					.toLowerCase()
					.includes(term);
			const matchesStatus =
				statusFilter === "all" || (a.status || "").toLowerCase() === statusFilter;
			return matchesText && matchesStatus;
		});
	}, [appointments, term, statusFilter]);

	const selected = useMemo(
		() => filtered.find((a) => a.appointment_id === selectedId) || null,
		[filtered, selectedId]
	);

	// Calendar markers
	const appointmentDates = new Set<string>();
	for (const a of filtered) {
		if (a.appointment_date)
			appointmentDates.add(new Date(a.appointment_date).toDateString());
	}
	const isDateBooked = (date: Date) => appointmentDates.has(date.toDateString());

	return (
		<div className="relative">
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
						Appointments
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

			<div className={`grid grid-cols-1 lg:grid-cols-12 gap-6`}>
				{/* Master list */}
				<div
					className={`lg:col-span-7 xl:col-span-7 ${
						mobileView !== "list" ? "hidden lg:block" : ""
					}`}
				>
					{/* Search and filters */}
					<div className="mb-4 lg:sticky lg:top-[100px] lg:z-20 lg:bg-white/95 lg:backdrop-blur-sm lg:border-b lg:border-gray-200 lg:pb-4">
						<div className="flex items-center gap-3">
							<div className="relative flex-1">
								<Input
									placeholder="Search appointments (service or description)"
									value={q}
									onChange={(e) => setQ(e.target.value)}
									className="pl-10 pr-4 py-2 text-sm border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434]"
								/>
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowFilters(!showFilters)}
								className={`h-9 px-3 border-gray-200 hover:bg-gray-50 ${
									statusFilter !== "all"
										? "bg-blue-50 text-blue-700 border-blue-200"
										: ""
								}`}
							>
								<Filter className="h-4 w-4 mr-1" /> Filters
								{statusFilter !== "all" && (
									<span className="ml-1 h-2 w-2 bg-blue-500 rounded-full"></span>
								)}
							</Button>
						</div>
						{showFilters && (
							<div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
								<div className="flex items-center gap-4">
									<div className="flex flex-col gap-1">
										<label className="text-xs font-medium text-gray-600">Status</label>
										<select
											value={statusFilter}
											onChange={(e) => setStatusFilter(e.target.value)}
											className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-[#1A3434]/20 focus:border-[#1A3434] min-w-[120px]"
										>
											<option value="all">All</option>
											<option value="confirmed">Confirmed</option>
											<option value="completed">Completed</option>
											<option value="cancelled">Cancelled</option>
										</select>
									</div>
									{statusFilter !== "all" && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setStatusFilter("all")}
											className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
										>
											Clear filters
										</Button>
									)}
								</div>
							</div>
						)}
					</div>

					{/* List */}
					<div className="space-y-4">
						{loading ? (
							<div className="text-center py-16 text-muted-foreground">
								Loading appointments...
							</div>
						) : filtered.length === 0 ? (
							<div className="text-center py-20">
								<div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-50 to-sky-100 flex items-center justify-center">
									<FileText className="h-10 w-10 text-sky-600" />
								</div>
								<h3 className="text-xl font-semibold text-gray-900 mb-3">
									{q ? "No appointments found" : "No appointments yet"}
								</h3>
								<p className="text-gray-500 max-w-md mx-auto leading-relaxed">
									{q
										? "Try adjusting your search terms or filters."
										: "Your scheduled appointments will appear here."}
								</p>
							</div>
						) : (
							filtered.map((a) => (
								<div
									key={a.id}
									className="transition-all duration-200"
									onClick={() => setSelectedId(a.appointment_id)}
								>
									<AppointmentCard
										appointment={a as any}
										onStatusUpdate={() => {
											/* keep list fresh on action */
										}}
										userId={userId}
										username={username}
									/>
								</div>
							))
						)}
					</div>
				</div>

				{/* Calendar column */}
				<div
					className={`lg:col-span-5 xl:col-span-5 ${
						mobileView !== "calendar" ? "hidden lg:block" : ""
					} lg:sticky lg:top-[100px] lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto`}
				>
					<Card className="p-4 shadow-sm border-gray-200 rounded-lg">
						<div className="flex items-center justify-between mb-4">
							<div>
								<div className="flex items-center gap-2 mb-1">
									<h3 className="text-base font-semibold text-gray-900">
										Appointments Calendar
									</h3>
								</div>
								<p className="text-xs text-gray-500">
									Click a date to highlight matching items
								</p>
							</div>
						</div>

						{/* Calendar Connection Status */}
						<CalendarConnectionStatus
							userId={userId}
							variant="inline"
							className="mb-3"
						/>

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
								const dayKey = date.toDateString();
								const first = filtered.find(
									(a) => new Date(a.appointment_date).toDateString() === dayKey
								);
								if (first) setSelectedId(first.appointment_id);
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
			</div>

			{/* Side panel overlay for selected appointment */}
			<div
				className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[520px] lg:w-[640px] bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 ease-out ${
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
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 mb-1">
									{/* Mobile back button */}
									<Button
										variant="ghost"
										size="icon"
										className="sm:hidden rounded-lg hover:bg-gray-100 transition-colors h-8 w-8 -ml-2 mr-1"
										onClick={() => setSelectedId(null)}
									>
										<ArrowLeft className="h-4 w-4 text-gray-600" />
									</Button>
									<h2 className="text-lg font-semibold text-gray-900 truncate">
										{selected.matched_service?.support_service?.name || "Appointment"}
									</h2>
									<span
										className={`px-2 py-0.5 rounded-md text-xs font-medium ${
											selected.status === "confirmed"
												? "bg-blue-100 text-blue-700 border border-blue-200"
												: selected.status === "completed"
												? "bg-green-100 text-green-700 border border-green-200"
												: "bg-gray-100 text-gray-700 border border-gray-200"
										}`}
									>
										{selected.status?.charAt(0).toUpperCase() + selected.status?.slice(1)}
									</span>
								</div>
								<div className="flex items-center gap-3 text-xs text-gray-500">
									<div className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										<span>
											{selected.appointment_date
												? new Date(selected.appointment_date).toLocaleString()
												: ""}
										</span>
									</div>
								</div>
							</div>
							{/* Desktop close button */}
							<Button
								variant="ghost"
								size="icon"
								className="hidden sm:flex rounded-lg hover:bg-gray-100 transition-colors h-8 w-8"
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
										<CalendarDays className="h-4 w-4 text-blue-600" />
										Matched Service & Appointment
									</h3>
									<div className="space-y-3">
										{/* Service Info */}
										<div>
											<p className="text-sm font-medium text-gray-900">
												{selected.matched_service?.support_service?.name || "Pending Match"}
											</p>
											{(selected.matched_service as any)?.match_status_type && (
												<p className="text-xs text-gray-600 mt-1">
													Status:{" "}
													<span className="font-medium capitalize">
														{String((selected.matched_service as any).match_status_type)}
													</span>
												</p>
											)}
										</div>
										{/* Appointment Info */}
										<div className="bg-white rounded-lg border border-blue-200 p-3">
											<div className="text-xs text-gray-700">
												<div className="flex items-center gap-2 mb-1">
													<Clock className="h-3 w-3 text-gray-500" />
													<span className="font-medium">
														{selected.appointment_date
															? new Date(selected.appointment_date).toLocaleDateString()
															: ""}
													</span>
												</div>
												<div className="text-gray-600">
													{selected.appointment_date
														? new Date(selected.appointment_date).toLocaleTimeString([], {
																hour: "2-digit",
																minute: "2-digit",
														  })
														: ""}
												</div>
												<div className="mt-2">
													<span
														className={`px-2 py-1 rounded-md text-xs font-medium ${
															selected.status === "confirmed"
																? "bg-blue-100 text-blue-700 border border-blue-200"
																: selected.status === "completed"
																? "bg-green-100 text-green-700 border border-green-200"
																: "bg-gray-100 text-gray-700 border border-gray-200"
														}`}
													>
														{selected.status?.charAt(0).toUpperCase() +
															selected.status?.slice(1)}
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Description with Audio - Combined (from report) */}
								{(selected.matched_service?.report?.incident_description ||
									(selected.matched_service?.report?.media as any)?.url) && (
									<div className="bg-white rounded-lg border border-gray-200 p-4">
										<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
											<FileText className="h-4 w-4 text-gray-600" />
											Description
										</h3>
										<div className="space-y-3">
											{selected.matched_service?.report?.incident_description && (
												<p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
													{selected.matched_service.report.incident_description}
												</p>
											)}
											{(selected.matched_service?.report?.media as any)?.url && (
												<audio controls className="w-full">
													<source
														src={(selected.matched_service?.report?.media as any).url}
													/>
												</audio>
											)}
										</div>
									</div>
								)}

								{/* Notes (WYSIWYG) - Full Height */}
								<div className="bg-white rounded-lg border border-gray-200 flex flex-col h-[70vh] sm:h-[480px]">
									<div className="p-4 border-b border-gray-200">
										<h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
											<FileText className="h-5 w-5 text-gray-600" />
											Notes & Updates
										</h3>
									</div>
									<div className="flex-1 overflow-hidden">
										{selected.matched_service?.report && (
											<ReportNotesEditor
												userId={userId}
												report={
													selected.matched_service.report as unknown as Tables<"reports">
												}
												onSaved={(updated) => {
													// Update nested report notes in appointments list and cache
													setAppointments((prev) => {
														const next = prev.map((a) => {
															if (a.matched_service?.report?.report_id === updated.report_id) {
																return {
																	...a,
																	matched_service: {
																		...a.matched_service,
																		report: updated as any,
																	},
																} as any;
															}
															return a;
														});
														try {
															localStorage.setItem(
																`appointments-cache-${userId}`,
																JSON.stringify(next)
															);
														} catch {}
														return next;
													});
												}}
											/>
										)}
									</div>
								</div>

								{/* Attachments (if any in administrative JSON) */}
								{(() => {
									const attachments = (selected.matched_service?.report as any)
										?.administrative?.attachments as
										| Array<{ name: string; url: string }>
										| undefined;
									if (!attachments || attachments.length === 0) return null;
									return (
										<div className="bg-white rounded-lg border border-gray-200 p-4">
											<h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
												<FileText className="h-4 w-4 text-gray-600" />
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
		</div>
	);
}
