import withPWAInit from "@ducanh2912/next-pwa";

const isWindows = process.platform === "win32";

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
};

const withPWA = withPWAInit({
	dest: "public",
	// Disable PWA on Windows to avoid EPERM errors from terser/jest-worker during build
	disable: isWindows || process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
	fallbacks: {
		document: "/~offline",
	},
	// Other configurations you want...
});

export default withPWA(nextConfig);
