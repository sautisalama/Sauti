import type { Metadata } from "next";
import { Inter, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import "stream-chat-react/dist/css/v2/index.css";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
// import { SafetyBar } from "@/components/SafetyBar";
import { AccessibilityProvider } from "@/components/a11y/AccessibilityProvider";
import { KeyboardFocusScript } from "@/components/a11y/KeyboardFocusScript";
import AccessibilityFAB from "@/components/a11y/AccessibilityFAB";

const inter = Inter({ subsets: ["latin"] });
const hyper = Atkinson_Hyperlegible({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-dyslexic",
});

export const metadata: Metadata = {
	title: "Sauti Salama",
	description: "Breaking the Silence, Building a Brighter Future",
	manifest: "/manifest.json",
	icons: {
		icon: "/icons/icons-512.png",
		apple: "/icons/icons-512.png",
	},
	keywords: ["GBV", "Gender Based Violence", "Gender", "Sauti Salama"],
	themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#fff" }],
	authors: [
		{
			name: "Cashcade",
			url: "https://www.linkedin.com/sautisalama",
		},
	],
	viewport:
		"minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover",
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
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${inter.className} ${hyper.variable}`}>
				{/* <SafetyBar /> */}
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-white text-black px-3 py-2 rounded shadow"
				>
					Skip to content
				</a>
				<AccessibilityProvider>
					<KeyboardFocusScript />
					{children}
					<AccessibilityFAB />
				</AccessibilityProvider>
				<PWAInstallPrompt />
				<Toaster />
			</body>
		</html>
	);
}
