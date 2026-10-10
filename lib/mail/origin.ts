/** Where this deployment is reached from the browser's point of view (must match a registered redirect). */
export function originOf(request: Request): string {
	const h = request.headers;
	const host = h.get("x-forwarded-host") || h.get("host");
	const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
	return host ? `${proto}://${host}` : new URL(request.url).origin;
}
