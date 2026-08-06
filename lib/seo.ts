import {
	ORGANIZATION,
	ORGANIZATION_SCHEMA,
	POSTAL_ADDRESS_SCHEMA,
} from "@/lib/organization";

const SITE = ORGANIZATION.url;

/** Escape `<` so the JSON-LD payload can never break out of the <script> tag. */
export function jsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Site-wide knowledge graph.
 *
 * Emitted once from the root layout. Every page-level node (Article, FAQPage,
 * BreadcrumbList…) should reference these by @id rather than redeclaring them,
 * so Google resolves a single, consistent entity for Sauti Salama.
 */
export const SITE_GRAPH = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${SITE}/#website`,
			url: SITE,
			name: "Sauti Salama",
			description:
				"Free, confidential gender-based violence (GBV) support for survivors in Kenya.",
			inLanguage: ["en-KE", "sw-KE"],
			publisher: { "@id": `${SITE}/#organization` },
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${SITE}/learn?q={search_term_string}`,
				},
				"query-input": "required name=search_term_string",
			},
		},

		ORGANIZATION_SCHEMA,

		{
			"@type": "LocalBusiness",
			"@id": `${SITE}/#localbusiness`,
			name: "Sauti Salama — GBV Support Centre, Nairobi",
			description:
				"Gender-based violence support centre serving Nairobi and the wider Kenya: psychosocial counselling, safe shelter referral, legal aid and confidential reporting.",
			parentOrganization: { "@id": `${SITE}/#organization` },
			url: `${SITE}/contact`,
			image: ORGANIZATION.logo,
			logo: ORGANIZATION.logo,
			telephone: ORGANIZATION.telephone,
			email: ORGANIZATION.email,
			priceRange: "Free",
			currenciesAccepted: "KES",
			address: POSTAL_ADDRESS_SCHEMA,
			geo: {
				"@type": "GeoCoordinates",
				latitude: ORGANIZATION.geo.latitude,
				longitude: ORGANIZATION.geo.longitude,
			},
			hasMap: `https://www.google.com/maps/search/?api=1&query=${ORGANIZATION.geo.latitude},${ORGANIZATION.geo.longitude}`,
			areaServed: { "@type": "Country", name: "Kenya" },
			openingHoursSpecification: [
				{
					"@type": "OpeningHoursSpecification",
					dayOfWeek: [
						"Monday",
						"Tuesday",
						"Wednesday",
						"Thursday",
						"Friday",
					],
					opens: "08:00",
					closes: "17:00",
				},
			],
			sameAs: [...ORGANIZATION.social],
		},

		{
			"@type": "Service",
			"@id": `${SITE}/#gbv-support-service`,
			serviceType: "Gender-based violence survivor support",
			name: "GBV support services in Kenya",
			description:
				"Free and confidential support for survivors of gender-based violence in Kenya — trauma-informed counselling, emergency and safe shelter referral, legal aid and rights education, and anonymous online reporting.",
			provider: { "@id": `${SITE}/#organization` },
			areaServed: [
				{ "@type": "Country", name: "Kenya" },
				{ "@type": "AdministrativeArea", name: "Nairobi County" },
			],
			audience: {
				"@type": "Audience",
				audienceType: "Survivors of gender-based violence, their families and support networks",
				geographicArea: { "@type": "Country", name: "Kenya" },
			},
			availableChannel: [
				{
					"@type": "ServiceChannel",
					name: "Confidential online reporting",
					serviceUrl: `${SITE}/report-abuse`,
				},
				{
					"@type": "ServiceChannel",
					name: "Phone support",
					servicePhone: ORGANIZATION.telephone,
				},
				{
					"@type": "ServiceChannel",
					name: "In-person support, Nairobi",
					serviceLocation: {
						"@type": "Place",
						name: `${ORGANIZATION.address.building}, ${ORGANIZATION.address.locality}`,
						address: POSTAL_ADDRESS_SCHEMA,
					},
				},
			],
			offers: {
				"@type": "Offer",
				price: "0",
				priceCurrency: "KES",
				availability: "https://schema.org/InStock",
			},
			hasOfferCatalog: {
				"@type": "OfferCatalog",
				name: "Sauti Salama programmes",
				itemListElement: [
					{
						"@type": "Offer",
						itemOffered: {
							"@type": "Service",
							name: "Access to Care — psychosocial support and medical referral",
							url: `${SITE}/programs/access-to-care`,
						},
					},
					{
						"@type": "Offer",
						itemOffered: {
							"@type": "Service",
							name: "Prevention — community and youth GBV prevention",
							url: `${SITE}/programs/prevention`,
						},
					},
					{
						"@type": "Offer",
						itemOffered: {
							"@type": "Service",
							name: "Legal Access — legal aid and rights literacy for survivors",
							url: `${SITE}/programs/legal-access`,
						},
					},
					{
						"@type": "Offer",
						itemOffered: {
							"@type": "Service",
							name: "Feminist Tech — consent-first digital safety tools",
							url: `${SITE}/programs/feminist-tech`,
						},
					},
				],
			},
		},

		{
			"@type": "ItemList",
			name: "Quick Links",
			itemListElement: [
				{ "@type": "ListItem", position: 1, name: "Report Abuse", url: `${SITE}/report-abuse` },
				{ "@type": "ListItem", position: 2, name: "Log In", url: `${SITE}/signin` },
				{ "@type": "ListItem", position: 3, name: "Our Impact", url: `${SITE}/impact` },
				{ "@type": "ListItem", position: 4, name: "Programs", url: `${SITE}/programs` },
				{ "@type": "ListItem", position: 5, name: "Learn", url: `${SITE}/learn` },
				{ "@type": "ListItem", position: 6, name: "Publications", url: `${SITE}/publications` },
				{ "@type": "ListItem", position: 7, name: "Contact", url: `${SITE}/contact` },
				{ "@type": "ListItem", position: 8, name: "Get Involved", url: `${SITE}/volunteer` },
			],
		},
	],
};

/** Build a BreadcrumbList for a page, given ordered [name, path] pairs. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: trail.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: `${SITE}${crumb.path}`,
		})),
	};
}

/** Build an Article node for publications and learning-hub content. */
export function articleSchema(input: {
	headline: string;
	description: string;
	path: string;
	image: string;
	datePublished: string;
	dateModified?: string;
	keywords?: string[];
	articleSection?: string;
}) {
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		"@id": `${SITE}${input.path}/#article`,
		headline: input.headline,
		description: input.description,
		image: `${SITE}${input.image}`,
		url: `${SITE}${input.path}`,
		mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}${input.path}` },
		datePublished: input.datePublished,
		dateModified: input.dateModified ?? input.datePublished,
		inLanguage: "en-KE",
		isAccessibleForFree: true,
		articleSection: input.articleSection,
		keywords: input.keywords?.join(", "),
		author: { "@id": `${SITE}/#organization` },
		publisher: { "@id": `${SITE}/#organization` },
		about: {
			"@type": "Thing",
			name: "Gender-based violence in Kenya",
		},
		spatialCoverage: { "@type": "Country", name: "Kenya" },
	};
}
