import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Programs \u2014 GBV Care, Prevention, Legal Access & Feminist Tech in Kenya",
	description:
		"Our four programmes: access to psychosocial and medical care, community GBV prevention, legal aid and rights literacy, and consent-first digital safety tools \u2014 delivered across Kenya.",
	keywords: ["GBV programs Kenya", "GBV prevention Kenya", "legal aid GBV Kenya", "psychosocial support Nairobi", "feminist technology Kenya"],
	alternates: { canonical: "/programs" },
	openGraph: {
		title: "Programs | Sauti Salama",
		description:
			"Our four programmes: access to psychosocial and medical care, community GBV prevention, legal aid and rights literacy, and consent-first digital safety tools \u2014 delivered across Kenya.",
		url: `${ORGANIZATION.url}/programs`,
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
							{ name: "Programs", path: "/programs" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
