import type { Metadata } from "next";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Help Center — How to Get GBV Support in Kenya",
	description:
		"Answers to the most common questions about gender-based violence support in Kenya: how to report an incident, what help is available, how to access shelter, counselling and legal aid, and how to support someone you love.",
	keywords: [
		"how to report GBV in Kenya",
		"GBV help Kenya",
		"GBV hotline Kenya",
		"where to get help for domestic violence Kenya",
		"support a GBV survivor",
		"GBV shelter Nairobi",
	],
	alternates: { canonical: "/faq" },
	openGraph: {
		title: "Help Center | Sauti Salama",
		description:
			"Answers to common questions about getting gender-based violence support in Kenya — reporting, shelter, counselling and legal aid.",
		url: `${ORGANIZATION.url}/faq`,
		type: "website",
	},
};

/**
 * FAQPage schema. Keep the answers here in sync with components/AccordionFAQs.tsx —
 * Google requires the marked-up answer to match the visible page text.
 */
const faqSchema = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	"@id": `${ORGANIZATION.url}/faq#faq`,
	inLanguage: "en-KE",
	isPartOf: { "@id": `${ORGANIZATION.url}/#website` },
	publisher: { "@id": `${ORGANIZATION.url}/#organization` },
	mainEntity: [
		{
			"@type": "Question",
			name: "How can I report a GBV incident in Kenya and what kind of help would I get?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "You can report GBV incidents through several channels: contact local law enforcement, call a national GBV hotline (available 24/7 on 1195), visit a women's shelter or crisis centre, or file a confidential report through Sauti Salama at sautisalama.org/report-abuse. You can receive immediate safety planning and protection, medical care and counselling, legal support and advocacy, emergency shelter if needed, and confidential support services. All services prioritise your safety and confidentiality.",
			},
		},
		{
			"@type": "Question",
			name: "What resources does Sauti Salama offer and how can I access them?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "We provide a 24/7 crisis helpline, emergency shelter referrals, individual and group counselling, legal advocacy and court accompaniment, safety planning assistance, peer support groups, and referrals to partner organisations across Kenya. All services are free and confidential. Contact us on +254 725 668148, email info@sautisalama.org, or visit our centre at Lunga Lunga Square, Lunga Lunga Road, Industrial Area, Nairobi during business hours.",
			},
		},
		{
			"@type": "Question",
			name: "How can family and friends support someone affected by gender-based violence?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Support survivors by listening without judgment, believing their story, respecting their privacy and confidentiality, helping them access professional support, learning about GBV to better understand their experience, being patient with their healing process, helping with practical needs such as transport and childcare, and continuing to provide support after the immediate crisis. Let them make their own decisions and maintain control over their situation.",
			},
		},
		{
			"@type": "Question",
			name: "Is Sauti Salama's support free?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. Every service Sauti Salama offers — counselling, safe shelter referral, legal aid, safety planning and confidential reporting — is free of charge to survivors in Kenya.",
			},
		},
		{
			"@type": "Question",
			name: "Where is Sauti Salama located?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Sauti Salama Safe Haven is based at Lunga Lunga Square, Lunga Lunga Road, Industrial Area, Makadara District, Nairobi, Kenya (P.O. Box 8786 - 00100, G.P.O. Nairobi). We serve survivors across Kenya in person, by phone on +254 725 668148, and online.",
			},
		},
		{
			"@type": "Question",
			name: "Can I report abuse anonymously?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. Sauti Salama's platform supports fully anonymous reporting — you do not need to create an account or give your name to get matched with support. Reports are encrypted, and you control what is shared and with whom.",
			},
		},
	],
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Home", path: "/" },
							{ name: "Help Center", path: "/faq" },
						])
					),
				}}
			/>
			{children}
		</>
	);
}
