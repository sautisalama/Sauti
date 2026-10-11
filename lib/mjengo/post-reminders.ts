import { looseAdmin } from "@/lib/loose-db";
import { sendNotification } from "@/lib/notifications";
import { CHANNEL_INFO, type Channel } from "@/lib/mjengo/channels";

/**
 * Morning reminder for social posts scheduled for today: the creator is told what goes out, where and when,
 * and the post page has the text ready to copy. Publishing itself is a deliberate human step until the
 * channel accounts are connected.
 */
export async function remindPosts(): Promise<{ posts: number; sent: number }> {
	const now = Date.now() + 3 * 3600_000; // Nairobi time
	const day = new Date(now).toISOString().slice(0, 10);
	const start = new Date(`${day}T00:00:00+03:00`).toISOString();
	const end = new Date(`${day}T23:59:59+03:00`).toISOString();
	const db = looseAdmin();
	const { data, error } = await db
		.from("mjengo_posts")
		.select("id, title, body, channels, scheduled_for, created_by")
		.eq("status", "scheduled")
		.is("notified_at", null)
		.gte("scheduled_for", start)
		.lte("scheduled_for", end);
	if (error) throw new Error(error.message);

	let sent = 0;
	for (const p of (data ?? []) as { id: string; title: string | null; body: string; channels: Channel[]; scheduled_for: string; created_by: string | null }[]) {
		if (!p.created_by) continue;
		const at = new Date(new Date(p.scheduled_for).getTime() + 3 * 3600_000).toISOString().slice(11, 16);
		const where = p.channels.map((c) => CHANNEL_INFO[c]?.label ?? c).join(", ");
		await sendNotification({
			userId: p.created_by,
			type: "todo_due",
			title: "A post goes out today",
			message: `${p.title || p.body.slice(0, 60)} at ${at} on ${where}.`,
			link: "/dashboard/mjengo/content",
			sendEmail: false,
		}).catch(() => undefined);
		await db.from("mjengo_posts").update({ notified_at: new Date().toISOString() }).eq("id", p.id);
		sent += 1;
	}
	return { posts: data?.length ?? 0, sent };
}
