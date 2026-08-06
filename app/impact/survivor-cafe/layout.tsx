import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { articleSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Collective Care Models \u2014 Survivor-Led Peer Support in Kenya",
	description:
		"How Survivor Caf\u00e9s build community resilience where formal GBV services fall short: peer care circles that sustain mental well-being, reduce isolation and create referral pathways survivors trust.",
	keywords: ["peer support GBV Kenya", "survivor cafe", "collective care", "mental health support survivors Kenya", "community resilience Nairobi"],
	alternates: { canonical: "/impact/survivor-cafe" },
	openGraph: {
		title: "Collective Care Models \u2014 Survivor-Led Peer Support in Kenya",
		description:
			"How Survivor Caf\u00e9s build community resilience where formal GBV services fall short: peer care circles that sustain mental well-being, reduce isolation and create referral pathways survivors trust.",
		url: `${ORGANIZATION.url}/impact/survivor-cafe`,
		type: "article",
		publishedTime: "2026-01-02",
		images: [{ url: "/blog/empowerment.png" }],
	},
};

const schema = articleSchema({
	headline: "Collective Care Models \u2014 Survivor-Led Peer Support in Kenya",
	description: "How Survivor Caf\u00e9s build community resilience where formal GBV services fall short: peer care circles that sustain mental well-being, reduce isolation and create referral pathways survivors trust.",
	path: "/impact/survivor-cafe",
	image: "/blog/empowerment.png",
	datePublished: "2026-01-02",
	articleSection: "Practice Brief",
	keywords: ["peer support GBV Kenya", "survivor cafe", "collective care", "mental health support survivors Kenya", "community resilience Nairobi"],
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
					__html: jsonLd(breadcrumbSchema([{"name": "Home", "path": "/"}, {"name": "Impact", "path": "/impact"}, {"name": "Survivor Caf\u00e9s", "path": "/impact/survivor-cafe"}])),
				}}
			/>
			{children}
		</>
	);
}
