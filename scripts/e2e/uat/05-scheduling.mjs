// UAT-SCH: public booking, availability, out-of-office and appointment privacy.
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, apiAs, db, notificationsFor, poll, readOutbox, sleep } from "../helpers.mjs";

const started = new Date().toISOString();
const browser = await launch();
const visitor = await (await browser.newContext()).newPage();
const api = (await browser.newContext()).request;
const proId = acc("professional").id;
const stamp = Date.now();
const day = (offsetDays, h, m = 0) => {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	d.setHours(h, m, 0, 0);
	return d;
};
const book = (over = {}, ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`) =>
	api.post(`${BASE}/api/appointments/public`, {
		headers: { "x-forwarded-for": ip },
		data: { professionalId: proId, date: day(3, 10).toISOString(), type: "consultation", duration: 45, clientInfo: { firstName: "E2E-Visitor", lastName: "Booker", email: `e2e-sauti.visitor.${stamp}@example.com`, phone: "+254700111222", notes: "e2e booking" }, ...over },
	});

// ═════ A. The public page ═════
await visitor.goto(`${BASE}/schedule/${proId}`, { waitUntil: "networkidle", timeout: 120000 });
const page = await visitor.locator("body").innerText();
check("SCH-01 a visitor (not signed in) can open a verified professional's booking page", /E2E Lawyer/.test(page) && /E2E Legal Aid Clinic/.test(page));
check("SCH-02 the page never exposes the professional's email or phone", !/@example\.com/.test(page) && !/\+254700\d{5}/.test(page));
await visitor.goto(`${BASE}/schedule/sauti-${proId}`, { waitUntil: "networkidle", timeout: 120000 });
check("SCH-03 the shareable 'sauti-<id>' link works too", /E2E Lawyer/.test(await visitor.locator("body").innerText()));
await visitor.goto(`${BASE}/schedule/${acc("medic").id}`, { waitUntil: "networkidle", timeout: 120000 });
check("SCH-04 a professional who has not enabled public booking has no page", !/E2E Nurse/.test(await visitor.locator("body").innerText()));
await visitor.goto(`${BASE}/schedule/${acc("pending_pro").id}`, { waitUntil: "networkidle", timeout: 120000 });
check("SCH-05 an unverified professional cannot be booked", !/E2E Counsellor/.test(await visitor.locator("body").innerText()));

// ═════ B. Booking requests ═════
const ok = await book();
const okJson = await ok.json().catch(() => ({}));
check("SCH-06 a visitor can request an appointment", ok.status() === 200 && !!okJson.appointmentId, `${ok.status()} ${JSON.stringify(okJson).slice(0, 80)}`);
const appt = (await db.from("appointments").select("*").eq("appointment_id", okJson.appointmentId).maybeSingle()).data;
check("SCH-07 it is saved as 'requested' (the professional must confirm), with the right length", appt?.status === "requested" && appt?.duration_minutes === 45 && appt?.created_via === "public_booking", JSON.stringify({ s: appt?.status, d: appt?.duration_minutes }));
const note = await poll(async () => (await notificationsFor(proId, "new_referral")).find((n) => n.metadata?.appointment_id === okJson.appointmentId), { timeout: 15000 });
check("SCH-08 the professional is notified of the request", !!note, note?.title ?? "none");
check("SCH-09 …and emailed", readOutbox(started).some((e) => /appointment request/i.test(e.subject ?? "")));
const again = await book({}, "10.9.9.9");
check("SCH-10 the same time cannot be booked twice", again.status() === 409, String(again.status()));
check("SCH-11 an invalid email is rejected", (await book({ clientInfo: { firstName: "x", email: "not-an-email" } })).status() === 400);
check("SCH-12 a time in the past is rejected", (await book({ date: day(-1, 10).toISOString() })).status() === 400);
check("SCH-13 an unknown professional is rejected", (await book({ professionalId: "00000000-0000-0000-0000-000000000000" })).status() === 404);
check("SCH-14 a non-bookable professional is rejected", (await book({ professionalId: acc("medic").id })).status() === 404);
const clash = await book({ clientInfo: { firstName: "Imp", email: acc("professional").email, notes: "x" }, date: day(4, 10).toISOString() });
check("SCH-15 a visitor cannot book using a service-provider's email address", clash.status() === 409, String(clash.status()));

// rate limiting
let last = 0;
for (let i = 0; i < 7; i++) last = (await book({ clientInfo: { firstName: "x", email: "bad" } }, "10.7.7.7")).status();
check("SCH-16 repeated requests from one address are rate limited", last === 429, String(last));

// ═════ C. Availability ═════
const proApi = await apiAs("professional");
const blockStart = day(5, 9), blockEnd = day(5, 12);
const blk = await proApi.from("availability_blocks").insert({ user_id: proId, start_time: blockStart.toISOString(), end_time: blockEnd.toISOString(), reason: "e2e training" }).select("id").single();
check("SCH-17 a professional can block out time", !blk.error, blk.error?.message ?? "");
const inBlock = await book({ date: day(5, 10).toISOString() }, "10.1.1.1");
check("SCH-18 a blocked time cannot be booked", inBlock.status() === 409, String(inBlock.status()));
const afterBlock = await book({ date: day(5, 13).toISOString(), clientInfo: { firstName: "E2E-Visitor", email: `e2e-sauti.visitor.${stamp}@example.com`, notes: "after block" } }, "10.1.1.2");
check("SCH-19 time outside the block is still bookable", afterBlock.status() === 200, String(afterBlock.status()));
const other = await apiAs("survivor2");
const peek = await other.from("availability_blocks").select("id").eq("user_id", proId);
check("SCH-20 other people cannot read a professional's private availability blocks", (peek.data?.length ?? 0) === 0);

await db.from("profiles").update({ out_of_office: true }).eq("id", proId);
const ooo = await book({ date: day(6, 10).toISOString() }, "10.1.1.3");
check("SCH-21 an out-of-office professional does not accept new bookings", [404, 409].includes(ooo.status()), String(ooo.status()));
await db.from("profiles").update({ out_of_office: false }).eq("id", proId);

// ═════ D. Privacy of appointments ═════
const visitorId = (await db.from("profiles").select("id").eq("email", `e2e-sauti.visitor.${stamp}@example.com`).maybeSingle()).data?.id;
check("SCH-22 the visitor's request created a password-less survivor account", !!visitorId);
const s2 = await other.from("appointments").select("appointment_id").eq("appointment_id", okJson.appointmentId);
check("SCH-23 an unrelated user cannot see the appointment", (s2.data?.length ?? 0) === 0);
const upd = await other.from("appointments").update({ status: "cancelled" }).eq("appointment_id", okJson.appointmentId).select("appointment_id");
check("SCH-24 an unrelated user cannot cancel it", (upd.data?.length ?? 0) === 0);
const mine = await proApi.from("appointments").update({ status: "confirmed" }).eq("appointment_id", okJson.appointmentId).select("appointment_id");
check("SCH-25 the professional can confirm the request", (mine.data?.length ?? 0) === 1, mine.error?.message ?? "");


// ═════ E. Real availability (the booking page's time list) ═════
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
let off = 9;
while ([0, 6].includes(day(off, 12).getDay()) || off < 9) off++;
const weekday = ymd(day(off, 12));
const sat = ymd(day(off + ((6 - day(off, 12).getDay() + 7) % 7 || 7), 12));
const slotsOf = async (date, dur = 45, pid = proId) => {
	const res = await api.get(`${BASE}/api/appointments/slots?professionalId=${pid}&date=${date}&duration=${dur}`);
	return { status: res.status(), json: await res.json().catch(() => ({})) };
};
let sl = await slotsOf(weekday);
const labels = (sl.json.slots ?? []).map((x) => x.label);
check("SCH-26 a weekday offers real half-hour times inside working hours", sl.status === 200 && labels[0] === "09:00" && labels.at(-1) <= "16:15" && labels.length >= 10, `${labels.length} slots ${labels[0]}..${labels.at(-1)}`);
check("SCH-27 weekends offer nothing", ((await slotsOf(sat)).json.slots ?? []).length === 0);
check("SCH-28 the response reveals nothing but times (no reasons, names or ids)", JSON.stringify(Object.keys(sl.json).sort()) === JSON.stringify(["slots", "timezone"]) && !/e2e training|survivor|appointment/i.test(JSON.stringify(sl.json)));
const bookedAt = new Date(`${weekday}T10:00:00+03:00`);
const bk = await book({ date: bookedAt.toISOString(), duration: 45 }, "10.2.2.2");
sl = await slotsOf(weekday);
const after2 = (sl.json.slots ?? []).map((x) => x.label);
check("SCH-29 a requested time disappears from the list (and overlapping times with it)", bk.status() === 200 && !after2.includes("10:00") && !after2.includes("10:30") && after2.includes("09:00") && after2.includes("11:00"), after2.join(","));
const blk2 = await proApi.from("availability_blocks").insert({ user_id: proId, start_time: new Date(`${weekday}T13:00:00+03:00`).toISOString(), end_time: new Date(`${weekday}T15:00:00+03:00`).toISOString(), reason: "e2e private reason" }).select("id").single();
sl = await slotsOf(weekday);
const after3 = (sl.json.slots ?? []).map((x) => x.label);
check("SCH-30 blocked time is not offered", !blk2.error && !after3.some((l) => l >= "13:00" && l < "15:00") && after3.includes("15:00"), after3.join(","));
check("SCH-31 a longer session leaves fewer times", ((await slotsOf(weekday, 90)).json.slots ?? []).length < after3.length);
await db.from("profiles").update({ out_of_office: true }).eq("id", proId);
const oooSlots = await slotsOf(weekday);
check("SCH-32 an out-of-office provider offers no times", oooSlots.status === 404 || (oooSlots.json.slots ?? []).length === 0, String(oooSlots.status));
await db.from("profiles").update({ out_of_office: false }).eq("id", proId);
check("SCH-33 unknown or non-bookable providers and bad dates are refused", (await slotsOf(weekday, 45, "00000000-0000-0000-0000-000000000000")).status === 404 && (await slotsOf(weekday, 45, acc("medic").id)).status === 404 && (await slotsOf("2026-13-45")).status === 400 && (await slotsOf(weekday, 5)).status === 400);
// the booking page itself uses these times
await visitor.goto(`${BASE}/schedule/${proId}`, { waitUntil: "networkidle", timeout: 120000 });
await visitor.getByRole("gridcell").filter({ hasText: new RegExp(`^${Number(weekday.slice(8))}$`) }).first().click().catch(() => undefined);
await visitor.waitForTimeout(2500);
const pageSlots = await visitor.getByRole("radio").count();
check("SCH-34 the booking page shows the provider's real free times for a chosen day", pageSlots >= 3, `radios=${pageSlots}`);
await db.from("availability_blocks").delete().eq("user_id", proId);
// cleanup
await db.from("availability_blocks").delete().eq("user_id", proId);
await db.from("appointments").delete().eq("created_via", "public_booking");
if (visitorId) {
	await db.from("notifications").delete().eq("user_id", visitorId);
	await db.from("profiles").delete().eq("id", visitorId);
	await db.auth.admin.deleteUser(visitorId);
}
await browser.close();
process.exit(summary() ? 1 : 0);
