import { addDays, format } from "date-fns";

/** Public holidays in Kenya for a year, as "yyyy-MM-dd" to a name. Dates that fall on a Sunday move to the Monday. */

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Easter Sunday by the Anonymous Gregorian algorithm. */
function easter(year: number): Date {
	const a = year % 19, b = Math.floor(year / 100), c = year % 100;
	const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

/** Eid ul-Fitr follows the moon, so the dates are the expected ones announced for each year. */
const EID_FITR: Record<number, string> = { 2025: "03-31", 2026: "03-20", 2027: "03-10", 2028: "02-26", 2029: "02-14", 2030: "02-04" };

const cache = new Map<number, Map<string, string>>();

export function holidaysKE(year: number): Map<string, string> {
	const hit = cache.get(year);
	if (hit) return hit;
	const out = new Map<string, string>();
	const add = (d: Date, name: string) => {
		out.set(ymd(d), name);
		// When a holiday is a Sunday the following Monday is also a holiday.
		if (d.getDay() === 0) out.set(ymd(addDays(d, 1)), `${name} (observed)`);
	};
	add(new Date(year, 0, 1), "New Year's Day");
	const e = easter(year);
	out.set(ymd(addDays(e, -2)), "Good Friday");
	out.set(ymd(addDays(e, 1)), "Easter Monday");
	add(new Date(year, 4, 1), "Labour Day");
	add(new Date(year, 5, 1), "Madaraka Day");
	if (year >= 2025) add(new Date(year, 9, 10), "Mazingira Day");
	add(new Date(year, 9, 20), "Mashujaa Day");
	add(new Date(year, 11, 12), "Jamhuri Day");
	add(new Date(year, 11, 25), "Christmas Day");
	const boxing = new Date(year, 11, 26);
	out.set(ymd(boxing), "Boxing Day");
	const eid = EID_FITR[year];
	if (eid) { const [m, d] = eid.split("-").map(Number); add(new Date(year, m - 1, d), "Eid ul-Fitr"); }
	cache.set(year, out);
	return out;
}

/** The holiday on a day, if there is one. */
export function holidayOn(d: Date): string | null {
	return holidaysKE(d.getFullYear()).get(ymd(d)) ?? null;
}
