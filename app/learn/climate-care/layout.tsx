import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { articleSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Amina's Story: How to Respond to a GBV Disclosure",
	description:
		"An interactive training module for Kenyan community responders: what helps and what harms when a survivor discloses gender-based violence. Covers the 72-hour medical window, consent, confidentiality and safe referral.",
	keywords: ["GBV response training Kenya", "how to support a GBV survivor", "survivor disclosure", "72 hour window GBV", "trauma-informed response", "community responder Kenya"],
	alternates: { canonical: "/learn/climate-care" },
	openGraph: {
		title: "Amina's Story: How to Respond to a GBV Disclosure",
		description:
			"An interactive training module for Kenyan community responders: what helps and what harms when a survivor discloses gender-based violence. Covers the 72-hour medical window, consent, confidentiality and safe referral.",
		url: `${ORGANIZATION.url}/learn/climate-care`,
		type: "article",
		publishedTime: "2026-04-24",
		images: [{ url: "/learn/amina.png" }],
	},
};

const schema = articleSchema({
	headline: "Amina's Story: How to Respond to a GBV Disclosure",
	description: "An interactive training module for Kenyan community responders: what helps and what harms when a survivor discloses gender-based violence. Covers the 72-hour medical window, consent, confidentiality and safe referral.",
	path: "/learn/climate-care",
	image: "/learn/amina.png",
	datePublished: "2026-04-24",
	articleSection: "Interactive Module",
	keywords: ["GBV response training Kenya", "how to support a GBV survivor", "survivor disclosure", "72 hour window GBV", "trauma-informed response", "community responder Kenya"],
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
					__html: jsonLd(breadcrumbSchema([{"name": "Home", "path": "/"}, {"name": "Learn", "path": "/learn"}, {"name": "Amina's Story", "path": "/learn/climate-care"}])),
				}}
			/>
			{children}
		</>
	);
}
