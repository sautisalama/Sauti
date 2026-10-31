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
