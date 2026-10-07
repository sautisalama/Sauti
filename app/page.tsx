import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";
import { getFeed } from "@/lib/content/feed";

// Re-render at most every 5 minutes; publishing also revalidates "/" immediately.
export const revalidate = 300;

/**
 * NOTE: this page previously used `dynamic(..., { ssr: false })`, which meant
 * crawlers (and the Google for Nonprofits reviewer) received an empty <body>.
 * The landing page is now server-rendered so the organisation details, address
 * and Charity ID in the footer are present in the initial HTML.
 */
export const metadata: Metadata = {
	title: "GBV Support in Kenya — Free & Confidential Help for Survivors",
	description:
		"Sauti Salama is a survivor-led Kenyan non-profit in Nairobi offering free, confidential gender-based violence support: counselling, safe shelter referrals, legal aid and anonymous reporting. Get help today.",
	alternates: { canonical: "/" },
};

export default async function Home() {
	const publications = await getFeed({ limit: 3 });
	return <LandingPage publications={publications} />;
}
