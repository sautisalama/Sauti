import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { getBookableProfessional } from "@/lib/scheduling/public-professional";
import { BOOKING_TZ_LABEL, BOOKING_TZ_OFFSET, generateSlots, type Busy } from "@/lib/scheduling/slots";

export const dynamic = "force-dynamic";

/** Best-effort per-instance limit: 60 lookups per IP per minute. */
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
	recent.push(now);
	hits.set(ip, recent);
	if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
	return recent.length > 60;
}

/**
 * Real free times for a public-booking provider on one day. Shows only WHEN the provider is free,
 * never why (block reasons and other people's appointments stay private).
 *   GET /api/appointments/slots?professionalId=…&date=YYYY-MM-DD&duration=45
 */
export async function GET(request: Request) {
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	if (limited(ip)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

	const url = new URL(request.url);
	const professionalId = url.searchParams.get("professionalId") ?? "";
	const date = url.searchParams.get("date") ?? "";
	const duration = Number(url.searchParams.get("duration") ?? 60);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(duration) || duration < 15 || duration > 240) {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}
	const dayStart = new Date(`${date}T00:00:00${BOOKING_TZ_OFFSET}`);
	if (Number.isNaN(dayStart.getTime()) || dayStart.getTime() > Date.now() + 120 * 86_400_000) {
		return NextResponse.json({ error: "Invalid date." }, { status: 400 });
	}

	const pro = await getBookableProfessional(professionalId);
	if (!pro) return NextResponse.json({ error: "This professional is not available for online booking." }, { status: 404 });
	if (pro.out_of_office) return NextResponse.json({ slots: [], outOfOffice: true, timezone: BOOKING_TZ_LABEL });

	const from = dayStart.toISOString();
	const to = new Date(dayStart.getTime() + 24 * 3_600_000).toISOString();
	const admin = createAdminClient();
	const [{ data: blocks }, { data: appts }] = await Promise.all([
		admin.from("availability_blocks").select("start_time, end_time").eq("user_id", pro.id).lt("start_time", to).gt("end_time", from),
		admin.from("appointments").select("appointment_date, duration_minutes").eq("professional_id", pro.id).in("status", ["pending", "requested", "confirmed"]).gte("appointment_date", new Date(dayStart.getTime() - 6 * 3_600_000).toISOString()).lt("appointment_date", to),
	]);
	const busy: Busy[] = [
		...(blocks ?? []).map((b) => ({ start: new Date(b.start_time).getTime(), end: new Date(b.end_time).getTime() })),
		...(appts ?? []).filter((a) => a.appointment_date).map((a) => {
			const start = new Date(a.appointment_date as string).getTime();
			return { start, end: start + (Number(a.duration_minutes) || 60) * 60_000 };
		}),
	];
	return NextResponse.json({ slots: generateSlots({ date, durationMinutes: duration, busy }), timezone: BOOKING_TZ_LABEL });
}
