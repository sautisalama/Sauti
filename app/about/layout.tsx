import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Our Story \u2014 A Survivor-Led GBV Organisation in Nairobi, Kenya",
	description:
		"Sauti Salama is a survivor-led Kenyan feminist non-profit based in Nairobi. Learn how we bridge the gaps in access to care, safety and justice for women and girls facing gender-based violence.",
	keywords: ["about Sauti Salama", "survivor-led organisation Kenya", "feminist organisation Nairobi", "GBV NGO Kenya", "women's rights organisation Kenya"],
	alternates: { canonical: "/about" },
	openGraph: {
		title: "Our Story | Sauti Salama",
		description:
			"Sauti Salama is a survivor-led Kenyan feminist non-profit based in Nairobi. Learn how we bridge the gaps in access to care, safety and justice for women and girls facing gender-based violence.",
		url: `${ORGANIZATION.url}/about`,
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
							{ name: "Our Story", path: "/about" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
