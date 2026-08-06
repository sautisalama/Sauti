import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { articleSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Reporting & Personal Safety \u2014 Discreet GBV Reporting in Kenya",
	description:
		"A practical guide to reporting abuse confidentially or anonymously in Kenya, storing evidence securely, and reducing your digital footprint when an abuser may have access to your devices.",
	keywords: ["anonymous GBV reporting Kenya", "report abuse safely", "digital safety survivors", "evidence preservation GBV", "tech safety Kenya"],
	alternates: { canonical: "/impact/platform" },
	openGraph: {
		title: "Reporting & Personal Safety \u2014 Discreet GBV Reporting in Kenya",
		description:
			"A practical guide to reporting abuse confidentially or anonymously in Kenya, storing evidence securely, and reducing your digital footprint when an abuser may have access to your devices.",
		url: `${ORGANIZATION.url}/impact/platform`,
		type: "article",
		publishedTime: "2025-12-12",
		images: [{ url: "/dashboard/activism-image-woman-with-megaphone.png" }],
	},
};

const schema = articleSchema({
	headline: "Reporting & Personal Safety \u2014 Discreet GBV Reporting in Kenya",
	description: "A practical guide to reporting abuse confidentially or anonymously in Kenya, storing evidence securely, and reducing your digital footprint when an abuser may have access to your devices.",
	path: "/impact/platform",
	image: "/dashboard/activism-image-woman-with-megaphone.png",
	datePublished: "2025-12-12",
	articleSection: "Safety Guide",
	keywords: ["anonymous GBV reporting Kenya", "report abuse safely", "digital safety survivors", "evidence preservation GBV", "tech safety Kenya"],
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
					__html: jsonLd(breadcrumbSchema([{"name": "Home", "path": "/"}, {"name": "Impact", "path": "/impact"}, {"name": "The Platform", "path": "/impact/platform"}])),
				}}
			/>
			{children}
		</>
	);
}
