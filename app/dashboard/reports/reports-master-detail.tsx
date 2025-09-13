"use client";

import { useEffect, useMemo, useState } from "react";
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
				}
			}
		} catch {
			// Ignore localStorage errors
		}

		const load = async () => {
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
			}
		};
		load();
	}, [userId]);

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
		<div
			className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${
				selected ? "overflow-x-hidden" : ""
			}`}
		>
			{/* Mobile toggle */}
			<div className="lg:hidden -mt-1 mb-1">
				<div className="inline-flex rounded-lg border bg-white p-1">
					<button
						onClick={() => setMobileView("list")}
						className={`px-3 py-1.5 text-xs font-medium rounded-md ${
							mobileView === "list" ? "bg-[#1A3434] text-white" : "text-neutral-700"
						}`}
					>
						Reports
					</button>
					<button
						onClick={() => setMobileView("calendar")}
						className={`px-3 py-1.5 text-xs font-medium rounded-md ${
							mobileView === "calendar"
								? "bg-[#1A3434] text-white"
								: "text-neutral-700"
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
				<div className="mb-3 flex items-center gap-2">
					<Input
						placeholder="Search reports (incident, description, urgency)"
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					{filtered.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							No reports to display.
						</div>
					)}
					{filtered.map((r) => {
						const ms = r.matched_services?.[0];
						const appt = ms?.appointments?.[0];
						const isActive = selected?.report_id === r.report_id;
						return (
							<button
								key={r.report_id}
								onClick={() => setSelectedId(r.report_id)}
								className={`w-full text-left rounded-lg border p-3 bg-white hover:shadow transition-shadow ${
									isActive ? "ring-2 ring-[#1A3434]" : ""
								}`}
							>
								<div className="flex items-start gap-3">
									<div className="h-8 w-8 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-sm shrink-0">
										{(r.type_of_incident || "?").charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<h3 className="font-medium truncate">
												{r.type_of_incident || "Unknown Incident"}
											</h3>
											<span
												className={`px-2 py-0.5 rounded-full text-xs ${urgencyColor(
													r.urgency
												)}`}
											>
												{r.urgency || "low"}
											</span>
										</div>
										{r.incident_description && (
											<p className="text-xs text-neutral-600 mt-1 line-clamp-2">
												{r.incident_description}
											</p>
										)}
										<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
											<span>{formatDate(r.submission_timestamp)}</span>
											{ms && (
												<>
													<span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
													<span className="px-2 py-0.5 rounded-full bg-neutral-100 border text-neutral-700 truncate">
														{ms.support_services?.name || ms.match_status_type}
													</span>
												</>
											)}
											{appt && (
												<>
													<span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
													<span className="flex items-center gap-1">
														<CalendarDays className="h-3 w-3" />{" "}
														{new Date(appt.appointment_date).toLocaleDateString()}
													</span>
												</>
											)}
										</div>
									</div>
									<ChevronRight
										className={`h-4 w-4 text-neutral-400 shrink-0 ${
											isActive ? "opacity-0" : ""
										}`}
									/>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{/* Right column: Calendar by default */}
			<div
				className={`lg:col-span-5 xl:col-span-5 ${
					mobileView !== "calendar" ? "hidden lg:block" : ""
				}`}
			>
				<Card className="p-4">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium text-neutral-700">
							Appointments Calendar
						</h3>
						{selectedId && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedId(null)}
								className="h-7 text-xs"
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
							caption: "flex items-center justify-between px-1 py-2",
							nav: "flex items-center gap-2",
							nav_button_previous: "relative left-0",
							nav_button_next: "relative right-0",
						}}
						selected={undefined}
						modifiers={{ booked: (date) => isDateBooked(date) }}
						modifiersStyles={{
							booked: {
								backgroundColor: "#E0F2FE",
								color: "#0369A1",
								borderRadius: 6,
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
					<div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
						<span className="inline-block w-3 h-3 rounded bg-sky-100 border border-sky-300" />{" "}
						Booked day
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
					<div className="h-full flex flex-col">
						{/* Header */}
						<div className="p-4 border-b flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
							<div className="absolute left-1/2 -translate-x-1/2 -top-2 sm:hidden w-10 h-1.5 rounded-full bg-neutral-200" />
							<div className="flex items-center gap-2">
								<button
									onClick={() => setSelectedId(null)}
									className="sm:hidden -ml-1 p-1 rounded hover:bg-neutral-100"
								>
									<ChevronLeft className="h-5 w-5" />
								</button>
								<div>
									<h2 className="text-base sm:text-lg font-semibold text-[#1A3434]">
										{selected.type_of_incident || "Unknown Incident"}
									</h2>
									<span
										className={`px-2 py-0.5 rounded-full text-xs ${urgencyColor(
											selected.urgency
										)}`}
									>
										{selected.urgency || "low"}
									</span>
								</div>
								<div className="mt-1 text-xs text-neutral-600 flex items-center gap-2">
									<Shield className="h-3 w-3" /> Report ID: {selected.report_id}
									<span>•</span>
									<Clock className="h-3 w-3" />{" "}
									{formatDate(selected.submission_timestamp)}
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="rounded-full"
								onClick={() => setSelectedId(null)}
							>
								<X className="h-5 w-5" />
							</Button>
						</div>

						{/* Body */}
						<div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 pb-24 sm:pb-6 overflow-y-auto">
							{/* Main content */}
							<div className="lg:col-span-3 space-y-4">
								{/* Description */}
								{selected.incident_description && (
									<div className="p-4 rounded-lg bg-neutral-50 border">
										<h3 className="text-sm font-medium text-neutral-700 mb-1">
											Incident Description
										</h3>
										<p className="text-sm text-neutral-800 whitespace-pre-wrap">
											{selected.incident_description}
										</p>
									</div>
								)}

								{/* Notes (WYSIWYG) */}
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

								{/* Attachments (if any in administrative JSON) */}
								{(() => {
									const attachments = (selected as any)?.administrative?.attachments as
										| Array<{ name: string; url: string }>
										| undefined;
									if (!attachments || attachments.length === 0) return null;
									return (
										<div className="p-4 rounded-lg bg-neutral-50 border">
											<h3 className="text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
												<Paperclip className="h-4 w-4" />
												Attachments
											</h3>
											<ul className="space-y-2 text-sm">
												{attachments.map((a, idx) => (
													<li key={idx} className="flex items-center justify-between">
														<span className="truncate flex items-center gap-2">
															<FileText className="h-4 w-4 text-neutral-500" /> {a.name}
														</span>
														<a
															href={a.url}
															target="_blank"
															rel="noreferrer"
															className="text-sauti-orange text-xs"
														>
															Open
														</a>
													</li>
												))}
											</ul>
										</div>
									);
								})()}
							</div>

							{/* Sidebar: Match and Appointment */}
							<div className="lg:col-span-2 space-y-4">
								{/* Matched Service */}
								{selected.matched_services && selected.matched_services.length > 0 ? (
									<div className="p-4 rounded-lg bg-neutral-50 border">
										<h3 className="text-sm font-medium text-neutral-700 mb-1">
											Matched Service
										</h3>
										<p className="text-sm text-neutral-800">
											{selected.matched_services[0].support_services?.name ||
												"Pending Match"}
										</p>
										<p className="text-xs text-neutral-500">
											Status: {String(selected.matched_services[0].match_status_type)}
										</p>
										<div className="mt-3">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setShowProfile(true)}
											>
												View Professional Profile
											</Button>
										</div>
									</div>
								) : (
									<div className="p-4 rounded-lg bg-neutral-50 border">
										<h3 className="text-sm font-medium text-neutral-700 mb-1">
											Matched Service
										</h3>
										<p className="text-sm text-neutral-500">No match yet</p>
									</div>
								)}

								{/* Appointment */}
								{selected.matched_services?.[0]?.appointments?.[0] ? (
									(() => {
										const appt = selected.matched_services![0].appointments![0];
										return (
											<div className="p-4 rounded-lg bg-neutral-50 border">
												<h3 className="text-sm font-medium text-neutral-700 mb-1">
													Appointment
												</h3>
												<div className="text-sm text-neutral-800 flex items-center gap-2">
													<CalendarDays className="h-4 w-4" />{" "}
													{new Date(appt.appointment_date).toLocaleString()}
												</div>
												<div className="mt-1">
													<span
														className={`px-2 py-0.5 rounded-full text-xs ${
															appt.status === "confirmed"
																? "bg-blue-100 text-blue-700"
																: appt.status === "completed"
																? "bg-green-100 text-green-700"
																: "bg-gray-100 text-gray-700"
														}`}
													>
														{appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
													</span>
												</div>
											</div>
										);
									})()
								) : (
									<div className="p-4 rounded-lg bg-neutral-50 border">
										<h3 className="text-sm font-medium text-neutral-700 mb-1">
											Appointment
										</h3>
										<p className="text-sm text-neutral-500">No appointment scheduled</p>
									</div>
								)}
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
									{selected.matched_services[0].support_services?.name}
								</h4>
								<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
									<User className="h-3 w-3" />{" "}
									{
										selected.matched_services[0].appointments?.[0]?.professional
											?.first_name
									}{" "}
									{
										selected.matched_services[0].appointments?.[0]?.professional
											?.last_name
									}
								</div>
								{selected.matched_services[0].support_services?.phone_number && (
									<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
										<Phone className="h-3 w-3" />{" "}
										{selected.matched_services[0].support_services?.phone_number}
									</div>
								)}
								{selected.matched_services[0].support_services?.email && (
									<div className="text-xs text-neutral-600 mt-1 flex items-center gap-2">
										<Mail className="h-3 w-3" />{" "}
										{selected.matched_services[0].support_services?.email}
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
	);
}
