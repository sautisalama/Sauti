import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PUBLIC_PATHS = [
	"/robots.txt",
	"/sitemap.xml",
	"/favicon.ico",
	"/manifest.json",
	"/llms.txt",
];

const PUBLIC_PREFIXES = [
	"/signin",
	"/signup",
	"/auth/setup-password",
	"/error",
	"/api/auth/callback",
	"/api/auth/confirm",
	"/privacy-policy",
	"/terms-conditions",
	"/data-privacy",
	"/faq",
	"/about",
	"/programs",
	"/impact",
	"/volunteer",
	"/learn",
	"/report-abuse",
	"/api",
	"/weather",
	"/~offline",
	"/icons/",
	"/landing/",
	"/events/",
	"/docs/",
	"/blog/",
	"/platform/",
	"/dashboard/",
	"/splash.png",
	"/logo.webp",
];

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.includes(pathname)) return true;
	if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
	if (pathname === "/") return true;

	const staticExtensions = [
		".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
		".woff", ".woff2", ".ttf", ".eot", ".css", ".js", ".json",
		".xml", ".txt", ".pdf", ".heic",
	];
	if (staticExtensions.some((ext) => pathname.endsWith(ext))) return true;

	return false;
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (isPublicPath(pathname)) {
		return NextResponse.next();
	}

	return updateSession(request);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|sw.js|workbox-*.js).*)",
	],
};
