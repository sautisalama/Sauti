import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Sauti Salama",
	description: "Breaking the Silence, Building a Brighter Future",
	manifest: "/manifest.json",
	icons: {
		icon: "/icons/icons-512.png",
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
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<head>
					<link rel="icon" href="/icons/icons-512.png" sizes="any" />
					<link rel="apple-touch-icon" href="/icons/icons-512.png" />
					<link href="/splash.png" rel="apple-touch-startup-image" />
					{/* Add multiple splash screen sizes if needed */}
					<link
						rel="apple-touch-startup-image"
						href="/splash.png"
						media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
					/>
					<link
						rel="apple-touch-startup-image"
						href="/splash.png"
						media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
					/>
					{/* Add more sizes as needed */}
				</head>
				{children}
			</body>
		</html>
	);
}
