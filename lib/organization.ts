/**
 * Single source of truth for Sauti Salama's legal, contact and location details.
 *
 * These values are rendered publicly in the site footer and emitted as
 * schema.org structured data. Google for Nonprofits (and Google Search's
 * local/entity index) require that the organisation details shown on the
 * website match the details submitted during registration.
 */

export const ORGANIZATION = {
	legalName: "Sauti Salama Safe Haven",
	name: "Sauti Salama",
	alternateName: ["Sauti Salama Safe Haven", "Sauti Salama Kenya"],
	url: "https://sautisalama.org",
	logo: "https://sautisalama.org/logo.webp",
	email: "info@sautisalama.org",
	telephone: "+254725668148",
	telephoneDisplay: "+254 725 668148",
	/** National GBV helpline (not operated by Sauti Salama) */
	helpline: "1195",
	/** Charity / NGO registration number issued in Kenya */
	charityId: "CLG-LMTY83V9",
	registrationAuthority: "Registrar of Companies, Kenya (Company Limited by Guarantee)",
	foundingDate: "2023",
	address: {
		poBox: "P.O. Box 8786 - 00100, G.P.O. Nairobi",
		building: "Lunga Lunga Square",
		street: "Lunga Lunga Road",
		locality: "Industrial Area",
		district: "Makadara District",
		city: "Nairobi",
		region: "Nairobi County",
		postalCode: "00100",
		country: "Kenya",
		countryCode: "KE",
	},
	geo: {
		latitude: -1.307451,
		longitude: 36.872424,
	},
	social: [
		"https://www.instagram.com/sautisalama",
		"https://x.com/sautisalama",
		"https://www.linkedin.com/company/sauti-salama/",
	],
} as const;

/** Human-readable single-line street address, e.g. for footers and contact cards. */
export const STREET_ADDRESS_LINE = `${ORGANIZATION.address.building}, ${ORGANIZATION.address.street}, ${ORGANIZATION.address.locality}, ${ORGANIZATION.address.district}, ${ORGANIZATION.address.city}, ${ORGANIZATION.address.country}`;

/** schema.org PostalAddress fragment reused across every JSON-LD block. */
export const POSTAL_ADDRESS_SCHEMA = {
	"@type": "PostalAddress",
	streetAddress: `${ORGANIZATION.address.building}, ${ORGANIZATION.address.street}, ${ORGANIZATION.address.locality}`,
	postOfficeBoxNumber: "8786",
	addressLocality: ORGANIZATION.address.city,
	addressRegion: ORGANIZATION.address.region,
	postalCode: ORGANIZATION.address.postalCode,
	addressCountry: ORGANIZATION.address.countryCode,
} as const;

/** schema.org NGO node, referenced by @id from every other page-level node. */
export const ORGANIZATION_SCHEMA = {
	"@type": ["NGO", "Organization"],
	"@id": `${ORGANIZATION.url}/#organization`,
	name: ORGANIZATION.name,
	legalName: ORGANIZATION.legalName,
	alternateName: [...ORGANIZATION.alternateName],
	url: ORGANIZATION.url,
	description:
		"Sauti Salama is a survivor-led Kenyan feminist non-profit providing free gender-based violence (GBV) support in Nairobi and across Kenya — counselling, safe shelter referrals, legal aid and confidential reporting.",
	foundingDate: ORGANIZATION.foundingDate,
	identifier: {
		"@type": "PropertyValue",
		name: "Charity Registration Number (Kenya)",
		value: ORGANIZATION.charityId,
	},
	logo: {
		"@type": "ImageObject",
		url: ORGANIZATION.logo,
		width: 200,
		height: 60,
	},
	image: ORGANIZATION.logo,
	email: ORGANIZATION.email,
	telephone: ORGANIZATION.telephone,
	address: POSTAL_ADDRESS_SCHEMA,
	location: {
		"@type": "Place",
		name: `${ORGANIZATION.address.building}, ${ORGANIZATION.address.locality}`,
		address: POSTAL_ADDRESS_SCHEMA,
		geo: {
			"@type": "GeoCoordinates",
			latitude: ORGANIZATION.geo.latitude,
			longitude: ORGANIZATION.geo.longitude,
		},
	},
	areaServed: [
		{ "@type": "Country", name: "Kenya" },
		{ "@type": "AdministrativeArea", name: "Nairobi County" },
		{ "@type": "AdministrativeArea", name: "Makadara" },
		{ "@type": "AdministrativeArea", name: "Mombasa County" },
		{ "@type": "AdministrativeArea", name: "Kisumu County" },
	],
	knowsAbout: [
		"Gender-based violence",
		"Sexual and gender-based violence (SGBV) response",
		"Survivor-centred care",
		"Trauma-informed psychosocial support",
		"Legal aid for survivors in Kenya",
		"Safe shelter referral",
		"Femicide prevention",
		"Feminist technology and digital safety",
	],
	contactPoint: [
		{
			"@type": "ContactPoint",
			contactType: "Survivor support",
			telephone: ORGANIZATION.telephone,
			email: ORGANIZATION.email,
			areaServed: "KE",
			availableLanguage: ["en", "sw"],
		},
		{
			"@type": "ContactPoint",
			contactType: "General enquiries",
			email: ORGANIZATION.email,
			areaServed: "KE",
			availableLanguage: ["en", "sw"],
		},
	],
	sameAs: [...ORGANIZATION.social],
} as const;
