import type { Metadata, Viewport } from "next";
import { Inter, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { EmergencyExit } from "@/components/EmergencyExit";
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
	title: {
		default: "Sauti Salama | Breaking the Silence",
		template: "%s | Sauti Salama"
	},
	description: "Breaking the Silence, Building a Brighter Future. A platform dedicated to supporting survivors of gender-based violence (GBV) through technology, care, and legal access.",
	manifest: "/manifest.json",
	icons: {
		icon: "/icons/icons-512.png",
		apple: "/icons/icons-512.png",
	},
	keywords: ["GBV", "Gender Based Violence", "Gender", "Sauti Salama", "Kenya", "Abuse Reporting", "Support Services"],
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
		title: "Sauti Salama | Breaking the Silence",
		description: "Breaking the Silence, Building a Brighter Future. Supporting survivors of GBV through secure reporting and care access.",
		url: process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org",
		siteName: "Sauti Salama",
		images: [
			{
				url: "/dashboard/featured.png",
				width: 1200,
				height: 630,
				alt: "Sauti Salama - Breaking the Silence",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Sauti Salama | Breaking the Silence",
		description: "Breaking the Silence, Building a Brighter Future. Supporting survivors of GBV.",
		images: ["/dashboard/featured.png"],
		creator: "@SautiSalama",
	},
	alternates: {
		canonical: "/",
		languages: {
			"en": "https://sautisalama.org",
			"sw": "https://sautisalama.org?lang=sw",
		},
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
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
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var config = JSON.parse(localStorage.getItem('ss_a11y') || '{}');
									var el = document.documentElement;
									if (config.highContrast) el.setAttribute('data-a11y-high-contrast', '1');
									if (config.reduceMotion) el.setAttribute('data-a11y-reduce-motion', '1');
									if (config.readableFont) el.setAttribute('data-a11y-readable-font', '1');
									if (config.underlineLinks) el.setAttribute('data-a11y-underline-links', '1');
									if (config.dyslexic) el.setAttribute('data-a11y-dyslexic', '1');
									if (config.textScale) el.setAttribute('data-a11y-text-scale', config.textScale);
								} catch (e) {}
							})();
						`,
					}}
				/>
				<script
					suppressHydrationWarning
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@graph": [
								{
									"@type": "WebSite",
									"@id": "https://sautisalama.org/#website",
									"url": "https://sautisalama.org",
									"name": "Sauti Salama",
									"description": "Breaking the Silence, Building a Brighter Future",
									"potentialAction": {
										"@type": "SearchAction",
										"target": {
											"@type": "EntryPoint",
											"urlTemplate": "https://sautisalama.org/learn?q={search_term_string}"
										},
										"query-input": "required name=search_term_string"
									}
								},
								{
									"@type": "Organization",
									"@id": "https://sautisalama.org/#organization",
									"name": "Sauti Salama",
									"url": "https://sautisalama.org",
									"logo": {
										"@type": "ImageObject",
										"url": "https://sautisalama.org/logo.webp",
										"width": 200,
										"height": 60
									},
									"sameAs": [
										"https://www.linkedin.com/company/sauti-salama/"
									]
								},
								{
									"@type": "ItemList",
									"name": "Quick Links",
									"itemListElement": [
										{
											"@type": "ListItem",
											"position": 1,
											"name": "Report Abuse",
											"url": "https://sautisalama.org/report-abuse"
										},
										{
											"@type": "ListItem",
											"position": 2,
											"name": "Log In",
											"url": "https://sautisalama.org/signin"
										},
										{
											"@type": "ListItem",
											"position": 3,
											"name": "Our Impact",
											"url": "https://sautisalama.org/impact"
										},
										{
											"@type": "ListItem",
											"position": 4,
											"name": "Programs",
											"url": "https://sautisalama.org/programs"
										},
										{
											"@type": "ListItem",
											"position": 5,
											"name": "Learn",
											"url": "https://sautisalama.org/learn"
										},
										{
											"@type": "ListItem",
											"position": 6,
											"name": "Get Involved",
											"url": "https://sautisalama.org/volunteer"
										}
									]
								}
							]
						}).replace(/</g, '\\u003c')
					}}
				/>
				<script
					suppressHydrationWarning
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@graph": [
								{
									"@type": "WebSite",
									"@id": "https://sautisalama.org/?lang=sw#website",
									"url": "https://sautisalama.org/?lang=sw",
									"inLanguage": "sw",
									"name": "Sauti Salama",
									"description": "Kuvunja Kimya, Kujenga Mustakabali Bora"
								},
								{
									"@type": "Organization",
									"@id": "https://sautisalama.org/?lang=sw#organization",
									"name": "Sauti Salama",
									"url": "https://sautisalama.org/?lang=sw",
									"logo": {
										"@type": "ImageObject",
										"url": "https://sautisalama.org/logo.webp",
										"width": 200,
										"height": 60
									}
								}
							]
						}).replace(/</g, '\\u003c')
					}}
				/>
			</head>
			<body className={`${inter.className} ${hyper.variable}`} suppressHydrationWarning>
				<EmergencyExit />
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
