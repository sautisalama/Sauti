import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { getBookableProfessional } from "@/lib/scheduling/public-professional";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Best-effort per-instance limit: 5 booking requests per IP per hour. */
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
	recent.push(now);
	hits.set(ip, recent);
	if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
	return recent.length > 5;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * A visitor (not signed in) asks a verified, public-booking professional for an appointment.
 * Nothing is confirmed until the professional accepts. Previously this ran with the visitor's
 * own permissions, so every write was refused and booking never worked.
 */
export async function POST(request: Request) {
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	if (limited(ip)) return bad("Too many requests. Please try again later.", 429);

	let body: Record<string, any>;
	try {
		body = await request.json();
	} catch {
		return bad("Invalid request.");
	}

	const { professionalId, date, type, duration, clientInfo } = body;
	const email = clip(clientInfo?.email, 200).toLowerCase();
	const firstName = clip(clientInfo?.firstName, 100);
	const start = new Date(date);
	const minutes = Number(duration);

	if (!firstName) return bad("Please tell us your name.");
	if (!EMAIL.test(email)) return bad("Please enter a valid email address.");
	if (!(start.getTime() > Date.now() + 5 * 60_000)) return bad("Please choose a time in the future.");
	if (start.getTime() > Date.now() + 120 * 86_400_000) return bad("Please choose a date within the next 4 months.");
	if (!Number.isFinite(minutes) || minutes < 15 || minutes > 240) return bad("Invalid appointment length.");
	const apptType = clip(type, 60) || "consultation";

	const pro = await getBookableProfessional(String(professionalId ?? ""));
	if (!pro) return bad("This professional is not available for online booking.", 404);

	if (pro.out_of_office) return bad("This professional is out of office right now. Please try again later.", 409);

	const admin = createAdminClient();
	const end = new Date(start.getTime() + minutes * 60_000);
	const { data: free, error: slotError } = await admin.rpc("is_time_slot_available", {
		p_user_id: pro.id,
		p_start_time: start.toISOString(),
		p_end_time: end.toISOString(),
	});
	if (slotError) {
		console.error("Slot check failed:", slotError);
		return bad("We could not check availability. Please try again.", 500);
	}
	if (free === false) return bad("That time is no longer available. Please pick another.", 409);

	// Find or create the person asking. profiles.id is tied to an auth user, so a visitor becomes a
	// password-less survivor account they can claim later with "forgot password".
	let survivorId: string | null = null;
	const { data: existing } = await admin.from("profiles").select("id, user_type").eq("email", email).maybeSingle();
	if (existing) {
		if (existing.user_type !== "survivor") return bad("That email belongs to a service-provider account. Please use a different email.", 409);
		survivorId = existing.id;
	} else {
		const { data: created, error: createError } = await admin.auth.admin.createUser({
			email,
			email_confirm: false,
			user_metadata: { first_name: firstName, last_name: clip(clientInfo?.lastName, 100), user_type: "survivor" },
		});
		if (createError || !created.user) {
			console.error("Booking: could not create visitor account:", createError);
			return bad("We could not record your request. Please try again.", 500);
		}
		survivorId = created.user.id;
		await admin.from("profiles").upsert(
			{ id: survivorId, email, first_name: firstName, last_name: clip(clientInfo?.lastName, 100), phone: clip(clientInfo?.phone, 30) || null, user_type: "survivor", is_public_booking: true },
			{ onConflict: "id" }
		);
	}

	const { data: appointment, error } = await admin
		.from("appointments")
		.insert({
			professional_id: pro.id,
			survivor_id: survivorId,
			appointment_date: start.toISOString(),
			appointment_type: apptType,
			duration_minutes: minutes,
			status: "requested",
			notes: clip(clientInfo?.notes, 1000) || null,
			emergency_contact: clip(clientInfo?.emergencyContact, 200) || null,
			created_via: "public_booking",
		})
		.select("appointment_id")
		.single();
	if (error || !appointment) {
		console.error("Booking: appointment insert failed:", error);
		return bad("We could not record your request. Please try again.", 500);
	}

	// Tell the professional (in-app + email).
	await sendNotification({
		userId: pro.id,
		type: "new_referral",
		title: "New appointment request",
		message: `${firstName} has asked to book a ${apptType.replace(/_/g, " ")} on ${start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Review and confirm it in your dashboard.`,
		link: "/dashboard/cases",
		metadata: { appointment_id: appointment.appointment_id },
		sendEmail: true,
	}).catch((e) => console.error("Booking: professional notification failed:", e));

	return NextResponse.json({ success: true, appointmentId: appointment.appointment_id, message: "Appointment request submitted successfully" });
}
