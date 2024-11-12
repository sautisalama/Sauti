import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

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
			<body className={inter.className}>
				{children}
				<Toaster />
			</body>
		</html>
	);
}
