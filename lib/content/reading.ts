/** Dependency-free text stats, safe to bundle for the browser. */
export function plainText(html: string): string {
	return (html ?? "")
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

export function readingStats(html: string): { words: number; minutes: number } {
	const text = plainText(html);
	const words = text ? text.split(" ").length : 0;
	return { words, minutes: Math.max(1, Math.round(words / 220)) };
}
