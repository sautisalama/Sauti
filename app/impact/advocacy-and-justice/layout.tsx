import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { articleSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Legal Literacy for Survivors \u2014 Your Rights Under Kenyan Law",
	description:
		"A plain-language guide to legal protections for GBV survivors in Kenya: the Sexual Offences Act, protection orders, P3 forms, evidence preservation and where to find free legal aid.",
	keywords: ["legal aid GBV Kenya", "Sexual Offences Act Kenya", "protection order Kenya", "P3 form Kenya", "survivor rights Kenya", "free legal aid Nairobi"],
	alternates: { canonical: "/impact/advocacy-and-justice" },
	openGraph: {
		title: "Legal Literacy for Survivors \u2014 Your Rights Under Kenyan Law",
		description:
			"A plain-language guide to legal protections for GBV survivors in Kenya: the Sexual Offences Act, protection orders, P3 forms, evidence preservation and where to find free legal aid.",
		url: `${ORGANIZATION.url}/impact/advocacy-and-justice`,
		type: "article",
		publishedTime: "2025-12-24",
		images: [{ url: "/blog/justice.png" }],
	},
};

const schema = articleSchema({
	headline: "Legal Literacy for Survivors \u2014 Your Rights Under Kenyan Law",
	description: "A plain-language guide to legal protections for GBV survivors in Kenya: the Sexual Offences Act, protection orders, P3 forms, evidence preservation and where to find free legal aid.",
	path: "/impact/advocacy-and-justice",
	image: "/blog/justice.png",
	datePublished: "2025-12-24",
	articleSection: "Legal Guide",
	keywords: ["legal aid GBV Kenya", "Sexual Offences Act Kenya", "protection order Kenya", "P3 form Kenya", "survivor rights Kenya", "free legal aid Nairobi"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(breadcrumbSchema([{"name": "Home", "path": "/"}, {"name": "Impact", "path": "/impact"}, {"name": "Advocacy & Justice", "path": "/impact/advocacy-and-justice"}])),
				}}
			/>
			{children}
		</>
	);
}
