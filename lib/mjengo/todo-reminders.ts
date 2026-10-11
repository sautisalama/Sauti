import { looseAdmin } from "@/lib/loose-db";
import { sendNotification } from "@/lib/notifications";

const day = (offset: number) => new Date(Date.now() + 3 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10); // Nairobi date

/**
 * Morning reminders for the team's to-dos: due today, due tomorrow, one day overdue, or a reminder date that
 * has arrived. Goes to the people the task is assigned to (or whoever created it, when it is unassigned),
 * once per task per day.
 */
export async function remindTodos(): Promise<{ tasks: number; sent: number }> {
	const today = day(0);
	const tomorrow = day(1);
	const yesterday = day(-1);
	const db = looseAdmin();

	const { data, error } = await db
		.from("mjengo_todos")
		.select("id, title, due_date, remind_on, assignee_ids, created_by, last_notified_on")
		.neq("status", "done")
		.or(`due_date.in.(${yesterday},${today},${tomorrow}),remind_on.eq.${today}`);
	if (error) throw new Error(error.message);

	let sent = 0;
	for (const t of (data ?? []) as { id: string; title: string; due_date: string | null; remind_on: string | null; assignee_ids: string[]; created_by: string | null; last_notified_on: string | null }[]) {
		if (t.last_notified_on === today) continue;
		const when =
			t.due_date === today ? "is due today"
			: t.due_date === tomorrow ? "is due tomorrow"
			: t.due_date === yesterday ? "was due yesterday"
			: "has a reminder today";
		const people = t.assignee_ids.length ? t.assignee_ids : t.created_by ? [t.created_by] : [];
		await Promise.all(
			people.map((userId) =>
				sendNotification({ userId, type: "todo_due", title: "To-do reminder", message: `"${t.title}" ${when}.`, link: `/dashboard/mjengo/todos?task=${t.id}`, sendEmail: false }).catch(() => undefined)
			)
		);
		await db.from("mjengo_todos").update({ last_notified_on: today }).eq("id", t.id);
		sent += people.length;
	}
	return { tasks: data?.length ?? 0, sent };
}
