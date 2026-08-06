import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Volunteer & Get Involved \u2014 Join the GBV Movement in Kenya",
	description:
		"Volunteer with Sauti Salama in Kenya. Join as a counsellor, legal aid partner, community mobiliser or technologist and help survivors of gender-based violence access care and justice.",
	keywords: ["volunteer GBV Kenya", "GBV volunteer Nairobi", "join GBV movement Kenya", "GBV partnerships Kenya"],
	alternates: { canonical: "/volunteer" },
	openGraph: {
		title: "Volunteer | Sauti Salama",
		description:
			"Volunteer with Sauti Salama in Kenya. Join as a counsellor, legal aid partner, community mobiliser or technologist and help survivors of gender-based violence access care and justice.",
		url: `${ORGANIZATION.url}/volunteer`,
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
							{ name: "Volunteer", path: "/volunteer" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
