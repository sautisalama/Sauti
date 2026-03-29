"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

import { useToast } from "@/hooks/use-toast";
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
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { getCaseChat } from "@/app/actions/chat";
import { Chat } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { matchProfessionalWithUnmatchedReports } from "@/app/actions/match-services";
import { CaseDetailView } from "./_components/CaseDetailView";
import { EnhancedAppointmentScheduler } from "../_components/EnhancedAppointmentScheduler";
import { createAppointment } from "../_views/actions/appointments";
import { markCaseAsExclusive } from "@/app/actions/matching";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Zap } from "lucide-react";


interface MatchedServiceItem {
	id: string;
	match_date: string | null;
	match_status_type: string | null;
	match_score: number | null;
	completed_at?: string | null;
    feedback?: string | null;
	unread_messages?: number;
	survivor_id?: string | null;
	report: Tables<"reports">;
	service_details: Tables<"support_services">;
	notes?: string | null;
	support_service?: {
		name?: string | null;
		phone_number?: string | null;
		email?: string | null;
		category?: string | null;
		organization_name?: string | null;
	} | null;
 	appointments?: Array<{
		id: string;
		appointment_id: string;
		appointment_date: string | null;
		status: string | null;
		professional?: {
			first_name: string | null;
			last_name: string | null;
		} | null;
	}>;
}


export default function CasesMasterDetail({ userId }: { userId: string }) {
	const { toast } = useToast();
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
	
	// Acceptance Flow State
	const [isAcceptanceDialogOpen, setIsAcceptanceDialogOpen] = useState(false);
	const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
	const [caseIdToAccept, setCaseIdToAccept] = useState<string | null>(null);

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
		const all: (NonNullable<MatchedServiceItem["appointments"]>[number] & { case: MatchedServiceItem })[] = [];
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
			if (selectedCase && (selectedCase.survivor_id || selectedCase.report?.user_id)) {
				setIsChatLoading(true);
				const survId = (selectedCase.survivor_id || selectedCase.report?.user_id) as string;
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
			const apptByMatchId = new Map<string, NonNullable<MatchedServiceItem["appointments"]>>();
			(dash.data.appointments || []).forEach((a) => {
				const mid = a?.matched_service?.id;
				if (!mid) return;
				const arr = apptByMatchId.get(mid) || [];
				arr.push({
					id: a.appointment_id,
					appointment_id: a.appointment_id,
					appointment_date: a.appointment_date,
					status: a.status,
				});
				apptByMatchId.set(mid, arr);
			});


			const seeded: MatchedServiceItem[] = (dash.data.matchedServices || []).map(
				(m) => ({
					id: m.id,
					match_date: m.match_date || null,
					match_status_type: m.match_status_type || null,
					match_score: m.match_score ?? null,
					completed_at: m.completed_at ?? null,
					unread_messages: 0,
					report: m.report as Tables<"reports">,
					service_details: m.service_details as Tables<"support_services">,
					notes: m.notes || null,
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
	const loadCases = useMemo(() => async (forceRefresh: boolean = false) => {
		if (seededFromProviderRef.current && !forceRefresh) return;
		setLoading(true);
		try {
			// Get the user's services
			const { data: services } = await supabase
				.from("support_services")
				.select("id")
				.eq("user_id", userId);
			const ids = (services || []).map((s) => s.id);
			
            // Fetch matches (service-based OR hrd-based)
            let matchesQuery = supabase
                .from("matched_services")
                .select(`*, report:reports(*), service_details:support_services(*)`);
            
            if (ids.length > 0) {
                matchesQuery = matchesQuery.or(`service_id.in.("${ids.join('","')}"),hrd_profile_id.eq."${userId}"`);
            } else {
                matchesQuery = matchesQuery.eq("hrd_profile_id", userId);
            }

            // Fetch appointments for these matches
            // We need the match IDs first, or we can just fetch all for these services/profile
            const { data: matchesData } = await matchesQuery.order("match_date", { ascending: false });
            const matchIds = (matchesData || []).map((m) => m.id);


			const { data: appts } = await supabase
					.from("appointments")
					.select("*, matched_services")
					.in(
						"matched_services",
						matchIds
					);
            
            const matches = matchesData;

			const apptByMatchId = new Map<string, NonNullable<MatchedServiceItem["appointments"]>>();
			(appts || []).forEach((a) => {
				const k = a.matched_services as string;
				const arr = apptByMatchId.get(k) || [];
				arr.push({
					id: a.appointment_id,
					appointment_id: a.appointment_id,
					appointment_date: a.appointment_date || '',
					status: a.status || 'pending',
				});

				apptByMatchId.set(k, arr);
			});



			const normalized: MatchedServiceItem[] = (matches || []).map((m) => ({
				...m,
				notes: m.notes || null,
				appointments: apptByMatchId.get(m.id) || [],
			} as MatchedServiceItem));



			setCases(normalized);
			
			// PROACTIVE MATCHING: If after loading we still have NO cases, 
			// trigger the proactive matching engine once per session.
			if (normalized.length === 0 && !seededFromProviderRef.current) {
				console.log("[Cases] No cases found. Triggering proactive matching engine...");
				const res = await matchProfessionalWithUnmatchedReports(userId);
				if (res && typeof res === 'object' && 'matched' in res && (res as { matched: number }).matched > 0) {
					console.log(`[Cases] Success! Matched ${res.matched} reports. Refreshing...`);

					// Re-run the load to pick up new matches
					seededFromProviderRef.current = false; // allow re-fetch
					loadCases(true); 
				}
			}
		} catch (error) {
			console.error("Failed to load cases:", error);
		} finally {
			setLoading(false);
		}
	}, [userId, supabase, seededFromProviderRef]);

	useEffect(() => {
		loadCases();
	}, [loadCases]);

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

	// Subscribe to real-time match updates (for exclusivity and new cases)
	useEffect(() => {
		if (!userId) return;
		const channel = supabase.channel('realtime_cases_prof')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'matched_services' },
				(payload) => {
					if (payload.eventType === 'UPDATE') {
						const newRecord = payload.new as Tables<"matched_services">;
						setCases((prev) => {
							const exists = prev.find(c => c.id === newRecord.id);
							if (!exists) return prev;
							
							if (selectedId === newRecord.id && newRecord.match_status_type === 'declined') {
								toast({
									title: "Case Unavailable",
									description: "This case has been taken by another professional.",
									variant: "destructive"
								});
							}
							
							return prev.map(c => c.id === newRecord.id ? { ...c, match_status_type: newRecord.match_status_type } : c);
						});
					} else if (payload.eventType === 'INSERT') {
						loadCases(true);
					}
				}
			)
			.subscribe();

		return () => { supabase.removeChannel(channel); };
	}, [userId, supabase, selectedId, toast, loadCases]);

	const filtered = useMemo(() => {
		let filteredCases = cases;

		// Default exclusivity filter: hide declined cases unless currently selected
		filteredCases = filteredCases.filter((c) => c.match_status_type !== 'declined' || c.id === selectedId);

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

	// Handle case completion (Professional side)
	const handleCompleteCase = async (caseId: string) => {
		try {
			setIsUpdatingStatus(true);
            const selectedCase = cases.find(c => c.id === caseId);
            if (!selectedCase) return;

            // Use feedback field to track dual completion status
            let completionStatus = { is_prof_complete: false, is_surv_complete: false };
            try {
                if (selectedCase.feedback && selectedCase.feedback.startsWith('{')) {
                    completionStatus = JSON.parse(selectedCase.feedback);
                }
            } catch (e) {
                console.warn("Failed to parse completion status from feedback:", e);
            }

            completionStatus.is_prof_complete = true;
            const isFullyComplete = completionStatus.is_surv_complete === true;

            const updateData: any = {
                feedback: JSON.stringify(completionStatus),
                updated_at: new Date().toISOString(),
            };

            if (isFullyComplete) {
                updateData.match_status_type = "completed";
                updateData.completed_at = new Date().toISOString();
            }

			const { error } = await supabase
				.from("matched_services")
				.update(updateData)
				.eq("id", caseId);

			if (error) throw error;

            toast({
                title: isFullyComplete ? "Case Fully Completed" : "Case Marked as Complete",
                description: isFullyComplete 
                    ? "Both parties have confirmed. Case is now archived." 
                    : "Waiting for survivor to confirm completion. You are now available for new matches.",
            });

			// Update local state
			setCases((prev) =>
				prev.map((c) =>
					c.id === caseId
						? {
								...c,
								match_status_type: isFullyComplete ? "completed" : c.match_status_type,
                                feedback: JSON.stringify(completionStatus),
								completed_at: isFullyComplete ? new Date().toISOString() : c.completed_at,
						  }
						: c
				)
			);
		} catch (error) {
			console.error("Error completing case:", error);
            toast({
                title: "Error",
                description: "Failed to update completion status.",
                variant: "destructive"
            });
		} finally {
			setIsUpdatingStatus(false);
		}
	};

    // Handle case acceptance trigger
    const handleAcceptCase = (caseId: string) => {
        setCaseIdToAccept(caseId);
        setIsAcceptanceDialogOpen(true);
    };

    // Immediate "Meet Now" Acceptance
    const handleMeetNow = async () => {
        if (!caseIdToAccept) return;
        
        try {
            setIsUpdatingStatus(true);
            setIsAcceptanceDialogOpen(false);
            
            const selectedCase = cases.find(c => c.id === caseIdToAccept);
            if (!selectedCase) return;

            const survId = (selectedCase.survivor_id || selectedCase.report?.user_id) as string;

            // 1. Update Match Status
            const { error: matchError } = await supabase
                .from("matched_services")
                .update({
                    match_status_type: "accepted",
                    professional_accepted_at: new Date().toISOString(),
                    survivor_accepted_at: new Date().toISOString(), // Instant acceptance
                    updated_at: new Date().toISOString(),
                })
                .eq("id", caseIdToAccept);

            if (matchError) throw matchError;
            
            // Mark case as exclusive to drop it from other professionals
            await markCaseAsExclusive(selectedCase.report_id!, caseIdToAccept);

            // 2. Create Instant Appointment
            await createAppointment({
                professional_id: userId,
                survivor_id: survId,
                matched_services: caseIdToAccept,
                appointment_date: new Date().toISOString(),
                duration_minutes: 60,
                status: 'confirmed',
                appointment_type: 'Immediate Consultation',
                created_via: 'meet_now'
            });

            // 3. Update Local State
            setCases((prev) =>
                prev.map((c) =>
                    c.id === caseIdToAccept
                        ? {
                                ...c,
                                match_status_type: "accepted",
                                appointments: [
                                    ...(c.appointments || []),
                                    {
                                        id: 'new-instant',
                                        appointment_id: 'new-instant',
                                        appointment_date: new Date().toISOString(),
                                        status: 'confirmed'
                                    }
                                ]
                          }
                        : c
                )
            );

            toast({
                title: "Case Accepted & Meeting Started",
                description: "The case is now active. Switching to chat...",
            });

            // 4. Switch to Chat
            setActiveTab('chat');
            setSelectedId(caseIdToAccept);

        } catch (error) {
            console.error("Error in Meet Now:", error);
            toast({
                title: "Error",
                description: "Failed to start immediate meeting.",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingStatus(false);
            setCaseIdToAccept(null);
        }
    };

    // Scheduled Acceptance
     const handleScheduleAndAccept = async (apptData: {
        date: Date;
        duration: number;
        type: string;
        notes?: string;
    }) => {
        if (!caseIdToAccept) return;

        try {
            setIsUpdatingStatus(true);
            const selectedCase = cases.find(c => c.id === caseIdToAccept);
            if (!selectedCase) return;

            const survId = (selectedCase.survivor_id || selectedCase.report?.user_id) as string;

            // 1. Update Match Status
            const { error: matchError } = await supabase
                .from("matched_services")
                .update({
                    match_status_type: "accepted",
                    professional_accepted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", caseIdToAccept);

            if (matchError) throw matchError;
            
            // Mark case as exclusive to drop it from other professionals
            await markCaseAsExclusive(selectedCase.report_id!, caseIdToAccept);

            // 2. Create Scheduled Appointment (as a suggestion)
            await createAppointment({
                professional_id: userId,
                survivor_id: survId,
                matched_services: caseIdToAccept,
                appointment_date: apptData.date.toISOString(),
                duration_minutes: apptData.duration,
                status: 'requested', // Changed from 'confirmed'
                appointment_type: apptData.type,
                notes: apptData.notes,
                created_via: 'scheduled_acceptance'
            });

            // 3. Update Local State
            setCases((prev) =>
                prev.map((c) =>
                    c.id === caseIdToAccept
                        ? {
                                ...c,
                                match_status_type: "accepted",
                                appointments: [
                                    ...(c.appointments || []),
                                    {
                                        id: 'new-suggested',
                                        appointment_id: 'new-suggested',
                                        appointment_date: apptData.date.toISOString(),
                                        status: 'requested'
                                    }
                                ]
                          }
                        : c
                )
            );

            toast({
                title: "Schedule Suggested",
                description: `We've sent your suggested time (${apptData.date.toLocaleString()}) to the survivor for confirmation.`,
            });

        } catch (error) {
            console.error("Error in Scheduled Acceptance:", error);
            toast({
                title: "Error",
                description: "Failed to schedule and accept case.",
                variant: "destructive"
            });
        } finally {
            setIsUpdatingStatus(false);
            setIsSchedulerOpen(false);
            setCaseIdToAccept(null);
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
					className={`flex-1 lg:flex-[7] xl:flex-[7] min-w-0 h-full overflow-y-auto overflow-x-hidden pr-2 pb-8 scroll-smooth ${
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
							<div className="relative flex-1 min-w-0">
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
								<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sauti-teal/10 to-serene-blue-100 flex items-center justify-center shadow-sm">
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
									<div key={c.id} className="transition-all duration-200 min-w-0">
										<CaseCard
											data={c as any} // Cast to any to satisfy the specific CaseCardData interface for now, or match it exactly


											active={isActive}
											onClick={() => {
												setSelectedId(c.id);
												setActiveTab('details');
											}}
											onChat={(e) => {
												e.stopPropagation();
												setSelectedId(c.id);
												setActiveTab('chat');
											}}
											isLoadingMessages={isLoadingMessages}
										/>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* Right column: Detail Panel or Calendar */}
				<div
					className={`flex-1 lg:flex-[5] xl:flex-[5] min-w-0 h-full overflow-y-auto overflow-x-hidden ${
						mobileView !== "calendar" && !selected ? "hidden lg:block" : ""
					}`}
				>
                    {selected ? (
                        <div className="h-full animate-in fade-in slide-in-from-right-4 duration-300">
                             <CaseDetailView 
                                caseItem={selected}
                                userId={userId}
                                onCompleteCase={handleCompleteCase}
                                onAcceptCase={handleAcceptCase}
                                isUpdatingStatus={isUpdatingStatus}
                                onClose={() => setSelectedId(null)}
                                activeTab={activeTab}
                                onTabChange={(tab) => setActiveTab(tab as any)}
                                activeChat={activeChat}
                                isChatLoading={isChatLoading}
                            />
                        </div>
                    ) : (
                        <div className="h-full pb-8">
                            <Card className="p-5 shadow-sm border-serene-neutral-200 rounded-2xl bg-white h-full flex flex-col">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-bold text-gray-900">
                                                Appointments & Schedule
                                            </h3>
                                            {filtered.length > 0 && (
                                                <span className="px-2 py-1 bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-teal-100">
                                                    {filtered.length} active case{filtered.length === 1 ? "" : "s"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-medium text-gray-400">
                                           Manage your upcoming sessions and availability
                                        </p>
                                    </div>
                                </div>

                                {/* Calendar Connection Status */}
                                <CalendarConnectionStatus
                                    userId={userId}
                                    variant="inline"
                                    className="mb-6"
                                />

                                {/* Custom Calendar UI */}
                                <div className="bg-white rounded-3xl overflow-hidden flex-1 flex flex-col">
                                    {/* View Mode Toggle + Navigation */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-100">
                                            <button
                                                onClick={() => setCalendarViewMode('week')}
                                                className={cn(
                                                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                                    calendarViewMode === 'week' 
                                                        ? "bg-white text-teal-600 shadow-sm"
                                                        : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Week
                                            </button>
                                            <button
                                                onClick={() => setCalendarViewMode('month')}
                                                className={cn(
                                                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                                    calendarViewMode === 'month' 
                                                        ? "bg-white text-teal-600 shadow-sm"
                                                        : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Month
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-bold text-slate-700">
                                                {calendarViewMode === 'week' 
                                                    ? `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
                                                    : calendarSelectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
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
                                    <div className="grid grid-cols-7 gap-2 mb-6">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                            <div key={day} className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
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
                                                        onClick={() => setCalendarSelectedDate(day)}
                                                        className={cn(
                                                            "relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
                                                            isSelected 
                                                                ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20" 
                                                                : isToday 
                                                                    ? "bg-teal-50 text-teal-700 border border-teal-100" 
                                                                    : "hover:bg-slate-50 text-slate-600"
                                                        )}
                                                    >
                                                        <span className="text-sm font-bold">{day.getDate()}</span>
                                                        {dayAppointments.length > 0 && (
                                                            <div className="flex gap-0.5 mt-1">
                                                                {Array.from({ length: Math.min(dayAppointments.length, 3) }).map((_, i) => (
                                                                    <div 
                                                                        key={i} 
                                                                        className={cn(
                                                                            "h-1 w-1 rounded-full",
                                                                            isSelected ? "bg-white/60" : "bg-teal-500"
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
                                                            "relative h-10 rounded-xl flex flex-col items-center justify-center transition-all duration-300 text-xs font-bold",
                                                            !isCurrentMonth && "opacity-20",
                                                            isSelected 
                                                                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20" 
                                                                : isToday 
                                                                    ? "bg-teal-50 text-teal-700 border border-teal-100" 
                                                                    : "hover:bg-slate-50 text-slate-500"
                                                        )}
                                                    >
                                                        <span>{day.getDate()}</span>
                                                        {dayAppointments.length > 0 && isCurrentMonth && (
                                                            <div className={cn(
                                                                "h-1 w-1 rounded-full mt-0.5",
                                                                isSelected ? "bg-white/60" : "bg-teal-500"
                                                            )} />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Selected Date Details */}
                                    <div className="pt-6 border-t border-slate-50 overflow-y-auto">
                                        <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
                                            <span>
                                                {calendarSelectedDate.toDateString() === new Date().toDateString() 
                                                    ? "Today's Schedule" 
                                                    : calendarSelectedDate.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })
                                                }
                                            </span>
                                            <Calendar className="h-4 w-4 text-slate-300" />
                                        </h4>
                                        
                                        {(() => {
                                            const appointments = getAppointmentsForDay(calendarSelectedDate, filtered);
                                            const isToday = calendarSelectedDate.toDateString() === new Date().toDateString();
                                            
                                            if (appointments.length > 0) {
                                                return (
                                                    <div className="space-y-3">
                                                        {appointments.map((appt, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="group flex items-center gap-4 p-4 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-2xl cursor-pointer transition-all duration-300 border border-transparent hover:border-slate-100"
                                                                onClick={() => setSelectedId(appt.case.id)}
                                                            >
                                                                <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300">
                                                                    <Clock className="h-5 w-5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-slate-900 text-sm truncate">
                                                                        {appt.case?.report?.first_name ? `${appt.case.report.first_name} ${appt.case.report.last_name || ''}` : "Secret Consultation"}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                                        {appt.appointment_date ? new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time not set"}
                                                                    </p>
                                                                </div>
                                                                <Badge className={cn(
                                                                    "text-[10px] font-bold uppercase tracking-widest border-0 px-3 py-1",
                                                                    appt.status === 'confirmed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                                                )}>
                                                                    {appt.status}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            } else if (isToday) {
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
                                                    .sort((a, b) => {
                                                        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
                                                        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
                                                        return dateA - dateB;
                                                    })
                                                    .slice(0, 3);

                                                if (upcoming.length > 0) {
                                                    return (
                                                        <div className="space-y-4">
                                                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-2">Upcoming This Week</p>
                                                            <div className="space-y-2">
                                                                {upcoming.map((appt, i) => (
                                                                    <div 
                                                                        key={i} 
                                                                        className="flex items-center gap-4 p-4 bg-slate-50/50 hover:bg-white hover:shadow-lg rounded-2xl cursor-pointer transition-all duration-300"
                                                                        onClick={() => setSelectedId(appt.case.id)}
                                                                    >
                                                                        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-teal-600 shadow-sm">
                                                                            <Calendar className="h-4 w-4" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-bold text-slate-800 text-sm truncate">
                                                                                {appt.case?.report?.first_name || "Secret Consultation"}
                                                                            </p>
                                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                                <span>{appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Date not set"}</span>
                                                                                <span>•</span>
                                                                                <span>{appt.appointment_date ? new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time not set"}</span>
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
                                                <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-100">
                                                    <Clock className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No sessions scheduled</p>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
				</div>
			</div>

            {/* Acceptance Choice Dialog */}
            <Dialog open={isAcceptanceDialogOpen} onOpenChange={setIsAcceptanceDialogOpen}>
                <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-8 text-white relative">
                        <Zap className="absolute -top-4 -right-4 h-24 w-24 text-white/10" />
                        <DialogHeader className="relative">
                            <DialogTitle className="text-2xl font-bold tracking-tight">Accept Case Match</DialogTitle>
                            <DialogDescription className="text-teal-100 font-medium">
                                How would you like to proceed with this survivor?
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-6 grid gap-4">
                        <Button 
                            onClick={handleMeetNow}
                            disabled={isUpdatingStatus}
                            className="h-16 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 flex flex-col items-center justify-center gap-1 group transition-all active:scale-95"
                        >
                            <div className="flex items-center gap-2 font-bold text-lg">
                                <Zap className="h-5 w-5 group-hover:animate-pulse" />
                                Meet Now
                            </div>
                            <span className="text-[10px] opacity-80 font-medium uppercase tracking-widest">Immediate consultation & chat</span>
                        </Button>
                        
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                            <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400"><span className="bg-white px-2">or</span></div>
                        </div>

                        <Button 
                            variant="outline"
                            onClick={() => {
                                setIsAcceptanceDialogOpen(false);
                                setIsSchedulerOpen(true);
                            }}
                            disabled={isUpdatingStatus}
                            className="h-16 rounded-2xl border-2 border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 text-slate-600 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                        >
                            <div className="flex items-center gap-2 font-bold text-lg">
                                <Calendar className="h-5 w-5" />
                                Schedule Later
                            </div>
                            <span className="text-[10px] opacity-80 font-medium uppercase tracking-widest">Pick a future date & time</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Scheduler Modal */}
            <EnhancedAppointmentScheduler 
                isOpen={isSchedulerOpen}
                onClose={() => setIsSchedulerOpen(false)}
                onSchedule={handleScheduleAndAccept}
                userId={userId}
                professionalName="You"
                serviceName={selected?.service_details?.name || "Support Service"}
            />
		</div>
	);
}
