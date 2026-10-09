
/** @type {import('next').NextConfig} */

const nextConfig = {
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
	async headers() {
		return [
			// The worker must always be revalidated so updates reach users promptly.
			{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
		];
	},
};

export default nextConfig;
