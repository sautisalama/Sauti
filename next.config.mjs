import withPWAInit from "@ducanh2912/next-pwa";

const isWindows = process.platform === "win32";

const ContentSecurityPolicy = `
	default-src 'self';
	script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
	style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
	img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://*.supabase.co https://*.supabase.in;
	font-src 'self' https://fonts.gstatic.com;
	connect-src 'self' https://*.supabase.co https://*.supabase.in https://sautisalama.org https://api.vercel.live;
	frame-ancestors 'none';
	base-uri 'self';
	form-action 'self';
`.trim();

const securityHeaders = [
	{
		key: "X-DNS-Prefetch-Control",
		value: "on",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{
		key: "X-XSS-Protection",
		value: "1; mode=block",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "Content-Security-Policy",
		value: ContentSecurityPolicy.replace(/\n/g, " ").replace(/\s{2,}/g, " "),
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(self)",
	},
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	allowedDevOrigins: [
		"192.168.150.110",
		"historiographical-baffledly-isadora.ngrok-free.dev",
	],
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "res.cloudinary.com" },
			{ protocol: "https", hostname: "lh3.googleusercontent.com" },
			{ protocol: "https", hostname: "assets.aceternity.com" },
			{ protocol: "https", hostname: "images.unsplash.com" },
			{ protocol: "https", hostname: "i.pravatar.cc" },
			{ protocol: "https", hostname: "*.supabase.co" },
			{ protocol: "https", hostname: "*.supabase.in" },
		],
	},
	reactStrictMode: true,
	compiler: {
		removeConsole: process.env.NODE_ENV !== "development",
	},
	turbopack: {},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
	async redirects() {
		return [
			{
				source: "/sitemap.xml",
				destination: "/sitemap",
				permanent: false,
				has: [
					{
						type: "host",
						value: "app.sautisalama.org",
					},
				],
			},
		];
	},
};

const withPWA = withPWAInit({
	dest: "public",
	disable: isWindows || process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
	fallbacks: {
		document: "/~offline",
	},
});

export default withPWA(nextConfig);
