import withPWA from "next-pwa";

const isWindows = process.platform === "win32";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
		],
	},
	reactStrictMode: true, // Enable React strict mode for improved error handling
	swcMinify: true, // Enable SWC minification for improved performance
	compiler: {
		removeConsole: process.env.NODE_ENV !== "development", // Remove console.log in production
	},
};

export default withPWA({
	dest: "public", // destination directory for the PWA files
	// Disable PWA on Windows to avoid EPERM errors from terser/jest-worker during build
	disable: isWindows || process.env.NODE_ENV === "development",
	register: true, // register the PWA service worker
	skipWaiting: true, // skip waiting for service worker activation
})(nextConfig);
