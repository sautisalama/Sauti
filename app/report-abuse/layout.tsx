import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Report Abuse Confidentially \u2014 GBV Reporting in Kenya",
	description:
		"Report gender-based violence confidentially or anonymously in Kenya. Your report is encrypted and connects you to counselling, medical, shelter and legal support. Free and available across Kenya.",
	keywords: ["report GBV Kenya", "anonymous abuse reporting Kenya", "report sexual violence Kenya", "report domestic violence Nairobi", "confidential GBV reporting"],
	alternates: { canonical: "/report-abuse" },
	openGraph: {
		title: "Report Abuse | Sauti Salama",
		description:
			"Report gender-based violence confidentially or anonymously in Kenya. Your report is encrypted and connects you to counselling, medical, shelter and legal support. Free and available across Kenya.",
		url: `${ORGANIZATION.url}/report-abuse`,
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
							{ name: "Report Abuse", path: "/report-abuse" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
