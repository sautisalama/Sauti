/**
 * Bookable time slots for one day. Pure functions so they can be unit-tested; the API route supplies
 * the busy periods (availability blocks and live appointments) and the clock.
 */
export const BOOKING_TZ_OFFSET = "+03:00"; // East Africa Time (Nairobi), where providers work
export const BOOKING_TZ_LABEL = "East Africa Time";
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 17;
export const SLOT_STEP_MINUTES = 30;

export interface Busy { start: number; end: number }
export interface Slot { start: string; end: string; label: string }

/** `date` is a calendar day (YYYY-MM-DD) in booking time. Weekends are not offered by default. */
export function isWeekendInBookingTz(date: string): boolean {
	const d = new Date(`${date}T12:00:00${BOOKING_TZ_OFFSET}`).getUTCDay();
	return d === 0 || d === 6;
}

export function generateSlots(opts: { date: string; durationMinutes: number; busy: Busy[]; now?: number; leadMinutes?: number }): Slot[] {
	const { date, durationMinutes, busy } = opts;
	const now = opts.now ?? Date.now();
	const earliest = now + (opts.leadMinutes ?? 30) * 60_000;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isWeekendInBookingTz(date)) return [];
	const dayEnd = new Date(`${date}T${String(DAY_END_HOUR).padStart(2, "0")}:00:00${BOOKING_TZ_OFFSET}`).getTime();
	const out: Slot[] = [];
	for (let minutes = DAY_START_HOUR * 60; minutes < DAY_END_HOUR * 60; minutes += SLOT_STEP_MINUTES) {
		const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
		const mm = String(minutes % 60).padStart(2, "0");
		const start = new Date(`${date}T${hh}:${mm}:00${BOOKING_TZ_OFFSET}`).getTime();
		const end = start + durationMinutes * 60_000;
		if (end > dayEnd || start < earliest) continue;
		if (busy.some((b) => b.start < end && b.end > start)) continue;
		out.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), label: `${hh}:${mm}` });
	}
	return out;
}
