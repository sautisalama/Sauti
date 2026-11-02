// Seeds sessions and blocked time for the e2e survivor and professional (dev only), so the calendar has something to show.
// Usage: node --env-file=.env.local scripts/e2e/seed-calendar.mjs [clear]
import { db, acc } from "./helpers.mjs";

const TAG = "e2e-calendar-seed";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("xtzpoyoymgwagrmpfwom")) throw new Error("Refusing to seed: not the dev project.");

const idOf = async (role) => (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === acc(role).email)?.id;
const pro = await idOf("professional");
const sur = await idOf("survivor");
console.log({ pro, sur });

await db.from("appointments").delete().eq("notes", TAG);
await db.from("availability_blocks").delete().eq("reason", TAG);
if (process.argv[2] === "clear") process.exit(0);

const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); };
const rows = [
	[1, 10, "confirmed", 60], [1, 15, "pending", 45], [3, 9, "confirmed", 60], [6, 11, "confirmed", 90], [-2, 14, "confirmed", 60], [9, 13, "requested", 60],
].map(([d, h, status, mins]) => ({ appointment_date: at(d, h), appointment_type: "counseling", duration_minutes: mins, status, professional_id: pro, survivor_id: sur, notes: TAG }));
const a = await db.from("appointments").insert(rows).select("appointment_id");
console.log("appointments", a.error?.message ?? a.data.length);

const blocks = [[2, 9, 17, "Training day"], [5, 13, 15, "Lunch and admin"], [7, 8, 12, "Court hearing"]].map(([d, s, e, r]) => ({ user_id: pro, start_time: at(d, s), end_time: at(d, e), reason: TAG, is_recurring: false }));
const b = await db.from("availability_blocks").insert(blocks).select("id");
console.log("blocks", b.error?.message ?? b.data.length);
