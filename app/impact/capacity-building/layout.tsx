import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { articleSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "AI for Impact \u2014 Widening Access to Care Without Losing Consent",
	description:
		"A course and brief on applying AI within survivor services in Kenya \u2014 triage, translation and referral matching \u2014 alongside the consent, data-protection and safeguarding standards that must govern them.",
	keywords: ["AI for nonprofits Kenya", "feminist technology", "consent-first design", "digital safeguarding", "GBV tech Kenya"],
	alternates: { canonical: "/impact/capacity-building" },
	openGraph: {
		title: "AI for Impact \u2014 Widening Access to Care Without Losing Consent",
		description:
			"A course and brief on applying AI within survivor services in Kenya \u2014 triage, translation and referral matching \u2014 alongside the consent, data-protection and safeguarding standards that must govern them.",
		url: `${ORGANIZATION.url}/impact/capacity-building`,
		type: "article",
		publishedTime: "2026-02-18",
		images: [{ url: "/events/programs/AI course.png" }],
	},
};

const schema = articleSchema({
	headline: "AI for Impact \u2014 Widening Access to Care Without Losing Consent",
	description: "A course and brief on applying AI within survivor services in Kenya \u2014 triage, translation and referral matching \u2014 alongside the consent, data-protection and safeguarding standards that must govern them.",
	path: "/impact/capacity-building",
	image: "/events/programs/AI course.png",
	datePublished: "2026-02-18",
	articleSection: "Course",
	keywords: ["AI for nonprofits Kenya", "feminist technology", "consent-first design", "digital safeguarding", "GBV tech Kenya"],
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
					__html: jsonLd(breadcrumbSchema([{"name": "Home", "path": "/"}, {"name": "Impact", "path": "/impact"}, {"name": "Capacity Building", "path": "/impact/capacity-building"}])),
				}}
			/>
			{children}
		</>
	);
}
