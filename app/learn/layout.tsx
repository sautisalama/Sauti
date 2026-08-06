import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Learning Hub \u2014 GBV Courses, Guides & Training for Kenya",
	description:
		"Free GBV learning resources for Kenya: interactive response training, legal literacy, personal safety guides and courses for community responders, health workers and survivors.",
	keywords: ["GBV training Kenya", "GBV course Kenya", "learn about gender based violence", "GBV resources Kenya", "survivor education"],
	alternates: { canonical: "/learn" },
	openGraph: {
		title: "Learn | Sauti Salama",
		description:
			"Free GBV learning resources for Kenya: interactive response training, legal literacy, personal safety guides and courses for community responders, health workers and survivors.",
		url: `${ORGANIZATION.url}/learn`,
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
							{ name: "Learn", path: "/learn" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
