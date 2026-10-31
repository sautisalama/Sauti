/** Plain-language labels for report fields, so screens never show raw enum values. */
const INCIDENT_LABELS: Record<string, string> = {
	physical: "Physical abuse",
	emotional: "Emotional abuse",
	sexual: "Sexual abuse",
	financial: "Financial abuse",
	child_abuse: "Child abuse",
	child_labor: "Child labor",
	neglect: "Neglect",
	trafficking: "Human trafficking",
	stalking: "Stalking or harassment",
	cyber: "Cyber bullying",
	racial: "Racial discrimination",
	other: "Other",
};

export function incidentLabel(value?: string | null): string {
	if (!value) return "Case";
	return INCIDENT_LABELS[value] ?? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** What a match status means to the person reading it, and how loudly to say it. */
export function matchStatusLabel(status?: string | null): { text: string; tone: "action" | "active" | "done" | "quiet" } {
	switch ((status || "pending").toLowerCase()) {
		case "pending":
			return { text: "Needs your response", tone: "action" };
		case "accepted":
		case "matched":
		case "confirmed":
			return { text: "In progress", tone: "active" };
		case "completed":
			return { text: "Completed", tone: "done" };
		case "declined":
			return { text: "Declined", tone: "quiet" };
		default:
			return { text: status!.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), tone: "quiet" };
	}
}

/** Hours a provider has to answer an offer before it escalates. Keep equal to ESCALATION_AFTER_HOURS in lib/constants. */
export const RESPONSE_WINDOW_HOURS = 24;

/** How long is left to answer an offer, in words, and how worried to look about it. */
export function responseClock(since: string | null | undefined, now = Date.now()): { text: string; tone: "ok" | "soon" | "overdue" } | null {
	if (!since) return null;
	const t = new Date(since).getTime();
	if (Number.isNaN(t)) return null;
	const left = RESPONSE_WINDOW_HOURS * 36e5 - (now - t);
	if (left <= 0) return { text: "Past 24 hours, escalating", tone: "overdue" };
	const hours = Math.floor(left / 36e5);
	if (hours >= 1) return { text: `${hours}h left to respond`, tone: hours < 6 ? "soon" : "ok" };
	return { text: `${Math.max(1, Math.floor(left / 6e4))} min left to respond`, tone: "soon" };
}
