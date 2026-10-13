/** What a scanned receipt QR says: where it points, and how to file it. */
export interface ScannedReceipt {
	/** The address in the code, when it is one. */
	link: string | null;
	/** Filed as tax when it comes from KRA (eTIMS or the older TIMS devices). */
	tax: boolean;
	/** The seller's KRA PIN, when the code carries it. */
	pin: string | null;
	category: string | null;
	vendor: string;
	note: string;
	raw: string;
}

const KRA_HOST = /(^|\.)kra\.go\.ke$/i;

export function readReceiptQr(raw: string): ScannedReceipt {
	const text = raw.trim();
	let url: URL | null = null;
	try { url = new URL(text); if (!/^https?:$/.test(url.protocol)) url = null; } catch { /* not an address */ }

	const host = url?.hostname ?? "";
	const kra = !!url && (KRA_HOST.test(host) || /etims|tims/i.test(host));
	// An eTIMS receipt link carries its data as PIN (11 characters) + branch + invoice number.
	const data = url?.searchParams.get("Data") ?? url?.searchParams.get("data") ?? "";
	const pin = (/^[AP]\d{9}[A-Z]/i.exec(data)?.[0] ?? /\b[AP]\d{9}[A-Z]\b/i.exec(text)?.[0] ?? null)?.toUpperCase() ?? null;

	if (kra) {
		return {
			link: url!.toString(), tax: true, pin, category: "Tax (KRA eTIMS)",
			vendor: pin ? `KRA eTIMS receipt, seller ${pin}` : "KRA eTIMS receipt",
			note: `KRA receipt: ${url!.toString()}`, raw: text,
		};
	}
	if (url) return { link: url.toString(), tax: false, pin, category: null, vendor: host.replace(/^www\./, ""), note: `Receipt link: ${url.toString()}`, raw: text };
	return { link: null, tax: false, pin, category: null, vendor: "", note: `Scanned: ${text.slice(0, 300)}`, raw: text };
}
