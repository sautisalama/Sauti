const MAP: Record<string, string> = {
	grant: "grant", fellowship: "fellowship", scholarship: "fellowship", award: "grant", conference: "event", event: "event",
	consultancy: "tender", tender: "tender", partnership: "partnership",
};

/** The opportunity type (grant, fellowship...) that a category read from a post stands for. */
export const kindFromCategoryClient = (category: string | null | undefined): string | null => (category ? MAP[category] ?? null : null);
