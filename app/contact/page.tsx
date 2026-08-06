import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Mail, BadgeCheck, Clock, ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CircledText } from "@/components/ui/CircledText";
import { ORGANIZATION, STREET_ADDRESS_LINE } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Contact Us — Sauti Salama, Lunga Lunga Road, Nairobi",
	description:
		"Contact Sauti Salama for gender-based violence support in Kenya. Visit us at Lunga Lunga Square, Lunga Lunga Road, Industrial Area, Nairobi, call +254 725 668148 or email info@sautisalama.org.",
	keywords: [
		"contact Sauti Salama",
		"GBV support centre Nairobi",
		"GBV organisation address Nairobi",
		"GBV help phone number Kenya",
		"Lunga Lunga Road Nairobi NGO",
	],
	alternates: { canonical: "/contact" },
	openGraph: {
		title: "Contact Sauti Salama | GBV Support, Nairobi",
		description:
			"Visit, call or email Sauti Salama for free and confidential gender-based violence support in Kenya.",
		url: `${ORGANIZATION.url}/contact`,
		type: "website",
	},
};

const contactPageSchema = {
	"@context": "https://schema.org",
	"@type": "ContactPage",
	"@id": `${ORGANIZATION.url}/contact`,
	name: "Contact Sauti Salama",
	description:
		"Contact details and physical location for Sauti Salama Safe Haven, a registered Kenyan non-profit providing gender-based violence support.",
	inLanguage: "en-KE",
	isPartOf: { "@id": `${ORGANIZATION.url}/#website` },
	about: { "@id": `${ORGANIZATION.url}/#organization` },
	mainEntity: { "@id": `${ORGANIZATION.url}/#localbusiness` },
};

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${ORGANIZATION.geo.latitude},${ORGANIZATION.geo.longitude}`;

export default function ContactPage() {
	return (
		<div className="flex min-h-screen flex-col bg-white">
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLd(contactPageSchema) }}
			/>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: jsonLd(
						breadcrumbSchema([
							{ name: "Home", path: "/" },
							{ name: "Contact", path: "/contact" },
						])
					),
				}}
			/>
			<Nav />
			<main id="main-content" className="flex-1">
				<section className="py-12 md:py-24">
					<div className="container px-4 max-w-6xl mx-auto">
						<h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-sauti-dark leading-tight mb-8">
							Contact <CircledText circleColor="#F4B400">Sauti Salama</CircledText>
						</h1>
						<p className="text-gray-600 text-lg md:text-2xl max-w-3xl font-medium leading-relaxed mb-12 md:mb-20">
							If you or someone you know needs support, reach us however feels safest.
							Everything you tell us is confidential, and every service we offer is
							free.
						</p>

						<div className="grid md:grid-cols-2 gap-8 md:gap-12">
							{/* Organisation details */}
							<div
								className="bg-sauti-teal-light/30 rounded-2xl md:rounded-[48px] p-8 md:p-12"
								itemScope
								itemType="https://schema.org/NGO"
							>
								<meta itemProp="name" content={ORGANIZATION.legalName} />
								<meta itemProp="url" content={ORGANIZATION.url} />
								<h2 className="text-2xl md:text-4xl font-black text-sauti-dark mb-8">
									Organisation Details
								</h2>

								<dl className="space-y-8">
									<div className="flex gap-4">
										<MapPin className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Physical Address
											</dt>
											<dd
												className="text-sauti-dark text-base md:text-lg font-medium leading-relaxed"
												itemProp="address"
												itemScope
												itemType="https://schema.org/PostalAddress"
											>
												<span itemProp="streetAddress" className="block">
													{ORGANIZATION.address.building}, {ORGANIZATION.address.street}
												</span>
												<span className="block">
													{ORGANIZATION.address.locality}, {ORGANIZATION.address.district}
												</span>
												<span className="block">
													<span itemProp="addressLocality">{ORGANIZATION.address.city}</span>
													{", "}
													<span itemProp="addressRegion">{ORGANIZATION.address.region}</span>
													{", "}
													<span itemProp="addressCountry">{ORGANIZATION.address.country}</span>
												</span>
												<meta itemProp="postalCode" content={ORGANIZATION.address.postalCode} />
												<a
													href={mapsUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center gap-2 mt-3 text-sauti-teal font-bold underline underline-offset-4"
												>
													Open in Google Maps
													<ArrowRight className="w-4 h-4" />
												</a>
											</dd>
										</div>
									</div>

									<div className="flex gap-4">
										<Mail className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Postal Address
											</dt>
											<dd className="text-sauti-dark text-base md:text-lg font-medium">
												{ORGANIZATION.address.poBox}
											</dd>
										</div>
									</div>

									<div className="flex gap-4">
										<Phone className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Telephone
											</dt>
											<dd className="text-sauti-dark text-base md:text-lg font-medium">
												<a
													href={`tel:${ORGANIZATION.telephone}`}
													itemProp="telephone"
													className="hover:text-sauti-teal transition-colors"
												>
													{ORGANIZATION.telephoneDisplay}
												</a>
											</dd>
										</div>
									</div>

									<div className="flex gap-4">
										<Mail className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Email
											</dt>
											<dd className="text-sauti-dark text-base md:text-lg font-medium break-all">
												<a
													href={`mailto:${ORGANIZATION.email}`}
													itemProp="email"
													className="hover:text-sauti-teal transition-colors"
												>
													{ORGANIZATION.email}
												</a>
											</dd>
										</div>
									</div>

									<div className="flex gap-4">
										<BadgeCheck className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Charity ID / Registration Number
											</dt>
											<dd className="text-sauti-dark text-base md:text-lg font-bold tracking-wide">
												{ORGANIZATION.charityId}
											</dd>
											<p className="text-gray-500 text-sm mt-1 font-medium">
												{ORGANIZATION.legalName} — registered in Kenya as a Company
												Limited by Guarantee.
											</p>
										</div>
									</div>

									<div className="flex gap-4">
										<Clock className="w-6 h-6 shrink-0 text-sauti-teal mt-1" aria-hidden="true" />
										<div>
											<dt className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
												Office Hours
											</dt>
											<dd className="text-sauti-dark text-base md:text-lg font-medium">
												Monday – Friday, 8:00 – 17:00 EAT
											</dd>
										</div>
									</div>
								</dl>
							</div>

							{/* Urgent help */}
							<div className="flex flex-col gap-8">
								<div className="bg-sauti-dark rounded-2xl md:rounded-[48px] p-8 md:p-12 text-white">
									<h2 className="text-2xl md:text-4xl font-black mb-6">
										Need help right now?
									</h2>
									<p className="text-white/80 text-base md:text-lg leading-relaxed mb-8 font-medium">
										If you are in immediate danger, call the police on{" "}
										<a href="tel:999" className="text-sauti-yellow font-bold">999</a> or{" "}
										<a href="tel:112" className="text-sauti-yellow font-bold">112</a>. Kenya&apos;s
										national GBV helpline{" "}
										<a href={`tel:${ORGANIZATION.helpline}`} className="text-sauti-yellow font-bold">
											{ORGANIZATION.helpline}
										</a>{" "}
										is free and open 24 hours.
									</p>
									<Link
										href="/report-abuse"
										className="inline-flex items-center gap-3 rounded-full bg-sauti-yellow text-sauti-dark px-8 py-4 md:py-5 text-base md:text-lg font-black hover:bg-sauti-yellow/90 transition-colors group"
									>
										Report Confidentially
										<ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
									</Link>
								</div>

								<div className="rounded-2xl md:rounded-[48px] overflow-hidden border border-gray-200 shadow-xl flex-1 min-h-[280px]">
									<iframe
										title={`Map showing ${STREET_ADDRESS_LINE}`}
										src={`https://www.google.com/maps?q=${ORGANIZATION.geo.latitude},${ORGANIZATION.geo.longitude}&z=16&output=embed`}
										className="w-full h-full min-h-[280px] border-0"
										loading="lazy"
										referrerPolicy="no-referrer-when-downgrade"
										allowFullScreen
									/>
								</div>
							</div>
						</div>
					</div>
				</section>
			</main>
			<div className="bg-[#00473e]">
				<Footer />
			</div>
		</div>
	);
}
