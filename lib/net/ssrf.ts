/** True for loopback, private, link-local (incl. cloud metadata 169.254.x), CGNAT and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
	if (ip.includes(":")) {
		const v = ip.toLowerCase();
		if (v === "::1" || v === "::") return true;
		if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
		const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
		return mapped ? isPrivateAddress(mapped[1]) : false;
	}
	const [a, b] = ip.split(".").map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 192 && b === 0) ||
		a >= 224
	);
}
