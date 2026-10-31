import type { EntityKind } from "@/lib/mjengo/entity-view";

/** Marks a task the page suggested, so "redo" can replace the ones nobody has touched. */
export const AUTO_NOTE = "Suggested from this page's deadline.";

export interface SuggestedTask {
	title: string;
	due: string | null; // YYYY-MM-DD
}

const DAY = 86_400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `daysBefore` days ahead of the deadline, but never in the past: a task that is already late is due today. */
function before(deadline: string | null, daysBefore: number, now: number): string | null {
	if (!deadline) return null;
	const t = Date.parse(`${deadline}T12:00:00Z`);
	if (!Number.isFinite(t)) return null;
	return ymd(Math.max(t - daysBefore * DAY, now));
}

/**
 * A short, sensible chain of tasks worked back from the deadline. Rules, not AI: the dates are always
 * explainable, they move when the deadline moves, and redoing them never surprises anyone.
 */
export function suggestTasks(kind: EntityKind, title: string, deadline: string | null, now = Date.now()): SuggestedTask[] {
	const name = title.trim() || "this";
	const past = deadline ? Date.parse(`${deadline}T23:59:59Z`) < now : false;
	if (past) return [];
	switch (kind) {
		case "grant":
		case "opportunity":
			return [
				{ title: `Check we are eligible for ${name}`, due: before(deadline, 14, now) ?? ymd(now + 3 * DAY) },
				{ title: "Gather the documents and details they ask for", due: before(deadline, 10, now) },
				{ title: "Write the first full draft", due: before(deadline, 5, now) },
				{ title: "Get sign-off, then submit", due: before(deadline, 2, now) },
				...(deadline ? [] : [{ title: "Find the deadline and add it to this page", due: ymd(now + 2 * DAY) }]),
			];
		case "fellowship":
			return [
				{ title: `Check the requirements for ${name}`, due: before(deadline, 14, now) ?? ymd(now + 3 * DAY) },
				{ title: "Update the CV and write the personal statement", due: before(deadline, 7, now) },
				{ title: "Ask for references", due: before(deadline, 9, now) },
				{ title: "Submit the application", due: before(deadline, 2, now) },
			];
		case "project":
			return [
				{ title: "Agree the next milestone and who owns it", due: ymd(now + 3 * DAY) },
				{ title: "Share a short progress update with the team", due: deadline ? before(deadline, 7, now) : ymd(now + 14 * DAY) },
			];
	}
}
