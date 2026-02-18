import type { Metadata, Viewport } from "next";
import { Inter, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
// import { SafetyBar } from "@/components/SafetyBar";
import { AccessibilityProvider } from "@/components/a11y/AccessibilityProvider";
import { KeyboardFocusScript } from "@/components/a11y/KeyboardFocusScript";
import AccessibilityFAB from "@/components/a11y/AccessibilityFAB";

import { OrientationGuard } from "@/components/OrientationGuard";
import { Suspense } from "react";
import { DeviceInitializer } from "@/components/auth/DeviceInitializer";

const inter = Inter({ subsets: ["latin"] });
const hyper = Atkinson_Hyperlegible({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-dyslexic",
});

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org"),
	title: "Sauti Salama",
	description: "Breaking the Silence, Building a Brighter Future",
	manifest: "/manifest.json",
	icons: {
		icon: "/icons/icons-512.png",
		apple: "/icons/icons-512.png",
	},
	keywords: ["GBV", "Gender Based Violence", "Gender", "Sauti Salama"],
	authors: [
		{
			name: "Cashcade",
			url: "https://www.linkedin.com/company/sauti-salama/",
		},
	],
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Sauti Salama",
		startupImage: [
			{
				url: "/splash.png",
				media:
					"(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
			},
			{
				url: "/splash.png",
				media:
					"(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
			},
		],
	},
	openGraph: {
		title: "Sauti Salama",
		description: "Breaking the Silence, Building a Brighter Future",
		url: process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org",
		siteName: "Sauti Salama",
		images: [
			{
				url: "/dashboard/featured.png",
				width: 1200,
				height: 630,
				alt: "Sauti Salama",
			},
		],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Sauti Salama",
		description: "Breaking the Silence, Building a Brighter Future",
		images: ["/dashboard/featured.png"],
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	minimumScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fff" },
		{ media: "(prefers-color-scheme: dark)", color: "#000" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${inter.className} ${hyper.variable}`} suppressHydrationWarning>
				<DeviceInitializer />
				{/* <SafetyBar /> */}
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-white text-black px-3 py-2 rounded shadow"
				>
					Skip to content
				</a>
				<AccessibilityProvider>

						<KeyboardFocusScript />
						<Suspense fallback={null}>
							{children}
						</Suspense>
						<AccessibilityFAB />

				</AccessibilityProvider>
				<OrientationGuard />
				<PWAInstallPrompt />
				<Toaster />
			</body>
		</html>
	);
}
