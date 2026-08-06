/**
 * Sauti Salama publications — research briefs, learning modules and guides.
 *
 * Single source of truth shared by the homepage Publications section, the
 * /publications index and the sitemap, so nothing drifts out of sync.
 *
 * To add a publication: append an entry here. `featured: true` promotes it to
 * the three-card bento on the homepage (keep exactly three featured).
 */

export type Publication = {
	slug: string;
	title: string;
	/** Short line used on cards. Write it so it reads well in a search snippet. */
	summary: string;
	/** Longer blurb for the /publications index. */
	description: string;
	category: string;
	/** ISO date — used for schema.org datePublished and sorting. */
	date: string;
	/** Human-readable date shown in the UI. */
	dateLabel: string;
	href: string;
	image: string;
	imageAlt: string;
	readTime: string;
	keywords: string[];
	featured?: boolean;
};

export const PUBLICATIONS: Publication[] = [
	{
		slug: "aminas-story-gbv-response",
		title: "Amina's Story: GBV Response",
		summary:
			"An interactive module on responding to a survivor's disclosure — what helps, what harms, and why.",
		description:
			"A guided, interactive exercise for community responders in Kenya. Participants sort real responses to a survivor's disclosure into helpful, harmful and it-depends — covering the 72-hour medical window, consent, confidentiality and the risks of family mediation.",
		category: "Interactive Module",
		date: "2026-04-24",
		dateLabel: "24 April 2026",
		href: "/learn/climate-care",
		image: "/learn/amina.png",
		imageAlt:
			"Illustration of a Kenyan woman being supported by a community responder",
		readTime: "20 min exercise",
		keywords: [
			"GBV response training Kenya",
			"survivor disclosure",
			"trauma-informed care",
			"community responder guide",
		],
		featured: true,
	},
	{
		slug: "legal-literacy-for-survivors",
		title: "Legal Literacy for Survivors",
		summary:
			"Understanding your rights under Kenyan law — the Sexual Offences Act, protection orders and what to expect.",
		description:
			"A plain-language guide to the legal protections available to survivors of gender-based violence in Kenya: how to obtain a P3 form, how protection orders work under the Protection Against Domestic Violence Act, evidence preservation, and where to find free legal aid.",
		category: "Legal Guide",
		date: "2025-12-24",
		dateLabel: "24 December 2025",
		href: "/impact/advocacy-and-justice",
		image: "/blog/justice.png",
		imageAlt: "Scales of justice representing legal aid for GBV survivors in Kenya",
		readTime: "12 min read",
		keywords: [
			"legal aid GBV Kenya",
			"Sexual Offences Act Kenya",
			"protection order Kenya",
			"P3 form Kenya",
			"survivor rights",
		],
		featured: true,
	},
	{
		slug: "collective-care-models",
		title: "Collective Care Models",
		summary:
			"How survivor-led peer networks build community resilience where formal services fall short.",
		description:
			"Drawn from our Survivor Cafés, this brief documents how peer-to-peer care circles sustain mental well-being between clinical appointments, reduce isolation, and create referral pathways that survivors actually trust.",
		category: "Practice Brief",
		date: "2026-01-02",
		dateLabel: "2 January 2026",
		href: "/impact/survivor-cafe",
		image: "/blog/empowerment.png",
		imageAlt: "Women gathered in a peer support circle",
		readTime: "9 min read",
		keywords: [
			"peer support GBV Kenya",
			"survivor café",
			"collective care",
			"community resilience Nairobi",
		],
		featured: true,
	},
	{
		slug: "reporting-and-personal-safety",
		title: "Reporting & Personal Safety",
		summary:
			"A practical guide to discreet reporting, evidence storage and staying safe online.",
		description:
			"How to use Sauti Salama's tools to report abuse confidentially or anonymously, store evidence securely, and reduce your digital footprint when an abuser may have access to your devices.",
		category: "Safety Guide",
		date: "2025-12-12",
		dateLabel: "12 December 2025",
		href: "/impact/platform",
		image: "/dashboard/activism-image-woman-with-megaphone.png",
		imageAlt: "Woman with a megaphone representing survivor voice and reporting",
		readTime: "10 min read",
		keywords: [
			"anonymous GBV reporting Kenya",
			"digital safety survivors",
			"evidence preservation",
			"report abuse Kenya",
		],
	},
	{
		slug: "ai-for-impact",
		title: "AI for Impact",
		summary:
			"Using AI to widen access to care without compromising safety or consent.",
		description:
			"A course and accompanying brief on applying artificial intelligence within survivor services — triage, translation and referral matching — alongside the consent, data-protection and safeguarding standards that must govern them.",
		category: "Course",
		date: "2026-02-18",
		dateLabel: "18 February 2026",
		href: "/impact/capacity-building",
		image: "/events/programs/AI course.png",
		imageAlt: "Course materials for the AI for Impact programme",
		readTime: "Course",
		keywords: [
			"AI for nonprofits Kenya",
			"feminist technology",
			"consent-first design",
			"digital safeguarding",
		],
	},
];

export const FEATURED_PUBLICATIONS = PUBLICATIONS.filter((p) => p.featured);
