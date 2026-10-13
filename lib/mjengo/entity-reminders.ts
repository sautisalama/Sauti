import { looseAdmin } from "@/lib/loose-db";
import { sendNotification } from "@/lib/notifications";

export type ReminderEntity = "todo" | "grant" | "opportunity" | "project" | "fellowship" | "assignment";

export const REMINDER_TABLE: Record<ReminderEntity, { table: string; date: string; label: string; title: string; href: (id: string) => string }> = {
	todo: { table: "mjengo_todos", date: "due_date", label: "To-do", title: "title", href: (id) => `/dashboard/mjengo/todos?task=${id}` },
	grant: { table: "mjengo_grants", date: "deadline", label: "Grant", title: "title", href: () => "/dashboard/mjengo/grants" },
	opportunity: { table: "mjengo_opportunities", date: "deadline", label: "Opportunity", title: "title", href: () => "/dashboard/mjengo/opportunities" },
	project: { table: "mjengo_projects", date: "end_date", label: "Project", title: "name", href: () => "/dashboard/mjengo/projects" },
	fellowship: { table: "mjengo_fellowships", date: "deadline", label: "Fellowship", title: "title", href: () => "/dashboard/mjengo/fellowships" },
	assignment: { table: "mjengo_fellowship_assignments", date: "due_date", label: "Assignment", title: "title", href: () => "/dashboard/mjengo/fellowships" },
};

/** Date-only things are due at 09:00 in Nairobi on that day. */
const dueAt = (date: string) => new Date(`${date}T09:00:00+03:00`).getTime();

function when(offset: number): string {
	if (offset === 0) return "is due now";
	if (offset >= 10080 && offset % 10080 === 0) return `is due in ${offset / 10080} week${offset === 10080 ? "" : "s"}`;
	if (offset >= 1440 && offset % 1440 === 0) return `is due in ${offset / 1440} day${offset === 1440 ? "" : "s"}`;
	if (offset >= 60 && offset % 60 === 0) return `is due in ${offset / 60} hour${offset === 60 ? "" : "s"}`;
	return `is due in ${offset} minutes`;
}

/** Sends every reminder whose time has come, once. Runs with the five-minute job. */
export async function remindEntities(): Promise<{ sent: number }> {
	const db = looseAdmin();
	const { data } = await db.from("mjengo_reminders").select("id, entity_type, entity_id, user_id, offset_minutes").is("sent_at", null).limit(800);
	const rows = (data ?? []) as { id: string; entity_type: ReminderEntity; entity_id: string; user_id: string; offset_minutes: number }[];
	if (!rows.length) return { sent: 0 };
	const now = Date.now();
	let sent = 0;
	for (const type of Object.keys(REMINDER_TABLE) as ReminderEntity[]) {
		const mine = rows.filter((r) => r.entity_type === type);
		if (!mine.length) continue;
		const cfg = REMINDER_TABLE[type];
		const ids = [...new Set(mine.map((r) => r.entity_id))];
		const { data: ents } = await db.from(cfg.table).select(`id, ${cfg.title}, ${cfg.date}`).in("id", ids);
		const byId = new Map(((ents ?? []) as unknown as Record<string, string | null>[]).map((e) => [e.id as string, e]));
		for (const r of mine) {
			const e = byId.get(r.entity_id);
			const date = e?.[cfg.date];
			if (!e || !date) continue;
			const due = dueAt(date);
			const at = due - r.offset_minutes * 60_000;
			if (now < at) continue;
			// Long past: mark done without bothering anyone.
			if (now - due > 2 * 86400_000) { await db.from("mjengo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id); continue; }
			await sendNotification({ userId: r.user_id, type: "todo_due", title: `${cfg.label} reminder`, message: `"${e[cfg.title]}" ${when(r.offset_minutes)}.`, link: cfg.href(r.entity_id), sendEmail: false }).catch(() => undefined);
			await db.from("mjengo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
			sent += 1;
		}
	}
	return { sent };
}
