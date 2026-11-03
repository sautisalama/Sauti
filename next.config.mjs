
/** @type {import('next').NextConfig} */

// One id per build. Tabs compare it with the server to notice an update before a stale page can fail.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || `local-${Date.now()}`;

const nextConfig = {
	// Version skew protection: assets and server actions are requested from the build that rendered the page.
	deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || undefined,
	env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
	allowedDevOrigins: ["192.168.150.110", "historiographical-baffledly-isadora.ngrok-free.dev"],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "assets.aceternity.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "i.pravatar.cc",
			},
			{
				protocol: "https",
				hostname: "*.supabase.co",
			},
			{
				protocol: "https",
				hostname: "*.supabase.in",
			},
		],
	},
	reactStrictMode: true, // Enable React strict mode for improved error handling
	compiler: {
		removeConsole: process.env.NODE_ENV !== "development", // Remove console.log in production
	},
	turbopack: {},
	// Native/Node-only mail libraries are loaded at runtime, not bundled.
	serverExternalPackages: ["imapflow", "nodemailer", "mailparser", "@napi-rs/canvas"],
	// Mail attachments travel through server actions.
	// staleTimes: a page fetched ahead of time (or visited) is reused for a few minutes instead of being asked for again.
	experimental: { serverActions: { bodySizeLimit: "20mb" }, staleTimes: { dynamic: 180, static: 600 } },
	async headers() {
		return [
			// The worker must always be revalidated so updates reach users promptly.
			{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
		];
	},
};

export default nextConfig;
