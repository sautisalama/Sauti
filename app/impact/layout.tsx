import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Our Impact \u2014 GBV Response Results Across Kenya",
	description:
		"How survivor-led GBV response works in practice in Kenya: survivors supported, community members trained, advocacy campaigns and the outcomes behind each of our programmes.",
	keywords: ["GBV impact Kenya", "survivors supported Kenya", "GBV advocacy Kenya", "end femicide Kenya", "16 days of activism Kenya"],
	alternates: { canonical: "/impact" },
	openGraph: {
		title: "Impact | Sauti Salama",
		description:
			"How survivor-led GBV response works in practice in Kenya: survivors supported, community members trained, advocacy campaigns and the outcomes behind each of our programmes.",
		url: `${ORGANIZATION.url}/impact`,
		type: "website",
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Home", path: "/" },
							{ name: "Impact", path: "/impact" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
