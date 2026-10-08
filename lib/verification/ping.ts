/** Tell the server that documents were just saved so the team is emailed straight away (fire and forget). */
export function pingVerificationAlerts(): void {
	if (typeof window === "undefined") return;
	fetch("/api/verification/notify", { method: "POST", keepalive: true }).catch(() => undefined);
}
