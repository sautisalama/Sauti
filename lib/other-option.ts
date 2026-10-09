/**
 * "Other, please specify" answers. Whatever a person types is turned into the same shape as the
 * built-in options (lowercase snake_case tokens such as "english" or "forced_marriage"), so it can
 * be stored, matched and shown exactly like a listed choice.
 */

/** "Kikuyu" -> "kikuyu", "Forced marriage!" -> "forced_marriage". Empty when nothing usable remains. */
export function toOptionValue(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40);
}

/** Split "Kikuyu, Luo and Kalenjin" into option values. Drops blanks, duplicates and "other" itself. */
export function parseOtherEntries(text: string): string[] {
	const seen = new Set<string>();
	for (const part of text.split(/[,;\n]+|\s+and\s+|\s*&\s*/i)) {
		const v = toOptionValue(part);
		if (v && v !== 'other') seen.add(v);
	}
	return [...seen];
}

/** "forced_marriage" -> "Forced marriage" for display. */
export function humanizeOption(value: string): string {
	const s = value.replace(/_/g, ' ').trim();
	return s ? s[0].toUpperCase() + s.slice(1) : s;
}
